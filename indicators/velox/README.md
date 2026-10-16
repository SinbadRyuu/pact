# Velox V1: TradingView script

`velox-v1.pine` (Pine Script v6) is the TradingView version of Velox V1. It doesn't use EMAs or label swing points.

| Layer | What it shows |
|---|---|
| **Sessions** (UK time, follows GMT/BST) | Boxes around each session's high and low: **Asia 01:00–04:50**, **London 07:00–09:55**, **New York AM 13:30–15:55**, **New York PM 18:30–20:55**. Times are editable. Shown on charts of 1h and below, for the last 5 days by default. |
| **Supply & demand zones** | The same rules as the Velox engine: a confirmed swing, a quiet base, and a close at least 1.5 ATR away within 6 candles. Labelled `DEMAND · 72` or `SUPPLY · 65` with a 0–100 strength, then `T1`, `T2` for each touch. They fade when mitigated and disappear when a candle closes through the far edge. |
| **Order blocks** | At every BOS/CHoCH: the last opposite-colour candle at the start of the leg that broke structure. Every OB is shown. OBs that sit in a supply or demand zone are marked **`OB @ DEMAND` / `OB @ SUPPLY`**, with a thicker border. |
| **Breaker blocks** | An order block that price closes through flips into a breaker (`BB ▲` support / `BB ▼` resistance, purple and dashed). It's removed when price closes back through it. |
| **Fair value gaps** | Three-candle gaps of at least 0.3 ATR, removed once filled. |
| **BOS / CHoCH** | Structure breaks: a break with the trend is BOS, a break against it is CHoCH. |
| **Fibonacci** | Drawn across the latest swing high and swing low: 0, 0.618, 0.65, 0.786 and 1. 0 is at whichever of the two came last. |
| **Buy / Sell** | Given on the first return to a fresh zone with strength ≥ 60. Entry at the zone edge, **SL** beyond the zone, **TP 1:1** (entry 4000, SL 3990 → TP 4010). Lines are drawn for the latest signal. |

Alerts: *Velox buy*, *Velox sell*, *New demand zone*, *New supply zone*.

## Install

1. Copy all of `velox-v1.pine`.
2. On TradingView, open the **Pine Editor** (**⌘K** / **Ctrl+K**, then type "Pine").
3. **Create new → Indicator**, delete the template, paste, **Save** as "Velox V1", then **Add to chart**.
4. To share it without showing the code, use **Publish script → Protected** or **Invite-only**.

## Notes

- It runs on TradingView's feed (for example OANDA:XAUUSD), so its zones can differ slightly from the website, which uses PAXG.
- Zone strength gives the timeframe some weight, so 5m zones score lower than 1h zones. If you see too few signals on 5m, lower *Min zone strength for a signal*.
- Swings are confirmed `Swing length` candles after they happen (3 by default), so zones and order blocks appear a few candles after the turn. Nothing is redrawn into the past.
