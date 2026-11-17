// Preview routing. The page lives in ?page=… (so the file works when opened straight from disk, and the URL hash
// stays free for the Automation tabs). `as=` holds who you're previewing as, and survives every navigation.

export type Persona = "visitor" | "member" | "subscribed" | "payment_failed" | "cancelled";
export const PERSONAS: { key: Persona; label: string }[] = [
  { key: "visitor", label: "Visitor (signed out)" },
  { key: "member", label: "Member, not subscribed" },
  { key: "subscribed", label: "Subscribed" },
  { key: "payment_failed", label: "Payment failed" },
  { key: "cancelled", label: "Cancelled" },
];

export const persona = (): Persona => (new URLSearchParams(location.search).get("as") as Persona) || "visitor";
export const currentPage = () => new URLSearchParams(location.search).get("page") || "/home";

/** Turns an app path ("/signals/providers/x?period=y#tab") into a preview URL ("?page=/signals/providers/x&period=y&as=…#tab"). */
export function previewUrl(appPath: string, override: Record<string, string> = {}): string {
  const u = new URL(appPath, "https://app.local");
  const p = new URLSearchParams(u.search);
  p.set("page", u.pathname);
  p.set("as", override.as ?? persona());
  for (const [k, v] of Object.entries(override)) if (k !== "as") p.set(k, v);
  const shot = new URLSearchParams(location.search).get("shot");
  if (shot) p.set("shot", shot);
  return `${location.pathname}?${p.toString()}${u.hash}`;
}

export function navigate(url: string) {
  history.pushState(null, "", url);
  dispatchEvent(new Event("preview:navigate"));
  scrollTo(0, 0);
}
