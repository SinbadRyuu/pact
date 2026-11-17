// Client for /api/rankings and small hooks shared by both pages.
import { createElement, useEffect, useState, type ReactNode } from "react";
import { rankingsDeps } from "./adapters";

export const apiBase = () => rankingsDeps().apiBase ?? "/api/rankings";

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, { headers: { accept: "application/json" }, signal });
  if (!res.ok) throw Object.assign(new Error(`Request failed (${res.status})`), { status: res.status });
  return (await res.json()) as T;
}

/** Fetches whenever `path` changes; keeps showing the previous data while the next loads (no flash on filter change). */
export function useJson<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!path) return;
    const ctrl = new AbortController();
    setLoading(true);
    getJson<T>(path, ctrl.signal)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.status ?? 500);
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [path]);
  return { data, error, loading };
}

/** A query-string value kept in the address bar, so every view is a shareable link. */
export function useQueryParam(name: string, fallback: string): [string, (v: string) => void] {
  const read = () => (typeof location === "undefined" ? fallback : new URLSearchParams(location.search).get(name) ?? fallback);
  const [value, setValue] = useState(read);
  useEffect(() => {
    const onPop = () => setValue(read());
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  const set = (v: string) => {
    const p = new URLSearchParams(location.search);
    v === fallback ? p.delete(name) : p.set(name, v);
    const qs = p.toString();
    history.replaceState(history.state, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
    setValue(v);
  };
  return [value, set];
}

export function AppLink(props: { to: string; className?: string; children: ReactNode; "aria-label"?: string; "aria-current"?: "page" }) {
  const L = rankingsDeps().Link;
  if (L) return createElement(L, props);
  return createElement("a", { href: props.to, className: props.className, "aria-label": props["aria-label"], "aria-current": props["aria-current"] }, props.children);
}

export function usePageMeta(title: string, description: string) {
  const hook = rankingsDeps().usePageMeta;
  useEffect(() => {
    if (hook) return;
    document.title = title;
    let tag = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.name = "description";
      document.head.appendChild(tag);
    }
    tag.content = description;
  }, [hook, title, description]);
  hook?.({ title, description });
}

export const providerHref = (slug: string, period?: string) =>
  `/signals/providers/${encodeURIComponent(slug)}${period && period !== "this-week" ? `?period=${encodeURIComponent(period)}` : ""}`;
