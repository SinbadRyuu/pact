import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { androidIntentUrl, detectPlatform, openCopyLink, planOpen } from "../src/deepLink";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 TikTok";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15";
const links = { webUrl: "https://vtm.example/copy/sniper", appUrl: "vtmarkets://copytrading/strategy/sniper" };

function fakeWindow(visibleAfter: boolean) {
  const timers: (() => void)[] = [];
  const listeners = new Map<string, () => void>();
  const win = {
    location: { href: "https://vtimpact.com/automation" },
    open: () => null,
    setTimeout: (fn: () => void) => timers.push(fn),
    clearTimeout: (id: unknown) => {
      timers[(id as number) - 1] = () => {};
    },
    document: {
      visibilityState: "visible",
      addEventListener: (t: string, fn: () => void) => listeners.set(t, fn),
      removeEventListener: (t: string) => listeners.delete(t),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return {
    win,
    hrefs: () => win.location.href,
    finish() {
      if (!visibleAfter) {
        win.document.visibilityState = "hidden";
        listeners.get("visibilitychange")?.();
      }
      timers.forEach((t) => t());
    },
  };
}

describe("Sniper Bot copy link", () => {
  it("detects phones, including in-app browsers and iPadOS", () => {
    assert.equal(detectPlatform(IPHONE), "ios");
    assert.equal(detectPlatform(ANDROID), "android");
    assert.equal(detectPlatform(MAC), "desktop");
    assert.equal(detectPlatform(MAC, 5), "ios");
  });

  it("desktop uses the web link", () => {
    assert.deepEqual(planOpen(links, "desktop"), { kind: "web" });
  });

  it("phones with no app link set use the web link", () => {
    assert.deepEqual(planOpen({ webUrl: links.webUrl }, "ios"), { kind: "web" });
  });

  it("Android with a package name builds an intent:// link with the web fallback inside", () => {
    const url = androidIntentUrl(links.appUrl, "com.vtmarkets.app", links.webUrl)!;
    assert.equal(
      url,
      "intent://copytrading/strategy/sniper#Intent;scheme=vtmarkets;package=com.vtmarkets.app;S.browser_fallback_url=https%3A%2F%2Fvtm.example%2Fcopy%2Fsniper;end",
    );
    assert.equal(androidIntentUrl("https://vtm.example/x", "p", "f"), null);
  });

  it("tries the app first, then falls back to the web link when the app doesn't open", () => {
    const f = fakeWindow(true);
    assert.equal(openCopyLink(links, "ios", f.win), true);
    assert.equal(f.hrefs(), links.appUrl);
    f.finish();
    assert.equal(f.hrefs(), links.webUrl);
  });

  it("doesn't fall back when the app opened (page hidden)", () => {
    const f = fakeWindow(false);
    openCopyLink(links, "ios", f.win);
    f.finish();
    assert.equal(f.hrefs(), links.appUrl);
  });
});
