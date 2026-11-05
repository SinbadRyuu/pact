# MLS v2 | Liquidity Sweep Model

A Pine Script v6 indicator for TradingView. It looks for a liquidity sweep, then a market structure shift, then a retest of a fair value gap (FVG). It only uses closed candles.

1. **Sweep:** price takes a swing, the previous session's or the previous day's high or low, then closes back inside.
2. **MSS:** a body candle closes beyond the last internal swing in the new direction.
3. **Entry FVG:** a three-candle gap forms in the new direction.
4. **Entry:** price retests that gap and rejects it. The entry is graded **A** when the sweep touched a live higher-timeframe FVG, and **B** otherwise.

### Rules that keep weak setups out

- **Each level is only swept once.** Once a swing, session or day high or low has been swept, that liquidity is used up and the indicator won't trade the same level again.
- **The MSS level must sit beyond price** when the sweep happens. Otherwise any candle would count as a "break". If the last internal swing is on the wrong side, the extreme of the leg into the sweep is used instead.
- **Premium / discount filter** (optional): longs are only taken below the prior day's midpoint, and shorts only above it.

### Results

- Each entry is followed until price hits the stop or the target. If one candle hits both, it counts as a loss.
- The chart marks each outcome with **TP ✓** or **SL ✗**, and entries with **BUY** or **SELL**.
- The dashboard shows how many trades were won and lost and the net R across the loaded history.
- Use these numbers to compare settings, rather than judging from a handful of trades.

### Filters and costs

| Setting | What it does |
|---|---|
| Only take sweeps in London / NY AM | Ignores sweeps outside the London and NY AM windows (1H charts and below). |
| Trade with HTF 2 trend | Longs only when the HTF 2 close is above its 50 EMA, shorts only below it. The EMA isn't drawn. |
| Move stop to breakeven at 1R | Once price reaches 1R, the stop moves to entry. A trade stopped out there counts as BE, not a loss. |
| Spread + commission per trade | Taken off every result. On 1m to 5m gold, a 0.4 spread can be 10 to 25% of the risk. |
| Minimum stop size | Skips trades with stops too small to cover costs. |

Only one trade is open at a time.

## Strategy version (`mls-v2-strategy.pine`)

The same rules, wired to TradingView's Strategy Tester, so you can backtest on your own data feed with costs included.

- Commission defaults to 0.20 per side per ounce. Change it under **Properties**.
- Orders fill at the close of the signal candle, like the indicator.
- The sweep, MSS and entry `alertcondition`s are removed, because strategies can't use them. The entry `alert()` still works.

Read **Net profit**, **Profit factor** and **Max drawdown** in the Strategy Tester. Change one setting at a time.

## Reading the chart

The chart is kept quiet on purpose. Only the things you can act on are drawn.

- **Dashboard.** It answers three questions:
  - **Setup:** what is armed, for example *Long A · PDL swept*, or *Scanning for a sweep*.
  - **Next / Liquidity:** the exact price to watch. While scanning, this shows the nearest untaken high and low. During a setup, it shows the MSS trigger, the FVG to wait for, or the retest zone, plus how many bars are left before the setup expires.
  - **Invalid if:** the close that cancels the setup.
  - **Trade** shows the open trade and its live R. **Record** shows wins, losses and net R after costs.
- **Live setup lines.** A dashed *MSS trigger* line and a dotted *Invalid* line, drawn only while a setup is live.
- **Sweep and MSS markers** are named after the level that was swept (*PDL sweep*, *Asia H sweep*, *Swing L sweep*). Hover a marker for its price and grade. Setups that expire or are invalidated are removed, so only the live setup and setups that became trades stay on the chart. Turn off *Hide setups that never triggered* to keep them, faded.
- **Untaken liquidity.** Short dotted lines at the right edge mark the swing, session and prior day highs and lows that haven't been swept yet.
- **HTF FVGs.** Only the nearest live zones above and below price are drawn (2 per side by default), and only within 3x the HTF 1 ATR. Zones far from price would otherwise stretch the price scale and squash the candles. Every tracked zone still counts for A / B grading.
- **Status line.** No input values are printed next to the indicator name.

Use *Dashboard position* and *Text size* in **01 | Display** to fit the dashboard to your layout. None of these display settings change the signals.

## Higher-timeframe FVGs

The higher timeframes follow the chart's timeframe:

| Chart | HTF 1 (solid) | HTF 2 (dashed) |
|---|---|---|
| Under 1H | 1H | 4H |
| 1H to under 4H | 4H | D |
| 4H to under D | D | W |
| D to under W | W | M |

- Each FVG is drawn from the candle where it formed.
- A zone stays live and keeps extending until a candle closes through it or it reaches *HTF zone age* higher-timeframe bars. After that it is hidden, unless *Also show filled / expired zones* is on, in which case it is drawn faded.
- Bull FVGs are blue and bear FVGs are orange. You can change both colours in the settings.

## Trade plans

- The take-profit box is green and the stop-loss box is red. The TP and SL prices are written inside the boxes, and a dashed line marks the entry.
- The entry label sits to the right of the plan so it doesn't cover the candles. *Label distance right of plan* sets how far away it sits.

## Install

Open the Pine Editor, paste in `mls-v2.pine`, then click **Save** and **Add to chart**.
