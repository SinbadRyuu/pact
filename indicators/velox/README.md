# Velox V1: TradingView script

`velox-v1.pine` (Pine Script v6) is the TradingView version of Velox V1. It uses the same rules as the engine in `packages/velox`. The full design is in `docs/velox/zones-and-order-blocks.md`.

| Layer | What it shows |
|---|---|
| **Demand / supply zones** | **The place price turned from.** On each break of structure: the wick of the **low that broke the high** (the lowest low between the broken swing high and the candle that closed above it). Supply is the mirror. Drawn as a thin band from that candle to the right, labelled `DEMAND · 82`, then `T1`, `T2` per visit, and faded when mitigated. Removed when a candle **closes** through it. Shows the 3 nearest per side. |
| **Order blocks** | **The candle the move started from:** the last down-close candle (bullish) or up-close candle (bearish) at or before that low/high. From a shorter internal swing (5) so they stay small and local on every timeframe; body only, capped at 0.75 ATR. Only kept if the move from it was strong: at least 1.5 ATR, 2 strong candles, and the break within 30 candles. Labelled `OB`, with a thicker border when it sits on a zone. |
| **Breaker blocks** | A failed order block (a candle closed through it) flips role and is shown as `BB`, purple and dashed, until price closes back through it. |
| **Higher-timeframe zones** | Follow the chart (Auto): 1m → 15m, 5m → 1H, 15m/1H → 4H, 4H → Daily. From **closed** higher-timeframe candles only. Every timeframe also shows its own zones, order blocks and breakers. |
| **Fair value gaps** | Three-candle gaps of at least 0.3 ATR, removed once filled. |
| **BOS / CHoCH** | Drawn when the breaking candle closes. |
| **Sessions** (UK time, outlined boxes) | Asia 01:00–04:50, London 07:00–09:55, New York AM 13:30–15:55, New York PM 18:30–20:55. |

There are no buy/sell signals and no Fibonacci.

**Alerts:** new demand zone, new supply zone, new bullish/bearish order block, and price reaching a fresh demand/supply zone. All fire on closed candles.

## Install

1. Copy all of `velox-v1.pine`. The first line must start with `// Velox V1`.
2. On TradingView, open the **Pine Editor**: press **⌘K** / **Ctrl+K** and type "Pine".
3. Select all and delete, paste, **Save**, then **Add to chart**.
4. To share it without showing the code, use **Publish script → Protected** or **Invite-only**.

## Notes

- **Nothing repaints.** Breaks, zones and order blocks are only created when a candle closes, and higher-timeframe zones use the last closed higher-timeframe candle. A zone is drawn from its low, but only appears once the breaking candle has closed.
- With a swing length of 10 (as in the FluidTrades reference), a swing is confirmed 10 candles after it happens. Lower it for more zones.
- It runs on TradingView's feed (for example OANDA:XAUUSD), so zones can differ slightly from the website, which uses PAXG.
