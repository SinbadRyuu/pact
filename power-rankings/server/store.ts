// Reads providers and trades. Postgres (via the ranking_* views) in production; in-memory for tests and the preview.
import type { LiveTrade, Provider, TradeRow, TradeSort } from "../shared/types";
import type { ClosedTrade } from "./stats";
import type { Sql } from "./types";

export interface HistoryFilter {
  providerId: string;
  from: Date | null;
  to: Date | null; // exclusive
  pair: string | null;
  sort: TradeSort;
  dir: "asc" | "desc";
  limit: number;
  offset: number;
}

export interface RankingsStore {
  providers(): Promise<Provider[]>;
  /** Closed trades with closed_at in [start, end), oldest first. Optionally one provider. */
  closedTrades(start: Date | null, end: Date, providerId?: string): Promise<ClosedTrade[]>;
  openTrades(providerId?: string): Promise<LiveTrade[]>;
  firstTradeYear(): Promise<number | null>;
  pairs(providerId: string): Promise<string[]>;
  history(f: HistoryFilter): Promise<{ rows: TradeRow[]; total: number }>;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

/** Whitelisted ORDER BY expressions; user input never reaches the SQL text. */
const ORDER: Record<TradeSort, string> = {
  date: "coalesce(closed_at, opened_at)",
  pair: "pair",
  direction: "direction",
  result_pips: "result_pips",
  status: "status",
};

export function createPgRankingsStore(sql: Sql): RankingsStore {
  return {
    async providers() {
      const rows = await sql.query<{ id: string; slug: string; name: string; avatar_url: string | null }>(
        `select id, slug, name, avatar_url from public.ranking_providers order by name`,
      );
      return rows.map((r) => ({ id: String(r.id), slug: r.slug, name: r.name, avatarUrl: r.avatar_url }));
    },

    async closedTrades(start, end, providerId) {
      // Four narrow columns, index range scan on closed_at (or provider + closed_at).
      const params: unknown[] = [end];
      let where = `not is_open and closed_at is not null and result_pips is not null and closed_at < $1`;
      if (start) {
        params.push(start);
        where += ` and closed_at >= $${params.length}`;
      }
      if (providerId) {
        params.push(providerId);
        where += ` and provider_id = $${params.length}`;
      }
      const rows = await sql.query<{ provider_id: string; pair: string; result_pips: string; closed_at: Date | string }>(
        `select provider_id, pair, result_pips, closed_at from public.ranking_trades where ${where} order by closed_at, id`,
        params,
      );
      return rows.map((r) => ({
        providerId: String(r.provider_id),
        pair: r.pair,
        pips: Number(r.result_pips),
        closedAt: new Date(r.closed_at).getTime(),
      }));
    },

    async openTrades(providerId) {
      const rows = await sql.query<Record<string, unknown>>(
        `select id, provider_id, pair, direction, entry, stop_loss, opened_at from public.ranking_trades
          where is_open ${providerId ? "and provider_id = $1" : ""} order by opened_at desc limit 50`,
        providerId ? [providerId] : [],
      );
      return rows.map((r) => ({
        id: String(r.id),
        providerId: String(r.provider_id),
        pair: String(r.pair),
        direction: r.direction === "SELL" ? "SELL" : "BUY",
        entry: num(r.entry),
        stopLoss: num(r.stop_loss),
        openedAt: iso(r.opened_at)!,
      }));
    },

    async firstTradeYear() {
      const rows = await sql.query<{ y: number | null }>(
        `select extract(year from min(closed_at))::int as y from public.ranking_trades where not is_open`,
      );
      return rows[0]?.y ?? null;
    },

    async pairs(providerId) {
      const rows = await sql.query<{ pair: string }>(
        `select distinct pair from public.ranking_trades where provider_id = $1 order by pair`,
        [providerId],
      );
      return rows.map((r) => r.pair);
    },

    async history(f) {
      const params: unknown[] = [f.providerId];
      let where = "provider_id = $1";
      if (f.from) {
        params.push(f.from);
        where += ` and coalesce(closed_at, opened_at) >= $${params.length}`;
      }
      if (f.to) {
        params.push(f.to);
        where += ` and coalesce(closed_at, opened_at) < $${params.length}`;
      }
      if (f.pair) {
        params.push(f.pair);
        where += ` and pair = $${params.length}`;
      }
      const order = `${ORDER[f.sort]} ${f.dir === "asc" ? "asc" : "desc"} nulls last, id desc`;
      params.push(f.limit, f.offset);
      const rows = await sql.query<Record<string, unknown>>(
        `select id, pair, direction, entry, entry_to, stop_loss, tp_hit, result_pips, status, is_open, opened_at, closed_at,
                count(*) over () as total
           from public.ranking_trades where ${where}
          order by ${order} limit $${params.length - 1} offset $${params.length}`,
        params,
      );
      let total = Number(rows[0]?.total ?? 0);
      if (!rows.length && f.offset > 0) {
        const c = await sql.query<{ n: string }>(`select count(*) n from public.ranking_trades where ${where}`, params.slice(0, -2));
        total = Number(c[0]?.n ?? 0);
      }
      return {
        total,
        rows: rows.map((r) => ({
          id: String(r.id),
          pair: String(r.pair),
          direction: r.direction === "SELL" ? "SELL" : "BUY",
          entry: num(r.entry),
          entryTo: num(r.entry_to),
          stopLoss: num(r.stop_loss),
          tpHit: Number(r.tp_hit ?? 0),
          resultPips: num(r.result_pips),
          status: String(r.status),
          isOpen: Boolean(r.is_open),
          openedAt: iso(r.opened_at)!,
          closedAt: iso(r.closed_at),
        })),
      };
    },
  };
}

/** In-memory trades for tests and the preview. */
export interface MemoryTrade extends TradeRow {
  providerId: string;
}

export function createMemoryRankingsStore(providers: Provider[], trades: MemoryTrade[]): RankingsStore {
  const closed = () =>
    trades
      .filter((t) => !t.isOpen && t.closedAt && t.resultPips !== null)
      .sort((a, b) => a.closedAt!.localeCompare(b.closedAt!) || a.id.localeCompare(b.id));
  return {
    async providers() {
      return [...providers].sort((a, b) => a.name.localeCompare(b.name));
    },
    async closedTrades(start, end, providerId) {
      return closed()
        .filter((t) => {
          const c = Date.parse(t.closedAt!);
          return c < end.getTime() && (!start || c >= start.getTime()) && (!providerId || t.providerId === providerId);
        })
        .map((t) => ({ providerId: t.providerId, pair: t.pair, pips: t.resultPips!, closedAt: Date.parse(t.closedAt!) }));
    },
    async openTrades(providerId) {
      return trades
        .filter((t) => t.isOpen && (!providerId || t.providerId === providerId))
        .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
        .map((t) => ({ id: t.id, providerId: t.providerId, pair: t.pair, direction: t.direction, entry: t.entry, stopLoss: t.stopLoss, openedAt: t.openedAt }));
    },
    async firstTradeYear() {
      const c = closed();
      return c.length ? new Date(c[0].closedAt!).getUTCFullYear() : null;
    },
    async pairs(providerId) {
      return [...new Set(trades.filter((t) => t.providerId === providerId).map((t) => t.pair))].sort();
    },
    async history(f) {
      const at = (t: MemoryTrade) => Date.parse(t.closedAt ?? t.openedAt);
      const list = trades.filter(
        (t) =>
          t.providerId === f.providerId &&
          (!f.from || at(t) >= f.from.getTime()) &&
          (!f.to || at(t) < f.to.getTime()) &&
          (!f.pair || t.pair === f.pair),
      );
      const key = (t: MemoryTrade): string | number | null =>
        f.sort === "date" ? at(t) : f.sort === "result_pips" ? t.resultPips : f.sort === "pair" ? t.pair : f.sort === "direction" ? t.direction : t.status;
      list.sort((a, b) => {
        const x = key(a),
          y = key(b);
        if (x === null && y === null) return 0;
        if (x === null) return 1; // nulls last
        if (y === null) return -1;
        const c = x < y ? -1 : x > y ? 1 : 0;
        return (f.dir === "asc" ? c : -c) || b.id.localeCompare(a.id);
      });
      return {
        total: list.length,
        rows: list.slice(f.offset, f.offset + f.limit).map(({ providerId: _p, ...r }) => ({
          ...r,
          openedAt: new Date(r.openedAt).toISOString(),
          closedAt: r.closedAt ? new Date(r.closedAt).toISOString() : null,
        })),
      };
    },
  };
}
