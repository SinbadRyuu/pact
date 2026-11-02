# Velox Indicator

Velox V2B.2, the Clean Supply & Demand Lab. It's a Pine Script v6 **strategy** for TradingView, written as Phase 1 research: it tests the core supply and demand entry with no partial exits, no break-even logic and no order-block scoring.

## What it does

- **Supply and demand zones** come from breaks of structure (BOS and CHoCH). Each zone is scored for strength (how far price moved away and how fast) and moves from fresh to tested to mitigated, or is removed once invalidated.
- **Entries** need a rejection candle on the first touch of a strong zone. By default the chart structure and the higher-timeframe structure must agree, and there must be enough room before the next opposing zone. The stop goes beyond the far edge of the zone. The target is a fixed R multiple (2R by default).
- **Higher timeframe** is set automatically: 1m → 15m, 5m → 1H, 15m and 1H → 4H, 4H → Daily, Daily → Weekly. You can pick one yourself instead.
- **Session boxes** for Asia, London, NY AM and NY PM. On 1H and lower charts, entries are limited to London and New York by default.
- **Order blocks and breaker blocks** are drawn from local structure and count as opposing structure in the room check. Entries still come only from supply and demand zones.
- **Velox box** shows trend, strength (ADX), volume, session, and the trend on this timeframe and the next two up. An optional second table shows backtest stats: trades, win %, net R, profit factor, drawdown, MFE/MAE and hit rates.

## Install

1. On TradingView, open the Pine Editor.
2. Paste in [`velox.pine`](velox.pine) and click **Add to chart**.
3. Use standard candles. The script stops with an error on Heikin Ashi, Renko and other synthetic charts.

Alerts fire once per bar close on each long or short entry, with the entry, SL, TP, zone strength and session.

## Notes

- The higher-timeframe trend comes from the last closed HTF candle only, so it doesn't repaint.
- This is research code. It is not financial advice and does not claim to be profitable.
