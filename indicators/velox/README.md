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

| **Trades** | Entry on the close of a candle that wicks into a zone or order block on its **first touch** and closes back out. **One take profit, 100 pips ($10 on gold), 1:1** (stop 100 pips). Drawn like TradingView's position tool: green box to the TP, red box to the SL. Only with chart and higher-timeframe structure, only in London/NY on 1H and below, only if the level sits inside the stop, one trade at a time, closed after 48 candles. |
| **Backtest table** | Closed trades on the loaded history: win rate vs the win rate needed to break even, wins/losses/timed out, net pips, net R, profit factor. 3 pips spread + slippage deducted; if a candle hits SL and TP, the SL counts. |

No Fibonacci.

**Alerts:** long/short entry and trade closed (with prices, via "Any alert() function call"), new demand zone, new supply zone, new bullish/bearish order block, and price reaching a fresh demand/supply zone. All fire on closed candles.

## Velox V2 — Strategy Lab

`velox-v2-strategy.pine` is the research version: the same engine as a **strategy**, so TradingView's broker emulator fills the orders, plus an on-chart **research table** that splits every closed trade by setup.

- **One entry, one structural stop, one target in R** (default 2R). No partials, no break-even, while we find out whether the entries have an edge.
- **Signal on the close, market order at the next candle's open.** The target is re-anchored to the real fill.
- **Stop** = far edge + 0.10 ATR. Between 0.5 and 1.5 ATR, or the trade is **skipped** (never widened).
- **Rejection candle:** body ≥ 0.20 ATR, body ÷ range ≥ 0.55, close in the top (long) / bottom (short) 30%.
- **First touch only**, not mitigated, level ≤ 200 candles old, strength ≥ 65.
- **Room:** at least 1.75R to the nearest opposing zone, order block, active breaker or higher-timeframe zone. Entering inside opposing structure counts as zero room.
- **BOS buffer:** a break must close 0.10 ATR beyond the swing (also for the internal breaks behind order blocks).
- **Sessions:** London in UK time; NY AM 08:30–10:55 and NY PM 13:30–15:55 in **New York** time, so daylight-saving changes don't shift them.
- **Size** = $100 risk ÷ stop distance (whole ounces): net profit ÷ 100 ≈ net R. Commission 0.15 per oz per side as a placeholder: set your broker's in Properties. Flat before the weekend (Friday 15:00 New York).
- **Research table:** trades, win %, average R, profit factor and net R for long/short, zone/OB, OB on a zone, each session, strength buckets, FVG or not, near an HTF zone or not, level age; plus median R, max drawdown (R), longest losing streak, how often trades reached +1R / +1.5R / +2R before exit, losers that reached +0.8R, and winners' average MAE. R is measured from the real fill and real profit after costs.
- Standard candles only. Bar Magnifier requested (paid plans) for candles that touch both stop and target.

## Install

1. Copy all of `velox-v1.pine` (or `velox-v2-strategy.pine`) with the **copy button**, not by selecting text: Pine needs the indentation, and selecting text from a chat or web page can strip it.
2. On TradingView, open the **Pine Editor**: press **⌘K** / **Ctrl+K** and type "Pine".
3. Select all and delete, paste, **Save**, then **Add to chart**.
4. To share it without showing the code, use **Publish script → Protected** or **Invite-only**.

## Notes

- **Nothing repaints.** Breaks, zones and order blocks are only created when a candle closes, and higher-timeframe zones use the last closed higher-timeframe candle. A zone is drawn from its low, but only appears once the breaking candle has closed.
- With a swing length of 10 (as in the FluidTrades reference), a swing is confirmed 10 candles after it happens. Lower it for more zones.
- Every box, line and label is anchored to **candles** (bar numbers), not times, so drawings stay in place when the chart is dragged or zoomed. Higher-timeframe zones start at the first chart candle at or after their higher-timeframe candle (at most 3,000 candles back).
- It runs on TradingView's feed (for example OANDA:XAUUSD), so zones can differ slightly from the website, which uses PAXG.
