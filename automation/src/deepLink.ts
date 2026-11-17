// Opens The Sniper Bot in the VT Markets app on phones, falling back to the web share link when the app isn't installed.
//
// How it works
// - Desktop, or no app link set: the button is a normal link to SNIPER_BOT_COPY_LINK (new tab).
// - Android with VT_MARKETS_ANDROID_PACKAGE set and a custom-scheme app link: an intent:// URL. Chrome opens the
//   app if it's there and goes to the web link itself if it isn't (the most reliable option on Android).
// - Otherwise on a phone: try SNIPER_BOT_APP_LINK, and if the page is still visible after ~1.6s (the app didn't
//   open), go to the web link. If the app opened, the page is hidden and the timer is cancelled.
// - If SNIPER_BOT_COPY_LINK is itself a universal / app link (an https link VT Markets' app claims), phones with the
//   app open it there directly, and the fallback simply never fires.

export type Platform = "ios" | "android" | "desktop";

export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/macintosh/i.test(ua) && maxTouchPoints > 1) return "ios";
  return "desktop";
}

/** Builds an Android intent:// URL from a custom-scheme link, e.g. vtmarkets://copy/123 → intent://copy/123#Intent;… */
export function androidIntentUrl(appLink: string, pkg: string, fallback: string): string | null {
  const m = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(appLink);
  if (!m || /^https?$/i.test(m[1])) return null;
  return `intent://${m[2]}#Intent;scheme=${m[1]};package=${pkg};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}

export interface OpenLinks {
  webUrl: string;
  appUrl?: string | null;
  androidPackage?: string | null;
}

/** What the button should do on this device. Exported so it can be tested without a browser. */
export function planOpen(links: OpenLinks, platform: Platform): { kind: "web" } | { kind: "intent"; url: string } | { kind: "try-app"; url: string } {
  if (platform === "desktop" || !links.appUrl) return { kind: "web" };
  if (platform === "android" && links.androidPackage) {
    const intent = androidIntentUrl(links.appUrl, links.androidPackage, links.webUrl);
    if (intent) return { kind: "intent", url: intent };
  }
  return { kind: "try-app", url: links.appUrl };
}

interface WindowLike {
  location: { href: string };
  open: (url: string, target?: string, features?: string) => unknown;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  document: {
    visibilityState: string;
    addEventListener: (t: string, fn: () => void) => void;
    removeEventListener: (t: string, fn: () => void) => void;
  };
  addEventListener: (t: string, fn: () => void) => void;
  removeEventListener: (t: string, fn: () => void) => void;
}

/** Runs on click. Returns true when it handled navigation (the caller should preventDefault). */
export function openCopyLink(links: OpenLinks, platform: Platform, win: WindowLike = window as unknown as WindowLike, waitMs = 1600): boolean {
  const plan = planOpen(links, platform);
  if (plan.kind === "web") return false; // let the <a href target=_blank> do its normal thing

  if (plan.kind === "intent") {
    win.location.href = plan.url;
    return true;
  }

  let timer: unknown = null;
  const cancel = () => {
    if (timer !== null) win.clearTimeout(timer);
    timer = null;
    win.document.removeEventListener("visibilitychange", onHide);
    win.removeEventListener("pagehide", cancel);
  };
  const onHide = () => {
    if (win.document.visibilityState === "hidden") cancel();
  };
  win.document.addEventListener("visibilitychange", onHide);
  win.addEventListener("pagehide", cancel);
  timer = win.setTimeout(() => {
    const stillHere = win.document.visibilityState === "visible";
    cancel();
    if (stillHere) win.location.href = links.webUrl;
  }, waitMs);
  win.location.href = plan.url;
  return true;
}
