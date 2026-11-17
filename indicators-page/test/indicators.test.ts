// Indicators API: listing, filters, members-only access, download counting and the old chart URL redirect.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import pg from "pg";
import { legacyChartRedirect } from "../server/legacyRedirect";
import { createIndicatorsApi, defaultInstallSteps } from "../server/router";
import { createMemoryIndicatorStore, createPgIndicatorStore } from "../server/store";
import type { Sql } from "../server/types";
import { INDICATORS } from "./fixtures";

function setup(opts: { requireSubscription?: boolean; subscribers?: string[] } = {}) {
  const store = createMemoryIndicatorStore(INDICATORS);
  const signed: string[] = [];
  const api = createIndicatorsApi({
    store,
    getUser: async (req) => {
      const t = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
      return t ? { id: t } : null;
    },
    signFile: async (u) => {
      signed.push(u);
      return u.startsWith("storage:") ? `https://signed.example/${u.slice(8)}?token=t` : u;
    },
    isSubscriber: opts.requireSubscription ? async (u) => (opts.subscribers ?? []).includes(u.id) : undefined,
  });
  const call = async (method: string, path: string, user?: string) => {
    const res = (await api(new Request(`https://vtimpact.test/api/indicators${path}`, { method, headers: user ? { authorization: `Bearer ${user}` } : {} })))!;
    return { status: res.status, body: (await res.json()) as any };
  };
  return { call, store, signed };
}

describe("listing", () => {
  it("lists published indicators in order, without any file links", async () => {
    const { call } = setup();
    const r = await call("GET", "");
    assert.deepEqual(r.body.indicators.map((x: any) => x.slug), ["session-boxes", "vt-structure", "gold-volatility-bands"]);
    const raw = JSON.stringify(r.body);
    assert.ok(!raw.includes("files.vtimpact.test") && !raw.includes("storage:") && !raw.includes("tradingview.com/script"));
  });

  it("filters by platform and searches name/description", async () => {
    const { call } = setup();
    assert.deepEqual((await call("GET", "?platform=mt4")).body.indicators.map((x: any) => x.slug), ["gold-volatility-bands"]);
    assert.deepEqual((await call("GET", "?q=xauusd")).body.indicators.map((x: any) => x.slug), ["gold-volatility-bands"]);
    assert.equal((await call("GET", "?platform=nonsense")).body.indicators.length, 3);
  });

  it("marks members-only indicators locked for visitors and unlocked once signed in", async () => {
    const { call } = setup();
    const anon = (await call("GET", "")).body.indicators;
    assert.deepEqual(anon.filter((x: any) => x.locked).map((x: any) => [x.slug, x.lockReason]), [
      ["vt-structure", "sign_in"],
      ["gold-volatility-bands", "sign_in"],
    ]);
    const member = (await call("GET", "", "user_1")).body.indicators;
    assert.equal(member.filter((x: any) => x.locked).length, 0);
  });

  it("says TradingView or Download on the button", async () => {
    const { call } = setup();
    const byslug = Object.fromEntries((await call("GET", "")).body.indicators.map((x: any) => [x.slug, x.action]));
    assert.deepEqual(byslug, { "vt-structure": "tradingview", "session-boxes": "download", "gold-volatility-bands": "download" });
  });
});

describe("detail", () => {
  it("returns the full description, changelog and install steps", async () => {
    const { call } = setup();
    const d = (await call("GET", "/vt-structure")).body;
    assert.equal(d.name, "VT Structure");
    assert.equal(d.changelog[0].version, "1.0");
    assert.deepEqual(d.installSteps, defaultInstallSteps("tradingview"));
    assert.deepEqual((await call("GET", "/session-boxes")).body.installSteps, ["Copy the file into MQL5/Indicators."]);
    assert.equal((await call("GET", "/nope")).status, 404);
  });
});

describe("downloads", () => {
  it("free indicators download for anyone and are counted", async () => {
    const { call, store } = setup();
    const r = await call("POST", "/session-boxes/download");
    assert.equal(r.status, 200);
    assert.equal(r.body.url, "https://files.vtimpact.test/session-boxes.ex5");
    assert.equal(r.body.downloadCount, 1);
    assert.deepEqual(store.log, [{ id: INDICATORS[1].id, userId: null }]);
  });

  it("members-only: visitors get 401 and nothing is counted or signed", async () => {
    const { call, store, signed } = setup();
    const r = await call("POST", "/gold-volatility-bands/download");
    assert.equal(r.status, 401);
    assert.equal(r.body.url, undefined);
    assert.equal(store.log.length, 0);
    assert.equal(signed.length, 0);
  });

  it("members-only: signed-in members get a signed storage link, counted against them", async () => {
    const { call, store } = setup();
    const r = await call("POST", "/gold-volatility-bands/download", "user_7");
    assert.equal(r.status, 200);
    assert.equal(r.body.url, "https://signed.example/indicators/gold-volatility-bands-1.4.ex4?token=t");
    assert.deepEqual(store.log, [{ id: INDICATORS[2].id, userId: "user_7" }]);
  });

  it("'Get on TradingView' returns the script link and counts it", async () => {
    const { call } = setup();
    const r = await call("POST", "/vt-structure/download", "user_1");
    assert.equal(r.body.url, "https://www.tradingview.com/script/abc-vt-structure/");
    assert.equal(r.body.downloadCount, 42);
  });

  it("with INDICATORS_MEMBERS_REQUIRE_SUBSCRIPTION, signed-in non-subscribers get 403", async () => {
    const { call } = setup({ requireSubscription: true, subscribers: ["paid"] });
    assert.equal((await call("POST", "/vt-structure/download", "free_user")).status, 403);
    assert.equal((await call("GET", "/vt-structure", "free_user")).body.lockReason, "subscribe");
    assert.equal((await call("POST", "/vt-structure/download", "paid")).status, 200);
  });
});

describe("old chart page", () => {
  it("301s the old chart URLs to /indicators, keeping the query string", () => {
    const r = legacyChartRedirect(new Request("https://vtimpact.com/chart?ref=tiktok"))!;
    assert.equal(r.status, 301);
    assert.equal(r.headers.get("location"), "/indicators?ref=tiktok");
    assert.equal(legacyChartRedirect(new Request("https://vtimpact.com/charts/"))!.status, 301);
    assert.equal(legacyChartRedirect(new Request("https://vtimpact.com/app/chart/xauusd"))!.status, 301);
    assert.equal(legacyChartRedirect(new Request("https://vtimpact.com/chartered")), null);
    assert.equal(legacyChartRedirect(new Request("https://vtimpact.com/indicators")), null);
  });
});

const url = process.env.TEST_DATABASE_URL;
describe("Postgres store", { skip: !url && "set TEST_DATABASE_URL to run" }, () => {
  let pool: pg.Pool;
  let sql: Sql;
  before(async () => {
    pool = new pg.Pool({ connectionString: url });
    sql = { query: async (t, p) => (await pool.query(t, p as unknown[])).rows };
    await pool.query("drop table if exists public.indicator_downloads, public.indicators");
    for (const f of ["001_indicators.sql", "001_indicators.sql", "002_seed_vt_structure.sql", "002_seed_vt_structure.sql"]) {
      await pool.query(readFileSync(new URL(`../migrations/${f}`, import.meta.url), "utf8"));
    }
    await pool.query(
      `insert into public.indicators (slug, name, description, platform, file_url, access_level, published) values
       ('hidden-one', 'Hidden', 'x', 'mt4', 'https://x/y.ex4', 'free', false)`,
    );
  });
  after(async () => pool?.end());

  it("reads the seeded indicator, hides unpublished ones and counts downloads atomically", async () => {
    const store = createPgIndicatorStore(sql);
    const list = await store.list();
    assert.deepEqual(list.map((x) => x.slug), ["vt-structure"]);
    assert.equal(list[0].changelog[0].version, "1.0");
    assert.equal(list[0].accessLevel, "members");
    await Promise.all(Array.from({ length: 20 }, (_, i) => store.recordDownload(list[0].id, `u${i}`)));
    assert.equal((await store.bySlug("vt-structure"))!.downloadCount, 20);
    const [{ n }] = await sql.query<{ n: string }>("select count(*) n from public.indicator_downloads");
    assert.equal(Number(n), 20);
  });

  it("rejects a bad slug, platform or access level, and a row with no link", async () => {
    const bad = [
      `('Bad Slug', 'n', 'd', 'mt4', 'https://x', 'free')`,
      `('ok-slug', 'n', 'd', 'ctrader', 'https://x', 'free')`,
      `('ok-slug2', 'n', 'd', 'mt4', 'https://x', 'vip')`,
      `('ok-slug3', 'n', 'd', 'mt4', null, 'free')`,
    ];
    for (const v of bad) {
      await assert.rejects(pool.query(`insert into public.indicators (slug, name, description, platform, file_url, access_level) values ${v}`));
    }
  });
});
