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

- **SMT divergence (quarter to quarter)**: each quarter is compared with the previous quarter of the same cycle, against a second symbol. If only one of the two takes the previous quarter's high, a red **SMT** line joins the two highs. If only one takes the previous quarter's low, a green one joins the lows. Hover the label to see which symbol swept. If the other symbol also sweeps later in the quarter, the SMT is removed (you can turn this off). Leave **Compare with** blank to pair automatically (ES ↔ NQ, YM → ES, GC ↔ SI, XAUUSD ↔ XAGUSD, EURUSD ↔ GBPUSD, BTC ↔ ETH), or pick any symbol. Tick **Invert** for inverse pairs such as DXY. There are "Bearish SMT" and "Bullish SMT" alert conditions.

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
