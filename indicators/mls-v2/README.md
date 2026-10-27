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
- The chart marks each outcome with **TP ✓** or **SL ✗**.
- The dashboard shows how many trades were won and lost, the win rate and the net R across the loaded history.
- Use these numbers to compare settings, rather than judging from a handful of trades.

## Higher-timeframe FVGs

The higher timeframes follow the chart's timeframe:

| Chart | HTF 1 (solid) | HTF 2 (dashed) |
|---|---|---|
| Under 1H | 1H | 4H |
| 1H to under 4H | 4H | D |
| 4H to under D | D | W |
| D to under W | W | M |

- Each FVG is drawn from the candle where it formed, and stays on the chart when you scroll back.
- A zone stays live and keeps extending until a candle closes through it or it reaches *HTF zone age* higher-timeframe bars. It then fades, or is removed if *Keep filled / expired HTF FVGs* is off.
- Bull FVGs are blue and bear FVGs are orange. You can change both colours in the settings.

## Trade plans

- The take-profit box is green and the stop-loss box is red. The TP and SL prices are written inside the boxes, and a dashed line marks the entry.
- The entry label sits to the right of the plan so it doesn't cover the candles. *Label distance right of plan* sets how far away it sits.

## Install

Open the Pine Editor, paste in `mls-v2.pine`, then click **Save** and **Add to chart**.
