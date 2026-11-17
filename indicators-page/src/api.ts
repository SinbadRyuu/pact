// Client for /api/indicators, the download action and page-meta helper.
import { createElement, useEffect, type ReactNode } from "react";
import { indicatorsDeps } from "./adapters";

export type Platform = "tradingview" | "mt4" | "mt5";

export interface IndicatorSummary {
  slug: string;
  name: string;
  description: string;
  platform: Platform;
  version: string;
  image: string | null;
  accessLevel: "free" | "members";
  updatedAt: string;
  downloadCount: number;
  action: "download" | "tradingview";
  locked: boolean;
  lockReason: "sign_in" | "subscribe" | null;
}

export interface IndicatorDetail extends IndicatorSummary {
  longDescription: string | null;
  screenshots: string[];
  installSteps: string[];
  changelog: { version: string; date: string; changes: string[] }[];
}

export const PLATFORM_LABEL: Record<Platform, string> = { tradingview: "TradingView", mt4: "MT4", mt5: "MT5" };

export class ApiError extends Error {
  constructor(public status: number) {
    super(`Request failed (${status})`);
  }
}

export async function api<T>(method: "GET" | "POST", path: string): Promise<T> {
  const d = indicatorsDeps();
  const headers: Record<string, string> = { accept: "application/json" };
  const token = d.getAccessToken ? await d.getAccessToken() : null;
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${d.apiBase ?? "/api/indicators"}${path}`, { method, headers, credentials: "include" });
  if (!res.ok) throw new ApiError(res.status);
  return (await res.json()) as T;
}

export const signInHref = (next: string) => indicatorsDeps().signInHref?.(next) ?? `/sign-in?next=${encodeURIComponent(next)}`;
export const subscribeHref = () => indicatorsDeps().subscribeHref ?? "/automation#instant-impact";

/** Where a locked button sends people. */
export function unlockHref(ind: Pick<IndicatorSummary, "lockReason" | "slug">) {
  return ind.lockReason === "subscribe" ? subscribeHref() : signInHref(`/indicators/${ind.slug}`);
}

export function buttonLabel(ind: Pick<IndicatorSummary, "locked" | "lockReason" | "action">) {
  if (ind.locked) return ind.lockReason === "subscribe" ? "Subscribe to unlock" : "Sign in to download";
  return ind.action === "tradingview" ? "Get on TradingView" : "Download";
}

/**
 * Asks the server for the link (it checks access and counts the download), then opens it in this tab.
 * Same-tab works in TikTok/Instagram in-app browsers, where pop-ups are blocked.
 */
export async function download(slug: string): Promise<number | null> {
  try {
    const r = await api<{ url: string; downloadCount: number }>("POST", `/${encodeURIComponent(slug)}/download`);
    window.location.assign(r.url);
    return r.downloadCount;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) window.location.assign(signInHref(`/indicators/${slug}`));
    else if (err instanceof ApiError && err.status === 403) window.location.assign(subscribeHref());
    else throw err;
    return null;
  }
}

export function AppLink(props: { to: string; className?: string; children: ReactNode; "aria-label"?: string }) {
  const L = indicatorsDeps().Link;
  if (L) return createElement(L, props);
  return createElement("a", { href: props.to, className: props.className, "aria-label": props["aria-label"] }, props.children);
}

export function usePageMeta(title: string, description: string, image?: string | null) {
  const hook = indicatorsDeps().usePageMeta;
  useEffect(() => {
    if (hook) return;
    document.title = title;
    const set = (attr: "name" | "property", key: string, value: string) => {
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attr, key);
        document.head.appendChild(tag);
      }
      tag.content = value;
    };
    set("name", "description", description);
    set("property", "og:title", title);
    set("property", "og:description", description);
    if (image) set("property", "og:image", image);
  }, [hook, title, description, image]);
  hook?.({ title, description, image });
}

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

export const formatCount = (n: number) => new Intl.NumberFormat("en-GB", { notation: n >= 10_000 ? "compact" : "standard" }).format(n);
