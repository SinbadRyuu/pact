# Quarterly Theory – True Opens

Pine Script v6 indicator for TradingView (`quarterly-theory.pine`). Paste it into the Pine Editor and click **Add to chart**.

## What it draws

- **True opens**: the open of Q2 in each cycle. The line runs from that bar to the end of the cycle and has a label with the price.
  - TYO: 1 April
  - TMO: 2nd Monday of the month (Sunday 18:00 open)
  - TWO: Monday 18:00
  - TDO: 00:00
  - Session true opens: AO 19:30, LO 01:30, NYO 07:30, PMO 13:30
  - T90: 22.5 minutes into each 90-minute cycle
- **Quarter boxes**: each quarter is filled from its high to its low, coloured Q1 grey, Q2 green, Q3 red, Q4 blue. A dotted line runs the full height of the chart at the start of each quarter, and a dashed outline goes around the whole cycle.
- **Previous Q4 open and close**: when a cycle ends, its Q4 open and Q4 close are drawn from the start of that Q4 across the whole next cycle. It is on for every cycle by default.

All times are New York time. The trading day starts at 18:00.

- **SSMT, sequential SMT (quarter to quarter)**: each quarter is compared with the previous quarter of the same cycle, against up to three other symbols. An SMT is marked when at least two of them disagree with your chart: one side takes the previous quarter's high (or low) and the other doesn't. You can change the number in the settings, and if fewer symbols are available all of them must disagree. Each SMT is a straight line joining the two quarter highs (red, bearish) or the two quarter lows (green, bullish), whether the second one is higher or lower. If two SMTs in a row share a high or low, only the newest line is kept. Hover the label to see which symbols disagreed, with each symbol's previous quarter high/low and this quarter's high/low, so you can check every SMT. A table in the bottom-right corner shows the same check live for the current quarter. If every symbol ends up agreeing later in the quarter, the SMT is removed (you can turn this off). Leave the **Compare** symbols blank to pick automatically:
  - XAUUSD: XAGUSD, XPTUSD, XCUUSD (silver, platinum, copper)
  - GC: SI, PL, HG
  - ES / NQ / YM: the other two (micros map to micros)
  - EURUSD ↔ GBPUSD, BTC ↔ ETH

  Tick **Invert** for inverse pairs such as DXY. There are "Bearish SMT" and "Bullish SMT" alert conditions.

- **SSMT on the cycle above**: the same check also runs one cycle up, drawn as thicker dashed lines and labelled with the quarter size. On 5m that's "SSMT 90m" (the session's 90-minute quarters), on 15m "SSMT 6H" (the daily sessions), on 1H "SSMT Day", on 4H "SSMT Week" and on 1D "SSMT Qtr". It has its own alerts and can be turned off.
- **Trend bias (buys or sells)**: a panel in the top-right corner says BULLISH (look for buys), BEARISH (look for sells) or NEUTRAL (wait). It scores four things, +1 bullish or -1 bearish each:
  1. Price above or below the true open of the next cycle up (on 5m: the session true open)
  2. Price above or below the true open of the cycle above that (on 5m: TDO)
  3. Quarter structure: the last finished quarter made a higher high and higher low, or a lower high and lower low, than the one before
  4. An SMT from this quarter or the one just finished. Older SMTs are ignored.

  A score of +2 or more is bullish and -2 or less is bearish. Bias changes are marked BUYS / SELLS on the chart, and there are "Bias turned bullish" and "Bias turned bearish" alerts. The background tint is optional.

## Adaptive mode (default)

The chart timeframe picks one cycle. Only that cycle's quarter boxes, true open and previous Q4 open/close are drawn. Nothing from other cycles is shown.

| Chart | Cycle drawn | True open | Previous Q4 |
|---|---|---|---|
| 1m–5m | 90 Minute (22.5-min quarters) | T90 | previous 90-min cycle |
| 6m–15m | Session (90-min quarters) | AO / LO / NYO / PMO | previous session |
| 16m–1H | Daily (6-hour sessions) | TDO | previous day |
| 2H–4H | Weekly (days) | TWO | previous week |
| 5H–1D | Monthly (weeks) | TMO | previous month |
| above 1D | Yearly (calendar quarters) | TYO | previous year |

The on/off switches for each true open and previous Q4 still apply. Switch **Mode** to **Manual** to draw several cycles at once.

TradingView keeps at most 500 lines, 500 boxes and 500 labels per script, so the oldest drawings drop off on low timeframes. Use **Intraday history (days)** to set how far back intraday cycles are drawn.
