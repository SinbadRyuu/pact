// Client for /api/v1/community/chat. It follows the app's API conventions: same-origin cookies, the
// x-csrf-token header on writes and the `{ error: { code, message, fields } }` error shape.

import type { ChatGroup, ChatMessage, GroupInput, GroupListResponse, GroupPatch, MessagePage, SendMessageInput } from "../../shared/types";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Sends one request and resolves with the parsed JSON body (undefined for 204), or rejects with ChatApiError. */
export type ChatTransport = (request: { method: HttpMethod; path: string; body?: unknown; signal?: AbortSignal }) => Promise<unknown>;

export class ChatApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;
  readonly retryAfterSeconds: number | undefined;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}, retryAfterSeconds?: number) {
    super(message);
    this.name = "ChatApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const TIMEOUT_MS = 15_000;
type TokenSource = () => string | null | undefined;
type PhotoUrl = (slug: string, version: string) => string;
const config: {
  basePath: string;
  getCsrfToken: TokenSource | null;
  sessionCsrfToken: TokenSource;
  transport: ChatTransport | null;
  groupPhotoUrl: PhotoUrl | null;
} = {
  basePath: "/api/v1/community/chat",
  getCsrfToken: null,
  sessionCsrfToken: () => null,
  transport: null,
  groupPhotoUrl: null,
};

/**
 * Point the chat at the app's API. Every option is optional:
 * - `getCsrfToken` returns the session's CSRF token (by default the page reads it from the `["session"]` query).
 * - `transport` replaces fetch entirely, e.g. to reuse the app's own API client.
 * - `groupPhotoUrl` changes where group pictures load from (by default the API's /groups/:slug/photo).
 */
export function configureCommunityChat(options: { basePath?: string; getCsrfToken?: TokenSource; transport?: ChatTransport; groupPhotoUrl?: PhotoUrl }) {
  if (options.basePath) config.basePath = options.basePath.replace(/\/+$/, "");
  if (options.getCsrfToken) config.getCsrfToken = options.getCsrfToken;
  if (options.transport) config.transport = options.transport;
  if (options.groupPhotoUrl) config.groupPhotoUrl = options.groupPhotoUrl;
}

/** The picture's URL includes its version, so a new upload is fetched straight away and old ones cache for good. */
export function groupPhotoUrl(slug: string, version: string) {
  return config.groupPhotoUrl
    ? config.groupPhotoUrl(slug, version)
    : `${config.basePath}/groups/${encodeURIComponent(slug)}/photo?v=${encodeURIComponent(version)}`;
}

/** Used by the page to read the token from the app's session query when no `getCsrfToken` was configured. */
export function setSessionCsrfSource(source: TokenSource) {
  config.sessionCsrfToken = source;
}

async function fetchTransport({ method, path, body, signal }: Parameters<ChatTransport>[0]): Promise<unknown> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (method !== "GET") {
    const token = (config.getCsrfToken ?? config.sessionCsrfToken)();
    if (token) headers["x-csrf-token"] = token;
  }
  if (body !== undefined) headers["content-type"] = "application/json";

  // Combine the caller's signal with a timeout without relying on AbortSignal.any (Safari 17.4+).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), TIMEOUT_MS);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });

  let res: Response;
  try {
    res = await fetch(`${config.basePath}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted) throw new ChatApiError(0, "timeout", "The server took too long to respond. Check your connection and try again.");
    throw new ChatApiError(0, "network_error", "Could not reach VT Impact. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: { code?: unknown; message?: unknown; fields?: Record<string, string> } } | null;
    const retryAfter = Number.parseInt(res.headers.get("retry-after") ?? "", 10) || undefined;
    const e = payload?.error;
    if (e && typeof e.code === "string" && typeof e.message === "string") throw new ChatApiError(res.status, e.code, e.message, e.fields ?? {}, retryAfter);
    throw new ChatApiError(res.status, "unexpected_response", "Something went wrong. Try again in a moment.");
  }
  if (res.status === 204 || !(res.headers.get("content-type") ?? "").includes("application/json")) return undefined;
  return res.json();
}

function request<T>(method: HttpMethod, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const transport = config.transport ?? fetchTransport;
  return transport({ method, path, ...(body !== undefined ? { body } : {}), ...(signal ? { signal } : {}) }) as Promise<T>;
}

const g = (slug: string) => `/groups/${encodeURIComponent(slug)}`;

export const chatApi = {
  groups: (signal?: AbortSignal) => request<GroupListResponse>("GET", "/groups", undefined, signal),
  createGroup: (input: GroupInput) => request<ChatGroup>("POST", "/groups", input),
  updateGroup: (slug: string, patch: GroupPatch) => request<ChatGroup>("PATCH", g(slug), patch),
  reorderGroups: (slugs: string[]) => request<void>("PUT", "/groups/order", { slugs }),
  setGroupPhoto: (slug: string, image: string) => request<ChatGroup>("PUT", `${g(slug)}/photo`, { image }),
  removeGroupPhoto: (slug: string) => request<ChatGroup>("DELETE", `${g(slug)}/photo`),
  messages: (slug: string, query: { before?: string; since?: number; limit?: number }, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (query.before !== undefined) params.set("before", query.before);
    if (query.since !== undefined) params.set("since", String(query.since));
    if (query.limit !== undefined) params.set("limit", String(query.limit));
    const qs = params.toString();
    return request<MessagePage>("GET", `${g(slug)}/messages${qs ? `?${qs}` : ""}`, undefined, signal);
  },
  send: (slug: string, input: SendMessageInput) => request<ChatMessage>("POST", `${g(slug)}/messages`, input),
  edit: (id: string, body: string) => request<ChatMessage>("PATCH", `/messages/${encodeURIComponent(id)}`, { body }),
  remove: (id: string) => request<void>("DELETE", `/messages/${encodeURIComponent(id)}`),
  pin: (slug: string, messageId: string | null) => request<void>("PUT", `${g(slug)}/pin`, { messageId }),
  markRead: (slug: string, messageId: string) => request<void>("PUT", `${g(slug)}/read`, { messageId }),
};

export function errorMessage(error: unknown): string {
  if (error instanceof ChatApiError) return error.message;
  return "Something went wrong. Try again in a moment.";
}
