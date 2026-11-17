// Runs the real migration (views + indexes) on Postgres and checks the API gives the same, hand-checked numbers.
// Skipped unless TEST_DATABASE_URL points at a throwaway database (it drops/creates channels and signals).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import pg from "pg";
import type { ProviderProfileResponse, RankingsResponse, TradesResponse } from "../shared/types";
import { createRankingsApi, readRankingsConfig } from "../server/router";
import { createMemoryRankingsStore, createPgRankingsStore } from "../server/store";
import type { Sql } from "../server/types";
import { MANUAL_GOLD_WEEK_46, NOW, PROVIDERS, TRADES } from "./fixtures";

const url = process.env.TEST_DATABASE_URL;

describe("Postgres views and indexes", { skip: !url && "set TEST_DATABASE_URL to run" }, () => {
  let pool: pg.Pool;
  let sql: Sql;
  const ids = new Map<string, string>(); // provider id → channel uuid

  before(async () => {
    pool = new pg.Pool({ connectionString: url });
    sql = { query: async (t, p) => (await pool.query(t, p as unknown[])).rows };
    await pool.query("drop view if exists public.ranking_trades, public.ranking_providers");
    await pool.query("drop table if exists public.signals, public.channels cascade");
    // The Trade Room tables (trade-room-signals/README.md) plus the two columns the site logs.
    await pool.query(`create table public.channels (id uuid primary key default gen_random_uuid(), name text not null, icon_url text)`);
    await pool.query(`create table public.signals (
      id bigserial primary key, channel_id uuid references public.channels(id), direction text, instrument text,
      entry_from numeric, entry_to numeric, take_profits numeric[] not null default '{}', stop_loss numeric,
      status text not null default 'active', targets_hit int not null default 0, notes text,
      created_at timestamptz not null default now(), result_pips numeric, closed_at timestamptz)`);
    for (const p of PROVIDERS) {
      const r = await pool.query(`insert into public.channels (name) values ($1) returning id`, [p.name]);
      ids.set(p.id, r.rows[0].id);
    }
    for (const t of TRADES) {
      await pool.query(
        `insert into public.signals (channel_id, direction, instrument, entry_from, stop_loss, status, targets_hit, created_at, result_pips, closed_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [ids.get(t.providerId), t.direction.toLowerCase(), t.pair, t.entry, t.stopLoss, t.status, t.tpHit, t.openedAt, t.resultPips, t.closedAt],
      );
    }
    const migration = readFileSync(new URL("../migrations/001_rankings_views.sql", import.meta.url), "utf8");
    await pool.query(migration);
    await pool.query(migration); // safe to run twice
  });
  after(async () => pool?.end());

  const pgApi = () =>
    createRankingsApi({ store: createPgRankingsStore(sql), config: readRankingsConfig({ RANKINGS_CACHE_SECONDS: "0" }), now: () => NOW });
  const get = async <T>(handler: ReturnType<typeof pgApi>, path: string) =>
    (await (await handler(new Request(`https://x/api/rankings${path}`)))!.json()) as T;

  it("slugs come from channel names", async () => {
    const providers = await createPgRankingsStore(sql).providers();
    assert.deepEqual(providers.map((p) => p.slug), ["gold-sniper", "lucky-one", "quiet-desk", "range-rider", "steady-fx"]);
  });

  it("Gold Sniper week 46 matches the manual calculation, read through the views", async () => {
    const board = await get<RankingsResponse>(pgApi(), "?period=week:2026-W46");
    assert.deepEqual(board.rows.find((r) => r.provider.slug === "gold-sniper")!.stats, MANUAL_GOLD_WEEK_46);
    const prof = await get<ProviderProfileResponse>(pgApi(), "/providers/gold-sniper?period=last-week");
    assert.deepEqual(prof.stats, MANUAL_GOLD_WEEK_46);
    assert.equal(prof.live.length, 1);
  });

  it("every period gives the same leaderboard as the in-memory reference", async () => {
    const mem = createRankingsApi({ store: createMemoryRankingsStore(PROVIDERS, TRADES), config: readRankingsConfig({ RANKINGS_CACHE_SECONDS: "0" }), now: () => NOW });
    for (const key of ["this-week", "last-week", "this-month", "all", "week:2026-W45", "custom:2026-11-01..2026-11-30"]) {
      const a = await get<RankingsResponse>(pgApi(), `?period=${key}`);
      const b = await get<RankingsResponse>(mem, `?period=${key}`);
      const pick = (r: RankingsResponse) => r.rows.map((x) => [x.provider.slug, x.rank, x.rankChange, x.stats]);
      assert.deepEqual(pick(a), pick(b), key);
    }
  });

  it("trade history paginates and filters in SQL", async () => {
    const t = await get<TradesResponse>(pgApi(), "/providers/gold-sniper/trades?from=2026-11-09&to=2026-11-15&sort=result_pips&dir=desc&pageSize=5&page=1");
    assert.equal(t.total, 11);
    assert.equal(t.rows[0].resultPips, 80);
    const last = await get<TradesResponse>(pgApi(), "/providers/gold-sniper/trades?from=2026-11-09&to=2026-11-15&sort=result_pips&dir=desc&pageSize=5&page=3");
    assert.equal(last.rows.length, 1);
    assert.equal(last.rows[0].resultPips, null);
  });

  it("stays fast with 200,000 trades: index scans, and a week's board well under a second", async () => {
    await pool.query(`insert into public.signals (channel_id, direction, instrument, entry_from, stop_loss, status, created_at, result_pips, closed_at)
      select (select id from public.channels order by name offset (g % 5) limit 1), 'buy', 'XAUUSD', 4000, 3990,
             'take_profit', ts - interval '2 hours', (g % 41) - 20, ts
        from generate_series(1, 200000) g, lateral (select timestamptz '2020-01-01' + (g * interval '13 minutes') as ts) x`);
    await pool.query("analyze public.signals");

    const plan = (await pool.query(
      `explain select provider_id, pair, result_pips, closed_at from public.ranking_trades
        where not is_open and closed_at is not null and result_pips is not null and closed_at < $1 and closed_at >= $2 order by closed_at, id`,
      ["2026-11-16", "2026-11-09"],
    )).rows.map((r) => r["QUERY PLAN"]).join("\n");
    assert.match(plan, /Index/, plan);

    const profilePlan = (await pool.query(
      `explain select count(*) from public.ranking_trades where provider_id = $1 and closed_at >= $2`,
      [ids.get("p-gold"), "2026-11-01"],
    )).rows.map((r) => r["QUERY PLAN"]).join("\n");
    assert.match(profilePlan, /signals_provider_closed_idx/, profilePlan);

    const t0 = performance.now();
    await get<RankingsResponse>(pgApi(), "?period=this-week");
    const week = performance.now() - t0;
    const t1 = performance.now();
    await get<RankingsResponse>(pgApi(), "?period=all");
    const all = performance.now() - t1;
    console.log(`    board timings with 200k trades: this-week ${week.toFixed(0)}ms, all time ${all.toFixed(0)}ms`);
    assert.ok(week < 1000, `this-week took ${week}ms`);
  });
});
