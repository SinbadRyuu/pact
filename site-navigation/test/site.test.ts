// Nav entries, SEO meta (lengths, consistency with each feature's own seo.ts) and HTML meta injection.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AUTOMATION_SEO } from "../../automation/src/seo";
import { INDICATORS_SEO } from "../../indicators-page/src/seo";
import { RANKINGS_SEO } from "../../power-rankings/src/seo";
import { isActive, isNew, NEW_NAV_ITEMS, withNewItems } from "../src/nav";
import { injectMeta, PAGE_META, routeMeta, sitemapEntries } from "../src/seo";

describe("nav", () => {
  const [automation, indicators, rankings] = NEW_NAV_ITEMS;
  it("highlights the right item", () => {
    assert.ok(isActive(automation, "/automation/success"));
    assert.ok(!isActive(automation, "/automations-guide"));
    assert.ok(isActive(indicators, "/indicators/vt-structure"));
    assert.ok(isActive(indicators, "/chart"), "old chart URL still lights up Indicators while it redirects");
    assert.ok(isActive(rankings, "/signals/providers/gold-sniper"));
    assert.ok(!isActive(rankings, "/signals"));
  });

  it("slots Power Rankings, Automation, Indicators after Signals and drops the old chart link", () => {
    const existing = [{ href: "/" }, { href: "/signals" }, { href: "/chart" }, { href: "/education" }];
    const out = withNewItems(existing, (n) => ({ href: n.href }));
    assert.deepEqual(out.map((x) => x.href), ["/", "/signals", "/signals/rankings", "/automation", "/indicators", "/education"]);
  });

  it("shows the New badge until its date", () => {
    assert.equal(isNew(automation, new Date("2026-11-17")), true);
    assert.equal(isNew(automation, new Date("2027-02-01")), false);
    assert.equal(isNew(indicators), false);
  });
});

describe("SEO", () => {
  it("every title is ≤ 65 characters and every description 50–160", () => {
    const all = [
      ...Object.values(PAGE_META),
      routeMeta("/indicators/session-boxes")!,
      routeMeta("/signals/providers/gold-sniper")!,
      INDICATORS_SEO.detail({ name: "VT Structure", platform: "tradingview", description: "x".repeat(200) }),
      RANKINGS_SEO.provider("London Breakout"),
    ];
    for (const m of all) {
      assert.ok(m.title.length <= 65, `title too long (${m.title.length}): ${m.title}`);
      assert.ok(m.description.length >= 50 && m.description.length <= 160, `description ${m.description.length}: ${m.description}`);
    }
  });

  it("matches what each page sets once it loads", () => {
    assert.equal(PAGE_META["/automation"].title, AUTOMATION_SEO.automation.title);
    assert.equal(PAGE_META["/automation"].description, AUTOMATION_SEO.automation.description);
    assert.equal(PAGE_META["/indicators"].title, INDICATORS_SEO.list.title);
    assert.equal(PAGE_META["/signals/rankings"].title, RANKINGS_SEO.rankings.title);
    assert.equal(routeMeta("/signals/providers/gold-sniper")!.title, RANKINGS_SEO.provider("Gold Sniper").title);
  });

  it("injects one set of tags into the HTML and escapes them", () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>VT Impact</title><meta name="description" content="old"><meta property="og:title" content="old"></head><body></body></html>`;
    const out = injectMeta(html, "/signals/rankings/");
    assert.match(out, /<title>Signal Provider Power Rankings \| VT Impact<\/title>/);
    assert.equal(out.match(/name="description"/g)!.length, 1);
    assert.equal(out.match(/og:title/g)!.length, 1);
    assert.match(out, /<link rel="canonical" href="https:\/\/vtimpact\.com\/signals\/rankings">/);
    assert.match(injectMeta(html, "/automation/subscribe"), /noindex/);
    assert.equal(injectMeta(html, "/education"), html, "other pages untouched");
    assert.match(injectMeta(html, "/signals/providers/o-brien-fx"), /O Brien Fx/);
  });

  it("lists indexable pages in the sitemap", () => {
    const s = sitemapEntries("https://vtimpact.com", "2026-11-17");
    assert.match(s, /\/automation</);
    assert.match(s, /\/indicators</);
    assert.match(s, /\/signals\/rankings</);
    assert.doesNotMatch(s, /subscribe|success/);
  });
});
