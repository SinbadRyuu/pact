// A framework-free router for the chat API. Mount it at /api/v1/community/chat behind the app's existing
// session, CSRF and rate-limit middleware; it only needs the signed-in viewer.
//
//   GET    /groups                      list groups (archived ones too, for admins)
//   POST   /groups                      create a group                 (admins)
//   PUT    /groups/order                reorder groups                 (admins)
//   PATCH  /groups/:slug                edit, archive or restore       (admins)
//   GET    /groups/:slug/photo          the group's picture (image bytes)
//   PUT    /groups/:slug/photo          { image: "data:image/webp;base64,..." } (admins)
//   DELETE /groups/:slug/photo          remove the picture             (admins)
//   GET    /groups/:slug/messages       ?before=<id> | ?since=<cursor>, &limit=
//   POST   /groups/:slug/messages       send a message
//   PUT    /groups/:slug/pin            { messageId | null }           (admins, moderators)
//   PUT    /groups/:slug/read           { messageId }
//   PATCH  /messages/:id                edit your message
//   DELETE /messages/:id                delete your message (or any, for admins and moderators)
//
// There is deliberately no route that addresses a member: every message goes to a group.

import { CHAT_LIMITS, SLUG_PATTERN } from "../../shared/limits";
import { ChatError, notFound, unauthenticated } from "./errors";
import type { ChatViewer, CommunityChatService } from "./service";
import { parseLimit, parseMessageId, parseRev } from "./validation";

export interface ChatHttpRequest {
  method: string;
  /** The path after the mount point, e.g. "/groups/general-chat/messages". */
  path: string;
  query: Record<string, string | undefined>;
  body: unknown;
  viewer: ChatViewer | null;
}

export interface ChatHttpResponse {
  status: number;
  /** JSON, or raw bytes (a group picture) sent as they are with the response's own content-type. */
  body?: unknown;
  headers?: Record<string, string>;
}

type Handler = (viewer: ChatViewer, params: string[], req: ChatHttpRequest) => Promise<ChatHttpResponse>;

const SLUG = "([a-z0-9]+(?:-[a-z0-9]+)*)";
const ID = "(\\d{1,18})";

export function createChatHttpHandler(service: CommunityChatService) {
  const routes: Array<{ method: string; pattern: RegExp; handle: Handler }> = [
    { method: "GET", pattern: route("/groups"), handle: async (v) => ok(await service.listGroups(v)) },
    { method: "POST", pattern: route("/groups"), handle: async (v, _, r) => ({ status: 201, body: await service.createGroup(v, r.body) }) },
    { method: "PUT", pattern: route("/groups/order"), handle: async (v, _, r) => noContent(await service.reorderGroups(v, r.body)) },
    { method: "PATCH", pattern: route(`/groups/${SLUG}`), handle: async (v, [slug], r) => ok(await service.updateGroup(v, slug!, r.body)) },
    {
      method: "GET",
      pattern: route(`/groups/${SLUG}/photo`),
      handle: async (v, [slug], r) => {
        const photo = await service.getGroupPhoto(v, slug!);
        // The URL carries the version, so a matching request can be cached for good; anything else is revalidated.
        const current = r.query.v === photo.version;
        return {
          status: 200,
          body: photo.bytes,
          headers: {
            "content-type": photo.contentType,
            "cache-control": current ? "private, max-age=31536000, immutable" : "private, no-cache",
            etag: `"${photo.version}"`,
            "x-content-type-options": "nosniff",
            "content-security-policy": "default-src 'none'",
          },
        };
      },
    },
    { method: "PUT", pattern: route(`/groups/${SLUG}/photo`), handle: async (v, [slug], r) => ok(await service.setGroupPhoto(v, slug!, r.body)) },
    { method: "DELETE", pattern: route(`/groups/${SLUG}/photo`), handle: async (v, [slug]) => ok(await service.removeGroupPhoto(v, slug!)) },
    {
      method: "GET",
      pattern: route(`/groups/${SLUG}/messages`),
      handle: async (v, [slug], r) => {
        const { before, since } = r.query;
        const limit = parseLimit(r.query.limit, CHAT_LIMITS.pageSize, CHAT_LIMITS.pageSizeMax);
        if (before !== undefined && since !== undefined) throw new ChatError(400, "bad_request", "Use either before or since, not both.");
        return ok(
          await service.listMessages(v, slug!, {
            limit,
            ...(before !== undefined ? { before: parseMessageId(before, "before") } : {}),
            ...(since !== undefined ? { since: parseRev(since) } : {}),
          }),
        );
      },
    },
    {
      method: "POST",
      pattern: route(`/groups/${SLUG}/messages`),
      handle: async (v, [slug], r) => {
        const { message, duplicate } = await service.sendMessage(v, slug!, r.body);
        return { status: duplicate ? 200 : 201, body: message };
      },
    },
    { method: "PUT", pattern: route(`/groups/${SLUG}/pin`), handle: async (v, [slug], r) => noContent(await service.setPinned(v, slug!, r.body)) },
    {
      method: "PUT",
      pattern: route(`/groups/${SLUG}/read`),
      handle: async (v, [slug], r) => {
        const body = (r.body ?? {}) as { messageId?: unknown };
        return noContent(await service.markRead(v, slug!, parseMessageId(body.messageId)));
      },
    },
    { method: "PATCH", pattern: route(`/messages/${ID}`), handle: async (v, [id], r) => ok(await service.editMessage(v, id!, r.body)) },
    { method: "DELETE", pattern: route(`/messages/${ID}`), handle: async (v, [id]) => noContent(await service.deleteMessage(v, id!)) },
  ];

  return async function handleChatRequest(req: ChatHttpRequest): Promise<ChatHttpResponse> {
    try {
      const path = req.path.replace(/\/+$/, "") || "/";
      const matching = routes.map((r) => ({ r, m: r.pattern.exec(path) })).filter((x) => x.m);
      if (matching.length === 0) throw notFound();
      const hit = matching.find((x) => x.r.method === req.method.toUpperCase());
      if (!hit) {
        const allow = [...new Set(matching.map((x) => x.r.method))].join(", ");
        return { status: 405, headers: { allow }, body: new ChatError(405, "method_not_allowed", "This method is not allowed here.").toBody() };
      }
      if (!req.viewer) throw unauthenticated();
      return await hit.r.handle(req.viewer, hit.m!.slice(1), req);
    } catch (error) {
      if (error instanceof ChatError) {
        return {
          status: error.status,
          body: error.toBody(),
          ...(error.retryAfterSeconds ? { headers: { "retry-after": String(error.retryAfterSeconds) } } : {}),
        };
      }
      throw error;
    }
  };
}

function route(path: string) {
  return new RegExp(`^${path}$`);
}

const ok = (body: unknown): ChatHttpResponse => ({ status: 200, body });
const noContent = (_: void): ChatHttpResponse => ({ status: 204 });

export type ChatRequestHandler = ReturnType<typeof createChatHttpHandler>;

/**
 * Adapter for fetch-style servers (Hono, Elysia, itty-router, Next route handlers, Bun.serve).
 * `mountPath` is the prefix to strip, e.g. "/api/v1/community/chat".
 */
export function toFetchHandler(handle: ChatRequestHandler, options: { mountPath: string; getViewer: (request: Request) => Promise<ChatViewer | null> | ChatViewer | null }) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = url.pathname.startsWith(options.mountPath) ? url.pathname.slice(options.mountPath.length) : url.pathname;
    let body: unknown;
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "DELETE") {
      try {
        body = await request.json();
      } catch {
        body = undefined;
      }
    }
    try {
      const res = await handle({
        method: request.method,
        path,
        query: Object.fromEntries(url.searchParams),
        body,
        viewer: await options.getViewer(request),
      });
      return toResponse(res);
    } catch (error) {
      console.error("community chat request failed", error);
      return toResponse({ status: 500, body: new ChatError(500, "internal_error", "Something went wrong. Try again in a moment.").toBody() });
    }
  };
}

function toResponse(res: ChatHttpResponse): Response {
  const headers = new Headers({ "cache-control": "no-store", ...res.headers });
  if (res.status === 204 || res.body === undefined) return new Response(null, { status: res.status, headers });
  if (res.body instanceof Uint8Array) return new Response(new Uint8Array(res.body), { status: res.status, headers });
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(res.body), { status: res.status, headers });
}

/** The parts of an Express or Fastify request/response the adapter uses. */
interface NodeLikeRequest {
  method: string;
  path?: string;
  url?: string;
  query?: unknown;
  body?: unknown;
}
interface NodeLikeResponse {
  status(code: number): NodeLikeResponse;
  setHeader?(name: string, value: string): unknown;
  header?(name: string, value: string): unknown;
  json?(body: unknown): unknown;
  send?(body?: unknown): unknown;
  end?(chunk?: Uint8Array): unknown;
}

/**
 * Adapter for Express (`app.use("/api/v1/community/chat", express.json(), middleware)`) and similar servers.
 * Unexpected errors go to `next` so the app's own error handler logs them.
 */
export function toNodeMiddleware(handle: ChatRequestHandler, options: { getViewer: (req: NodeLikeRequest) => Promise<ChatViewer | null> | ChatViewer | null }) {
  return async (req: NodeLikeRequest, res: NodeLikeResponse, next: (error?: unknown) => void) => {
    try {
      const path = req.path ?? new URL(req.url ?? "/", "http://local").pathname;
      const rawQuery = (req.query ?? {}) as Record<string, unknown>;
      const query: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(rawQuery)) if (typeof v === "string") query[k] = v;
      const out = await handle({ method: req.method, path, query, body: req.body, viewer: await options.getViewer(req) });
      const setHeader = (name: string, value: string) => (res.setHeader ? res.setHeader(name, value) : res.header?.(name, value));
      setHeader("cache-control", "no-store");
      for (const [k, v] of Object.entries(out.headers ?? {})) setHeader(k, v);
      res.status(out.status);
      if (out.status === 204 || out.body === undefined) {
        if (res.end) res.end();
        else res.send?.();
      } else if (out.body instanceof Uint8Array) {
        // A Buffer, so Express and Fastify send the bytes as they are instead of serializing them.
        const bytes = Buffer.from(out.body.buffer, out.body.byteOffset, out.body.byteLength);
        if (res.end) res.end(bytes);
        else res.send?.(bytes);
      } else if (res.json) res.json(out.body);
      else res.send?.(out.body);
    } catch (error) {
      next(error);
    }
  };
}
