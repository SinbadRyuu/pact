# Quarterly Theory – True Opens

Pine Script v6 indicator for TradingView (`quarterly-theory.pine`). Paste it into the Pine Editor and click **Add to chart**.

## What it draws

- **True opens**: the open of Q2 in each cycle. The line runs from that bar to the end of the cycle and has a label with the price.
  - TYO: 1 April
  - TMO: 2nd Monday of the month (Sunday 18:00 open)
  - TWO: Monday 18:00
  - TDO: 00:00
  - Session true opens: AO 19:30, LO 01:30, NYO 07:30, PMO 13:30
  - T90: 22.5 minutes into each 90-minute cycle (off by default)
- **Quarter boxes**: each quarter is filled from its high to its low, coloured Q1 grey, Q2 green, Q3 red, Q4 blue. A dotted line runs the full height of the chart at the start of each quarter, and a dashed outline goes around the whole cycle.
- **Previous Q4 open and close**: when a cycle ends, its Q4 open and Q4 close are drawn from the start of that Q4 across the whole next cycle. This is on for Yearly, Monthly, Weekly and Daily, and can be turned on for Session and 90-minute cycles.

All times are New York time. The trading day starts at 18:00.

## Timeframes

With **Box cycle = Auto**:

| Chart | Boxes |
|---|---|
| 1m–5m | Session (90-minute quarters) |
| 15m–1H | Daily (6-hour sessions) |
| 2H–4H | Weekly (days) |
| up to 1D | Monthly (weeks) |
| above 1D | Yearly (calendar quarters) |

A cycle's lines are hidden when the chart timeframe is too big for it. For example, 90-minute lines only show on 5m and below. You can turn this off in the settings.

TradingView keeps at most 500 lines, 500 boxes and 500 labels per script, so the oldest drawings drop off on low timeframes. Use **Intraday history (days)** to set how far back intraday cycles are drawn.
