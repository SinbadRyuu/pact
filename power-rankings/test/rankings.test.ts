// Power Rankings: the numbers match a manual calculation, ranking rules, periods (incl. DST), the API and CSV.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jumpOptions, resolvePeriod } from "../shared/periods";
import type { ProviderProfileResponse, RankingsResponse, TradesResponse } from "../shared/types";
import { createRankingsApi, readRankingsConfig, tradesCsv } from "../server/router";
import { computeStats, downsample, equityCurve, outcome } from "../server/stats";
import { createMemoryRankingsStore } from "../server/store";
import { GOLD_WEEK_46, MANUAL_GOLD_WEEK_46, NOW, PROVIDERS, TRADES } from "./fixtures";


function api(env: Record<string, string> = {}) {
  const handler = createRankingsApi({
    store: createMemoryRankingsStore(PROVIDERS, TRADES),
    config: readRankingsConfig({ RANKINGS_CACHE_SECONDS: "0", ...env }),
    now: () => NOW,
  });
  return async <T>(path: string): Promise<{ status: number; body: T; res: Response }> => {
    const res = (await handler(new Request(`https://vtimpact.test/api/rankings${path}`)))!;
    const ct = res.headers.get("content-type") ?? "";
    return { status: res.status, res, body: (ct.includes("json") ? await res.clone().json() : await res.clone().text()) as T };
  };
}

describe("stats match a manual calculation (Gold Sniper, week 46 of 2026)", () => {
  it("computeStats on the raw trades", () => {
    const s = computeStats(GOLD_WEEK_46.map((t) => ({ providerId: t.providerId, pair: t.pair, pips: t.resultPips!, closedAt: Date.parse(t.closedAt!) })));
    assert.deepEqual(s, MANUAL_GOLD_WEEK_46);
  });

  it("the API returns the same numbers for ?period=week:2026-W46 and ?period=last-week", async () => {
    const call = api();
    for (const key of ["week:2026-W46", "last-week"]) {
      const { body } = await call<RankingsResponse>(`?period=${key}`);
      const gold = body.rows.find((r) => r.provider.slug === "gold-sniper")!;
      assert.deepEqual(gold.stats, MANUAL_GOLD_WEEK_46, key);
    }
  });

  it("the profile page shows the same stats, the equity curve and one month", async () => {
    const { body } = await api()<ProviderProfileResponse>("/providers/gold-sniper?period=week:2026-W46");
    assert.deepEqual(body.stats, MANUAL_GOLD_WEEK_46);
    assert.deepEqual(body.equity.map((p) => p.v), [45, 15, 75, 75, 50, 10, 0, 80, 115, 135]);
    assert.deepEqual(body.equity.map((p) => p.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(body.monthly, [{ month: "2026-11", pips: 135, trades: 10, wins: 5, winRate: 50 }]);
    assert.equal(body.live.length, 1, "the running trade is live, not in the stats");
  });
});

describe("ranking rules", () => {
  it("ranks by net pips, keeps under-10-trade providers off the podium, and shows rank change", async () => {
    const { body } = await api()<RankingsResponse>("?period=week:2026-W46");
    assert.deepEqual(
      body.rows.map((r) => [r.provider.slug, r.rank, r.rankChange, r.stats.netPips]),
      [
        ["steady-fx", 1, 1, 180], // was #2 → up 1
        ["gold-sniper", 2, -1, 135], // was #1 → down 1
        ["range-rider", 3, "new", -20],
        ["lucky-one", null, null, 500], // most pips, but 1 trade: listed, unranked
      ],
    );
    assert.equal(body.minTrades, 10);
    assert.ok(!body.rows.some((r) => r.provider.slug === "quiet-desk"), "providers with no trades in the period are left out");
    assert.ok(body.rows[0].equity.length > 0 && body.rows[3].equity.length === 0, "mini curves only for the podium");
  });

  it("RANKINGS_MIN_TRADES changes who qualifies", async () => {
    const { body } = await api({ RANKINGS_MIN_TRADES: "1" })<RankingsResponse>("?period=week:2026-W46");
    assert.equal(body.rows[0].provider.slug, "lucky-one");
  });

  it("RANKINGS_BREAKEVEN_PIPS widens what counts as breakeven", () => {
    assert.equal(outcome(0), "BE");
    assert.equal(outcome(0.4), "W");
    assert.equal(outcome(0.4, 0.5), "BE");
    assert.equal(outcome(-0.5, 0.5), "BE");
  });

  it("profit factor is ∞ with no losses, and empty stats are zeros", () => {
    const s = computeStats([{ providerId: "x", pair: "EURUSD", pips: 10, closedAt: 1 }]);
    assert.equal(s.profitFactor, "inf");
    const e = computeStats([]);
    assert.equal(e.trades, 0);
    assert.equal(e.profitFactor, null);
    assert.equal(e.streak, null);
  });

  it("downsampling keeps the ends and the extremes", () => {
    const pts = equityCurve(Array.from({ length: 1000 }, (_, i) => ({ providerId: "x", pair: "X", pips: i === 500 ? -900 : 1, closedAt: i })));
    const d = downsample(pts, 40);
    assert.ok(d.length <= 40);
    assert.equal(d[0], pts[0]);
    assert.equal(d.at(-1), pts.at(-1));
    assert.ok(d.some((p) => p.v === Math.min(...pts.map((x) => x.v))), "the drawdown low survives");
    assert.equal(d.at(-1)!.n, 1000, "points keep their real trade number");
  });
});

describe("periods", () => {
  const tz = "Europe/London";
  it("resolves the quick periods relative to now", () => {
    const iso = (k: string) => {
      const p = resolvePeriod(k, NOW, tz);
      return [p.start?.toISOString(), p.end.toISOString(), p.prevStart?.toISOString()];
    };
    assert.deepEqual(iso("this-week"), ["2026-11-16T00:00:00.000Z", "2026-11-23T00:00:00.000Z", "2026-11-09T00:00:00.000Z"]);
    assert.deepEqual(iso("last-week"), ["2026-11-09T00:00:00.000Z", "2026-11-16T00:00:00.000Z", "2026-11-02T00:00:00.000Z"]);
    // 1 Oct and 1 Sep are in British Summer Time, so London midnight is 23:00 UTC the day before.
    assert.deepEqual(iso("this-month"), ["2026-11-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z", "2026-09-30T23:00:00.000Z"]);
    assert.deepEqual(iso("last-month"), ["2026-09-30T23:00:00.000Z", "2026-11-01T00:00:00.000Z", "2026-08-31T23:00:00.000Z"]);
    assert.deepEqual(iso("this-year"), ["2026-01-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z", "2025-01-01T00:00:00.000Z"]);
    assert.deepEqual(iso("last-year"), ["2025-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z", "2024-01-01T00:00:00.000Z"]);
    assert.equal(resolvePeriod("all", NOW, tz).start, null);
    assert.equal(resolvePeriod("garbage", NOW, tz).key, "this-week");
  });

  it("uses London midnight across the clock change (week 43 starts in BST, ends in GMT)", () => {
    const p = resolvePeriod("week:2026-W43", NOW, tz);
    assert.equal(p.start!.toISOString(), "2026-10-18T23:00:00.000Z"); // Mon 19 Oct 00:00 BST
    assert.equal(p.end.toISOString(), "2026-10-26T00:00:00.000Z"); // Mon 26 Oct 00:00 GMT
    assert.equal(resolvePeriod("month:2026-07", NOW, tz).start!.toISOString(), "2026-06-30T23:00:00.000Z");
  });

  it("handles ISO week 53 and the year boundary", () => {
    const p = resolvePeriod("week:2026-W53", NOW, tz); // 2026 has 53 ISO weeks: Mon 28 Dec 2026 – Sun 3 Jan 2027
    assert.equal(p.start!.toISOString(), "2026-12-28T00:00:00.000Z");
    assert.equal(p.end.toISOString(), "2027-01-04T00:00:00.000Z");
  });

  it("custom ranges are inclusive, accept reversed dates, and compare to the same length before", () => {
    const p = resolvePeriod("custom:2026-11-15..2026-11-09", NOW, tz);
    assert.equal(p.key, "custom:2026-11-15..2026-11-09");
    assert.equal(p.start!.toISOString(), "2026-11-09T00:00:00.000Z");
    assert.equal(p.end.toISOString(), "2026-11-16T00:00:00.000Z");
    assert.equal(p.prevStart!.toISOString(), "2026-11-02T00:00:00.000Z");
    assert.equal(resolvePeriod("custom:2026-02-30..2026-03-01", NOW, tz).key, "this-week", "invalid date falls back");
  });

  it("jump-to options: 26 weeks, 24 months, every year since the first trade", () => {
    const j = jumpOptions(NOW, tz, 2024);
    assert.equal(j.weeks.length, 26);
    assert.equal(j.weeks[0].key, "week:2026-W47");
    assert.equal(j.months[0].key, "month:2026-11");
    assert.deepEqual(j.years.map((y) => y.key), ["year:2026", "year:2025", "year:2024"]);
  });
});

describe("trade history and CSV", () => {
  it("paginates, filters by pair and date, sorts", async () => {
    const call = api();
    const all = (await call<TradesResponse>("/providers/gold-sniper/trades?pageSize=5")).body;
    assert.equal(all.total, 23);
    assert.equal(all.rows.length, 5);
    assert.equal(all.rows[0].closedAt, "2026-11-16T00:00:00.000Z", "newest first");

    const xau = (await call<TradesResponse>("/providers/gold-sniper/trades?pair=GBPJPY")).body;
    assert.equal(xau.total, 2);

    const week = (await call<TradesResponse>("/providers/gold-sniper/trades?from=2026-11-09&to=2026-11-15&sort=result_pips&dir=desc&pageSize=100")).body;
    assert.equal(week.total, 11, "10 closed + the live one opened that week");
    assert.equal(week.rows[0].resultPips, 80);
    assert.equal(week.rows.at(-1)!.resultPips, null, "live trade (no result yet) sorts last");

    const p2 = (await call<TradesResponse>("/providers/gold-sniper/trades?pageSize=10&page=3")).body;
    assert.equal(p2.rows.length, 3);
  });

  it("exports CSV with a header, safe cells, and the filters applied", async () => {
    const { res, body } = await api()<string>("/providers/gold-sniper/trades.csv?from=2026-11-09&to=2026-11-15");
    assert.match(res.headers.get("content-disposition")!, /gold-sniper-trades\.csv/);
    const lines = body.trim().split("\r\n");
    assert.equal(lines.length, 12);
    assert.ok(lines[0].endsWith("opened_at,closed_at,pair,direction,entry,entry_to,stop_loss,tp_hit,result_pips,status"));
    assert.equal(tradesCsv([{ ...GOLD_WEEK_46[0], pair: "=HYPERLINK(1)" }]).split("\r\n")[1].split(",")[2], "'=HYPERLINK(1)");
  });

  it("404s an unknown provider", async () => {
    assert.equal((await api()("/providers/nobody")).status, 404);
    assert.equal((await api()("/providers/nobody/trades")).status, 404);
  });
});
