// Shapes the Power Rankings API returns. Shared by server and page.

export interface Provider {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
}

/** All the stats for one provider over one period. Closed trades only. */
export interface ProviderStats {
  trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  /** wins / trades × 100 (breakevens count as trades). */
  winRate: number;
  netPips: number;
  avgPips: number;
  bestPips: number | null;
  worstPips: number | null;
  grossWon: number;
  grossLost: number;
  /** grossWon / grossLost. "inf" when there are wins but no losses; null with no wins and no losses. */
  profitFactor: number | "inf" | null;
  /** Largest peak-to-trough fall in cumulative pips (a positive number). */
  maxDrawdown: number;
  /** Current run from the latest trade back, breakevens skipped: "W4", "L2". */
  streak: string | null;
  topPairs: { pair: string; trades: number }[];
  lastActive: string | null;
}

export interface EquityPoint {
  /** closed_at, ms since epoch */
  t: number;
  /** cumulative pips after this trade */
  v: number;
  /** 1-based trade number in the period (kept through downsampling, so tooltips show the real count) */
  n: number;
}

export interface LeaderboardRow {
  provider: Provider;
  /** 1-based among providers with at least minTrades. null = not enough trades to be ranked. */
  rank: number | null;
  /** Previous rank − current rank: +2 means up two places. null when not ranked now; "new" when not ranked before. */
  rankChange: number | "new" | null;
  stats: ProviderStats;
  /** Downsampled cumulative pips for the mini equity curve. */
  equity: EquityPoint[];
  liveTrades: number;
}

export interface LiveTrade {
  id: string;
  providerId: string;
  pair: string;
  direction: "BUY" | "SELL";
  entry: number | null;
  stopLoss: number | null;
  openedAt: string;
}

export interface RankingsResponse {
  period: { key: string; label: string; start: string | null; end: string };
  timezone: string;
  minTrades: number;
  firstTradeYear: number | null;
  rows: LeaderboardRow[];
  live: (LiveTrade & { provider: Provider })[];
  generatedAt: string;
}

export interface MonthStat {
  month: string; // "2026-10"
  pips: number;
  trades: number;
  wins: number;
  winRate: number;
}

export interface ProviderProfileResponse {
  period: RankingsResponse["period"];
  timezone: string;
  minTrades: number;
  firstTradeYear: number | null;
  provider: Provider;
  rank: number | null;
  rankChange: LeaderboardRow["rankChange"];
  rankedOf: number;
  stats: ProviderStats;
  equity: EquityPoint[];
  monthly: MonthStat[];
  pairs: string[];
  live: LiveTrade[];
}

export interface TradeRow {
  id: string;
  pair: string;
  direction: "BUY" | "SELL";
  entry: number | null;
  entryTo: number | null;
  stopLoss: number | null;
  /** How many take profits were hit. */
  tpHit: number;
  resultPips: number | null;
  status: string;
  isOpen: boolean;
  openedAt: string;
  closedAt: string | null;
}

export interface TradesResponse {
  rows: TradeRow[];
  total: number;
  page: number;
  pageSize: number;
}

export const TRADE_SORTS = ["date", "pair", "direction", "result_pips", "status"] as const;
export type TradeSort = (typeof TRADE_SORTS)[number];
