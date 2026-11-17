// Small typed client for /api/automation, plus the hook that loads the page state.
import { useCallback, useEffect, useState } from "react";
import { automationDeps } from "./adapters";

export interface AutomationState {
  signedIn: boolean;
  priceLabel: string;
  subscription: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
  hasAccess: boolean;
  canManage: boolean;
  telegramLink: string | null;
  links: {
    vtMarketsSignup: string | null;
    sniperBotCopy: string | null;
    sniperBotApp: string | null;
    vtMarketsAndroidPackage: string | null;
    crucialMarkets: string | null;
  };
}

export interface FeedSignal {
  id: string;
  pair: string;
  direction: "BUY" | "SELL";
  entryFrom: number;
  entryTo: number | null;
  takeProfits: number[];
  stopLoss: number;
  status: string;
  targetsHit: number;
  notes: string | null;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(public status: number, public body: Record<string, unknown>) {
    super(String(body.error ?? `Request failed (${status})`));
  }
}

export async function api<T>(method: "GET" | "POST", path: string): Promise<T> {
  const d = automationDeps();
  const headers: Record<string, string> = { accept: "application/json" };
  const token = d.getAccessToken ? await d.getAccessToken() : null;
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${d.apiBase ?? "/api/automation"}${path}`, { method, headers, credentials: "include" });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const signInHref = (next: string) =>
  automationDeps().signInHref?.(next) ?? `/sign-in?next=${encodeURIComponent(next)}`;
export const signUpHref = (next: string) =>
  automationDeps().signUpHref?.(next) ?? `/sign-up?next=${encodeURIComponent(next)}`;

/** Starts Checkout. Signed-out people go to sign-up first and come back to /automation/subscribe. */
export async function startCheckout(): Promise<void> {
  try {
    const r = await api<{ url?: string; alreadySubscribed?: boolean }>("POST", "/checkout");
    if (r.url) window.location.assign(r.url);
    else if (r.alreadySubscribed) window.location.assign("/automation#instant-impact");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      window.location.assign(signUpHref("/automation/subscribe"));
      return;
    }
    if (err instanceof ApiError && err.status === 409) {
      window.location.assign("/automation#instant-impact");
      return;
    }
    throw err;
  }
}

export async function openPortal(): Promise<void> {
  const r = await api<{ url: string }>("POST", "/portal");
  window.location.assign(r.url);
}

/** Loads /state and reloads it when the session changes or the tab comes back into focus (e.g. back from the Portal). */
export function useAutomationState() {
  const session = automationDeps().useSession();
  const [state, setState] = useState<AutomationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<AutomationState>("GET", "/state")
      .then((s) => {
        setState(s);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!session.isPending) load();
  }, [session.isPending, session.data?.state, load]);
  useEffect(() => {
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [load]);
  return { state, error, reload: load, sessionPending: session.isPending };
}

export function usePageMeta(title: string, description: string) {
  const hook = automationDeps().usePageMeta;
  // Fall back to setting the tags directly when the app has no meta hook.
  useEffect(() => {
    if (hook) return;
    document.title = title;
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.name = "description";
      document.head.appendChild(tag);
    }
    tag.content = description;
  }, [hook, title, description]);
  hook?.({ title, description });
}
