// Power Rankings API as one Fetch-style handler, mounted at /api/rankings/*. Public: no sign-in needed.
//
//   GET /api/rankings?period=this-week                          podium + leaderboard + live trades
//   GET /api/rankings/providers/:slug?period=…                  one provider: stats, equity, monthly, live
//   GET /api/rankings/providers/:slug/trades?from&to&pair&sort&dir&page&pageSize     trade history (paginated)
//   GET /api/rankings/providers/:slug/trades.csv?from&to&pair&sort&dir                the same, as CSV
//
// Results are cached in memory for RANKINGS_CACHE_SECONDS (default 60) and sent with a matching Cache-Control,
// so a burst of TikTok traffic hits the database once a minute, not once a visit.
import { DEFAULT_TIMEZONE, type Period, resolvePeriod, zonedMidnight } from "../shared/periods";
import {
  type LeaderboardRow,
  type ProviderProfileResponse,
  type RankingsResponse,
  TRADE_SORTS,
  type TradeSort,
  type TradesResponse,
} from "../shared/types";
import { byProvider, downsample, equityCurve, monthlyBreakdown, rankChange, rankProviders } from "./stats";
import type { RankingsStore } from "./store";

export interface RankingsConfig {
  /** Closed trades needed in the period to be ranked / reach the podium. Default 10. */
  minTrades: number;
  /** |pips| at or below this counts as breakeven. Default 0. */
  breakevenPips: number;
  timezone: string;
  cacheSeconds: number;
}

export function readRankingsConfig(env: Record<string, string | undefined>): RankingsConfig {
  const n = (k: string, d: number) => (env[k] !== undefined && env[k] !== "" && Number.isFinite(Number(env[k])) ? Number(env[k]) : d);
  return {
    minTrades: Math.max(1, Math.floor(n("RANKINGS_MIN_TRADES", 10))),
    breakevenPips: Math.max(0, n("RANKINGS_BREAKEVEN_PIPS", 0)),
    timezone: env.RANKINGS_TIMEZONE || DEFAULT_TIMEZONE,
    cacheSeconds: Math.max(0, n("RANKINGS_CACHE_SECONDS", 60)),
  };
}

export interface RankingsApiDeps {
  store: RankingsStore;
  config: RankingsConfig;
  basePath?: string;
  now?: () => Date;
  log?: (msg: string, extra?: unknown) => void;
}

const MAX_CSV_ROWS = 50_000;

export function createRankingsApi(deps: RankingsApiDeps) {
  const base = (deps.basePath ?? "/api/rankings").replace(/\/+$/, "");
  const now = deps.now ?? (() => new Date());
  const { config, store } = deps;
  const cache = new Map<string, { at: number; value: unknown }>();

  async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < config.cacheSeconds * 1000) return hit.value as T;
    const value = await fn();
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return value;
  }

  const periodInfo = (p: Period) => ({ key: p.key, label: p.label, start: p.start?.toISOString() ?? null, end: p.end.toISOString() });

  /** Ranks for the period, plus each ranked provider's previous rank. */
  async function rankings(period: Period) {
    // When the previous period sits inside this one (all time vs. all time a week ago), filter the trades already
    // loaded instead of reading the whole history a second time.
    const prevInside =
      (period.start === null || (period.prevStart !== null && period.prevStart >= period.start)) && period.prevEnd <= period.end;
    const [providers, trades] = await Promise.all([store.providers(), store.closedTrades(period.start, period.end)]);
    const prevTrades = prevInside
      ? trades.filter((t) => t.closedAt < period.prevEnd.getTime() && (period.prevStart === null || t.closedAt >= period.prevStart.getTime()))
      : await store.closedTrades(period.prevStart, period.prevEnd);
    const ranked = rankProviders(providers, byProvider(trades), config.minTrades, config.breakevenPips);
    const prevRanks = new Map(
      rankProviders(providers, byProvider(prevTrades), config.minTrades, config.breakevenPips)
        .filter((r) => r.rank !== null)
        .map((r) => [r.provider.id, r.rank!]),
    );
    return { providers, ranked, prevRanks };
  }

  async function leaderboard(periodKey: string | null): Promise<RankingsResponse> {
    const period = resolvePeriod(periodKey, now(), config.timezone);
    return cached(`board:${period.key}`, async () => {
      const [{ providers, ranked, prevRanks }, open, firstYear] = await Promise.all([rankings(period), store.openTrades(), store.firstTradeYear()]);
      const liveCount = new Map<string, number>();
      for (const t of open) liveCount.set(t.providerId, (liveCount.get(t.providerId) ?? 0) + 1);
      const byId = new Map(providers.map((p) => [p.id, p]));
      const rows: LeaderboardRow[] = ranked.map((r) => ({
        provider: r.provider,
        rank: r.rank,
        rankChange: rankChange(r.rank, prevRanks.get(r.provider.id)),
        stats: r.stats,
        // Podium cards draw a mini curve; 40 points is plenty at that size.
        equity: r.rank !== null && r.rank <= 3 ? downsample(equityCurve(r.trades), 40) : [],
        liveTrades: liveCount.get(r.provider.id) ?? 0,
      }));
      return {
        period: periodInfo(period),
        timezone: config.timezone,
        minTrades: config.minTrades,
        firstTradeYear: firstYear,
        rows,
        live: open.filter((t) => byId.has(t.providerId)).slice(0, 20).map((t) => ({ ...t, provider: byId.get(t.providerId)! })),
        generatedAt: new Date().toISOString(),
      };
    });
  }

  async function profile(slug: string, periodKey: string | null): Promise<ProviderProfileResponse | null> {
    const period = resolvePeriod(periodKey, now(), config.timezone);
    return cached(`profile:${slug}:${period.key}`, async () => {
      const { providers, ranked, prevRanks } = await rankings(period);
      const provider = providers.find((p) => p.slug === slug);
      if (!provider) return null;
      const row = ranked.find((r) => r.provider.id === provider.id);
      const trades = row?.trades ?? [];
      const [pairs, live, firstYear] = await Promise.all([store.pairs(provider.id), store.openTrades(provider.id), store.firstTradeYear()]);
      const stats = row?.stats ?? rankProviders([provider], new Map([[provider.id, []]]), 1)[0].stats;
      return {
        period: periodInfo(period),
        timezone: config.timezone,
        minTrades: config.minTrades,
        firstTradeYear: firstYear,
        provider,
        rank: row?.rank ?? null,
        rankChange: rankChange(row?.rank ?? null, prevRanks.get(provider.id)),
        rankedOf: ranked.filter((r) => r.rank !== null).length,
        stats,
        equity: downsample(equityCurve(trades), 300),
        monthly: monthlyBreakdown(trades, config.timezone, config.breakevenPips),
        pairs,
        live,
      };
    });
  }

  /** from/to are calendar dates (YYYY-MM-DD, inclusive) in the rankings time zone. */
  function historyFilter(url: URL, providerId: string, paged: boolean) {
    const day = (s: string | null) => {
      const m = s && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
    };
    const from = day(url.searchParams.get("from"));
    const to = day(url.searchParams.get("to"));
    const toNext = to ? new Date(Date.UTC(to.y, to.m - 1, to.d + 1)) : null;
    const sortParam = url.searchParams.get("sort") as TradeSort | null;
    const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get("pageSize")) || 25));
    const page = Math.max(1, Math.floor(Number(url.searchParams.get("page")) || 1));
    return {
      page,
      pageSize,
      filter: {
        providerId,
        from: from ? zonedMidnight(from, config.timezone) : null,
        to: toNext ? zonedMidnight({ y: toNext.getUTCFullYear(), m: toNext.getUTCMonth() + 1, d: toNext.getUTCDate() }, config.timezone) : null,
        pair: url.searchParams.get("pair") || null,
        sort: sortParam && (TRADE_SORTS as readonly string[]).includes(sortParam) ? sortParam : "date",
        dir: url.searchParams.get("dir") === "asc" ? ("asc" as const) : ("desc" as const),
        limit: paged ? pageSize : MAX_CSV_ROWS,
        offset: paged ? (page - 1) * pageSize : 0,
      },
    };
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": status === 200 ? `public, max-age=${config.cacheSeconds}, s-maxage=${config.cacheSeconds}` : "no-store",
      },
    });

  return async function handle(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith(base)) return null;
    if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "method_not_allowed" }, 405);
    const parts = url.pathname.slice(base.length).split("/").filter(Boolean).map(decodeURIComponent);
    const period = url.searchParams.get("period");

    try {
      if (parts.length === 0) return json(await leaderboard(period));

      if (parts[0] === "providers" && parts.length >= 2) {
        const slug = parts[1];
        if (parts.length === 2) {
          const p = await profile(slug, period);
          return p ? json(p) : json({ error: "not_found" }, 404);
        }
        const provider = (await store.providers()).find((p) => p.slug === slug);
        if (!provider) return json({ error: "not_found" }, 404);

        if (parts[2] === "trades" && parts.length === 3) {
          const { page, pageSize, filter } = historyFilter(url, provider.id, true);
          const r = await store.history(filter);
          const body: TradesResponse = { rows: r.rows, total: r.total, page, pageSize };
          return json(body);
        }
        if (parts[2] === "trades.csv" && parts.length === 3) {
          const { filter } = historyFilter(url, provider.id, false);
          const r = await store.history(filter);
          return new Response(tradesCsv(r.rows), {
            headers: {
              "content-type": "text/csv; charset=utf-8",
              "content-disposition": `attachment; filename="${slug}-trades.csv"`,
              "cache-control": "no-store",
            },
          });
        }
      }
      return json({ error: "not_found" }, 404);
    } catch (err) {
      deps.log?.(`rankings api error ${url.pathname}`, err);
      return json({ error: "server_error" }, 500);
    }
  };
}

/** CSV with a header row. Cells that could be read as formulas by Excel/Sheets are escaped. */
export function tradesCsv(rows: TradesResponse["rows"]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["opened_at", "closed_at", "pair", "direction", "entry", "entry_to", "stop_loss", "tp_hit", "result_pips", "status"];
  const lines = rows.map((r) =>
    [r.openedAt, r.closedAt, r.pair, r.direction, r.entry, r.entryTo, r.stopLoss, r.tpHit, r.resultPips, r.isOpen ? "live" : r.status].map(cell).join(","),
  );
  return `﻿${[head.join(","), ...lines].join("\r\n")}\r\n`;
}
