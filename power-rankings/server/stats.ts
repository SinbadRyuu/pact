// Every Power Rankings number, calculated from closed trades. Pure functions: no database, no clock, easy to test.
import { monthOf } from "../shared/periods";
import type { EquityPoint, LeaderboardRow, MonthStat, Provider, ProviderStats } from "../shared/types";

/** The four columns the stats need, per closed trade. */
export interface ClosedTrade {
  providerId: string;
  pair: string;
  pips: number;
  /** ms since epoch */
  closedAt: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** A trade within ±breakevenPips of zero counts as breakeven (default: exactly 0). */
export function outcome(pips: number, breakevenPips = 0): "W" | "L" | "BE" {
  if (Math.abs(pips) <= breakevenPips) return "BE";
  return pips > 0 ? "W" : "L";
}

/** Stats for one provider. `trades` must be that provider's closed trades in the period, oldest first. */
export function computeStats(trades: ClosedTrade[], breakevenPips = 0): ProviderStats {
  let wins = 0,
    losses = 0,
    breakevens = 0,
    net = 0,
    grossWon = 0,
    grossLost = 0,
    peak = 0,
    maxDd = 0;
  let best: number | null = null;
  let worst: number | null = null;
  const pairCount = new Map<string, number>();

  for (const t of trades) {
    const o = outcome(t.pips, breakevenPips);
    if (o === "W") {
      wins++;
      grossWon += t.pips;
    } else if (o === "L") {
      losses++;
      grossLost += -t.pips;
    } else breakevens++;
    net += t.pips;
    // Drawdown: the biggest fall from the highest cumulative total so far (starting from 0).
    peak = Math.max(peak, net);
    maxDd = Math.max(maxDd, peak - net);
    best = best === null ? t.pips : Math.max(best, t.pips);
    worst = worst === null ? t.pips : Math.min(worst, t.pips);
    pairCount.set(t.pair, (pairCount.get(t.pair) ?? 0) + 1);
  }

  // Streak: walk back from the latest trade, skipping breakevens, while the result matches.
  let streak: string | null = null;
  let kind: "W" | "L" | null = null;
  let run = 0;
  for (let i = trades.length - 1; i >= 0; i--) {
    const o = outcome(trades[i].pips, breakevenPips);
    if (o === "BE") continue;
    if (kind === null) kind = o;
    if (o !== kind) break;
    run++;
  }
  if (kind) streak = `${kind}${run}`;

  const n = trades.length;
  return {
    trades: n,
    wins,
    losses,
    breakevens,
    winRate: n ? round1((wins / n) * 100) : 0,
    netPips: round1(net),
    avgPips: n ? round1(net / n) : 0,
    bestPips: best === null ? null : round1(best),
    worstPips: worst === null ? null : round1(worst),
    grossWon: round1(grossWon),
    grossLost: round1(grossLost),
    profitFactor: grossLost > 0 ? Math.round((grossWon / grossLost) * 100) / 100 : grossWon > 0 ? "inf" : null,
    maxDrawdown: round1(maxDd),
    streak,
    topPairs: [...pairCount.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([pair, count]) => ({ pair, trades: count })),
    lastActive: n ? new Date(trades[n - 1].closedAt).toISOString() : null,
  };
}

/** Cumulative pips after each trade, oldest first. */
export function equityCurve(trades: ClosedTrade[]): EquityPoint[] {
  let v = 0;
  return trades.map((t, i) => ({ t: t.closedAt, v: round1((v += t.pips)), n: i + 1 }));
}

/**
 * Thins a curve to at most `max` points for drawing, keeping the first and last points and the highest and lowest
 * point of each bucket, so peaks and drawdowns stay visible.
 */
export function downsample(points: EquityPoint[], max: number): EquityPoint[] {
  if (points.length <= max) return points;
  const buckets = Math.max(1, Math.floor((max - 2) / 2));
  const size = (points.length - 2) / buckets;
  const out: EquityPoint[] = [points[0]];
  for (let b = 0; b < buckets; b++) {
    const slice = points.slice(1 + Math.floor(b * size), 1 + Math.floor((b + 1) * size));
    if (!slice.length) continue;
    let lo = slice[0],
      hi = slice[0];
    for (const p of slice) {
      if (p.v < lo.v) lo = p;
      if (p.v > hi.v) hi = p;
    }
    out.push(...(lo.t <= hi.t ? [lo, hi] : [hi, lo]).filter((p, i, a) => i === 0 || p !== a[0]));
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Pips and win rate per calendar month (in the rankings time zone). */
export function monthlyBreakdown(trades: ClosedTrade[], tz: string, breakevenPips = 0): MonthStat[] {
  const map = new Map<string, { pips: number; trades: number; wins: number }>();
  for (const t of trades) {
    const k = monthOf(t.closedAt, tz);
    const m = map.get(k) ?? { pips: 0, trades: 0, wins: 0 };
    m.pips += t.pips;
    m.trades++;
    if (outcome(t.pips, breakevenPips) === "W") m.wins++;
    map.set(k, m);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, m]) => ({ month, pips: round1(m.pips), trades: m.trades, wins: m.wins, winRate: round1((m.wins / m.trades) * 100) }));
}

/** Groups a period's trades (oldest first) by provider. */
export function byProvider(trades: ClosedTrade[]): Map<string, ClosedTrade[]> {
  const map = new Map<string, ClosedTrade[]>();
  for (const t of trades) {
    const list = map.get(t.providerId);
    if (list) list.push(t);
    else map.set(t.providerId, [t]);
  }
  return map;
}

/**
 * Ranks providers. Qualified = at least `minTrades` closed trades; they're ranked by net pips (ties: win rate,
 * then more trades, then name). Providers under the minimum are listed after them, unranked, so one lucky trade
 * can't take #1 or reach the podium.
 */
export function rankProviders(
  providers: Provider[],
  grouped: Map<string, ClosedTrade[]>,
  minTrades: number,
  breakevenPips = 0,
): { provider: Provider; stats: ProviderStats; trades: ClosedTrade[]; rank: number | null }[] {
  const rows = providers
    .filter((p) => grouped.has(p.id))
    .map((p) => {
      const trades = grouped.get(p.id)!;
      return { provider: p, trades, stats: computeStats(trades, breakevenPips), rank: null as number | null };
    });
  const order = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    b.stats.netPips - a.stats.netPips ||
    b.stats.winRate - a.stats.winRate ||
    b.stats.trades - a.stats.trades ||
    a.provider.name.localeCompare(b.provider.name);
  const qualified = rows.filter((r) => r.stats.trades >= minTrades).sort(order);
  const rest = rows.filter((r) => r.stats.trades < minTrades).sort(order);
  qualified.forEach((r, i) => (r.rank = i + 1));
  return [...qualified, ...rest];
}

/** Previous rank − current rank (positive = moved up), or "new" for someone ranked now but not before. */
export function rankChange(current: number | null, previous: number | undefined): LeaderboardRow["rankChange"] {
  if (current === null) return null;
  if (previous === undefined) return "new";
  return previous - current;
}
