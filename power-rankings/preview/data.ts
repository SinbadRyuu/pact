// Made-up but realistic trade history for the preview: 8 providers, ~2 years, some running trades.
import type { MemoryTrade } from "../server/store";
import type { Provider } from "../shared/types";

export const PREVIEW_PROVIDERS: Provider[] = [
  "VT Capital", "Gold Sniper", "London Breakout", "Steady FX", "Night Owl", "Index Hunter", "Swing Society", "Fresh Face",
].map((name, i) => ({ id: `p${i}`, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, avatarUrl: null }));

let s = 42;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const PAIRS = ["XAUUSD", "XAUUSD", "GBPJPY", "EURUSD", "US30", "NAS100", "GBPUSD", "USDJPY"];
const edge = [0.58, 0.55, 0.52, 0.6, 0.49, 0.53, 0.56, 0.62];
const perDay = [1.2, 1.6, 0.9, 1.1, 0.7, 0.8, 0.4, 0.6];

export function previewTrades(now = Date.now()): MemoryTrade[] {
  const out: MemoryTrade[] = [];
  let id = 0;
  PREVIEW_PROVIDERS.forEach((p, pi) => {
    const startDays = pi === 7 ? 9 : 730; // "Fresh Face" only started last week
    for (let d = startDays; d >= 0; d--) {
      const n = Math.floor(perDay[pi] + rnd() * 1.5);
      for (let k = 0; k < n; k++) {
        const closed = now - d * 86_400_000 - rnd() * 80_000_000;
        if (closed > now) continue;
        const r = rnd();
        const pips = r < 0.06 ? 0 : r < 0.06 + edge[pi] ? Math.round(15 + rnd() * 70) : -Math.round(12 + rnd() * 45);
        const pair = PAIRS[(pi + Math.floor(rnd() * 4)) % PAIRS.length];
        out.push({
          id: `t${++id}`, providerId: p.id, pair, direction: rnd() > 0.5 ? "BUY" : "SELL",
          entry: pair === "XAUUSD" ? 4000 + Math.round(rnd() * 200) : 1 + rnd(), entryTo: null,
          stopLoss: pair === "XAUUSD" ? 3990 + Math.round(rnd() * 200) : 1 + rnd(),
          tpHit: pips > 0 ? 1 + Math.floor(rnd() * 3) : 0, resultPips: pips,
          status: pips > 0 ? "take_profit" : pips < 0 ? "stop_loss" : "breakeven", isOpen: false,
          openedAt: new Date(closed - 3 * 3600_000).toISOString(), closedAt: new Date(closed).toISOString(),
        });
      }
    }
  });
  for (const pi of [0, 1, 3]) {
    out.push({ id: `live${pi}`, providerId: `p${pi}`, pair: "XAUUSD", direction: "BUY", entry: 4142.5, entryTo: null, stopLoss: 4131, tpHit: 0, resultPips: null, status: "active", isOpen: true, openedAt: new Date(now - (pi + 1) * 1800_000).toISOString(), closedAt: null });
  }
  return out;
}
