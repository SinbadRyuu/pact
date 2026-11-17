// Test data. Week under test: ISO week 46 of 2026 = Mon 9 Nov – Sun 15 Nov 2026 (London is on GMT, so UTC = London).
import type { Provider } from "../shared/types";
import type { MemoryTrade } from "../server/store";

export const PROVIDERS: Provider[] = [
  { id: "p-gold", slug: "gold-sniper", name: "Gold Sniper", avatarUrl: null },
  { id: "p-steady", slug: "steady-fx", name: "Steady FX", avatarUrl: null },
  { id: "p-lucky", slug: "lucky-one", name: "Lucky One", avatarUrl: null },
  { id: "p-range", slug: "range-rider", name: "Range Rider", avatarUrl: null },
  { id: "p-quiet", slug: "quiet-desk", name: "Quiet Desk", avatarUrl: null },
];

let seq = 0;
function trade(providerId: string, closedAt: string, pair: string, pips: number, extra: Partial<MemoryTrade> = {}): MemoryTrade {
  seq++;
  return {
    id: `t${String(seq).padStart(4, "0")}`,
    providerId,
    pair,
    direction: pips >= 0 ? "BUY" : "SELL",
    entry: 4100 + seq,
    entryTo: null,
    stopLoss: 4090 + seq,
    tpHit: pips > 0 ? 1 : 0,
    resultPips: pips,
    status: pips > 0 ? "take_profit" : pips < 0 ? "stop_loss" : "breakeven",
    isOpen: false,
    openedAt: new Date(Date.parse(closedAt) - 2 * 3600_000).toISOString(),
    closedAt,
    ...extra,
  };
}

/**
 * Gold Sniper, week 46, in closing order:            cumulative   peak   drawdown
 *   1  Mon 9 Nov  08:00  XAUUSD  +45   win              45          45      0
 *   2  Mon 9 Nov  14:00  XAUUSD  −30   loss             15          45     30
 *   3  Tue 10 Nov 10:00  GBPJPY  +60   win              75          75      0
 *   4  Wed 11 Nov 09:00  XAUUSD    0   breakeven        75          75      0
 *   5  Wed 11 Nov 16:00  EURUSD  −25   loss             50          75     25
 *   6  Thu 12 Nov 11:00  XAUUSD  −40   loss             10          75     65
 *   7  Thu 12 Nov 13:00  USDJPY  −10   loss              0          75     75  ← max drawdown
 *   8  Fri 13 Nov 09:30  GBPJPY  +80   win (best)       80          80      0
 *   9  Fri 13 Nov 15:00  XAUUSD  +35   win             115         115      0
 *  10  Sun 15 Nov 23:30  XAUUSD  +20   win             135         135      0
 *
 * Manual result: 10 trades · 5 wins · 4 losses · 1 breakeven · win rate 5/10 = 50% · net +135 · avg 13.5
 * best +80 · worst −40 · gross won 45+60+80+35+20 = 240 · gross lost 30+25+40+10 = 105 · profit factor 240/105 = 2.29
 * max drawdown 75 · streak W3 (20, 35, 80 then the −10 loss) · pairs XAUUSD 6, GBPJPY 2, EURUSD 1 (USDJPY 1 sorts after)
 * last active 15 Nov 23:30.
 */
export const GOLD_WEEK_46 = [
  trade("p-gold", "2026-11-09T08:00:00Z", "XAUUSD", 45),
  trade("p-gold", "2026-11-09T14:00:00Z", "XAUUSD", -30),
  trade("p-gold", "2026-11-10T10:00:00Z", "GBPJPY", 60),
  trade("p-gold", "2026-11-11T09:00:00Z", "XAUUSD", 0),
  trade("p-gold", "2026-11-11T16:00:00Z", "EURUSD", -25),
  trade("p-gold", "2026-11-12T11:00:00Z", "XAUUSD", -40),
  trade("p-gold", "2026-11-12T13:00:00Z", "USDJPY", -10),
  trade("p-gold", "2026-11-13T09:30:00Z", "GBPJPY", 80),
  trade("p-gold", "2026-11-13T15:00:00Z", "XAUUSD", 35),
  trade("p-gold", "2026-11-15T23:30:00Z", "XAUUSD", 20),
];

export const TRADES: MemoryTrade[] = [
  ...GOLD_WEEK_46,
  // Just outside week 46 on both sides: must not be counted.
  trade("p-gold", "2026-11-08T23:59:59Z", "XAUUSD", 999),
  trade("p-gold", "2026-11-16T00:00:00Z", "XAUUSD", -999),
  // Still running: shown as live, never in the stats.
  trade("p-gold", "2026-11-14T10:00:00Z", "XAUUSD", 0, { isOpen: true, status: "active", resultPips: null, closedAt: null }),
  // Steady FX: 12 × +15 = +180 in week 46 → #1.
  ...Array.from({ length: 12 }, (_, i) => trade("p-steady", `2026-11-${String(9 + (i % 5)).padStart(2, "0")}T1${i % 10}:00:00Z`, "EURUSD", 15)),
  // Lucky One: one +500 trade. Highest net pips, but under the 10-trade minimum → unranked, never on the podium.
  trade("p-lucky", "2026-11-10T12:00:00Z", "XAUUSD", 500),
  // Range Rider: 10 trades, net −20 → #3.
  ...Array.from({ length: 10 }, (_, i) => trade("p-range", `2026-11-1${i % 5}T0${i % 10}:15:00Z`, "GBPUSD", i % 2 ? 6 : -10)),
  // Week 45 (previous week): Gold Sniper #1 (+300), Steady FX #2 (+100), Range Rider not ranked.
  ...Array.from({ length: 10 }, (_, i) => trade("p-gold", `2026-11-0${2 + (i % 5)}T09:0${i}:00Z`, "XAUUSD", 30)),
  ...Array.from({ length: 10 }, (_, i) => trade("p-steady", `2026-11-0${2 + (i % 5)}T10:0${i}:00Z`, "EURUSD", 10)),
];

/** "Now" for tests: Tue 17 Nov 2026, so "last week" = week 46. */
export const NOW = new Date("2026-11-17T12:00:00Z");

/** The values worked out by hand in the table above. */
export const MANUAL_GOLD_WEEK_46 = {
  trades: 10,
  wins: 5,
  losses: 4,
  breakevens: 1,
  winRate: 50,
  netPips: 135,
  avgPips: 13.5,
  bestPips: 80,
  worstPips: -40,
  grossWon: 240,
  grossLost: 105,
  profitFactor: 2.29,
  maxDrawdown: 75,
  streak: "W3",
  topPairs: [
    { pair: "XAUUSD", trades: 6 },
    { pair: "GBPJPY", trades: 2 },
    { pair: "EURUSD", trades: 1 },
  ],
  lastActive: "2026-11-15T23:30:00.000Z",
};
