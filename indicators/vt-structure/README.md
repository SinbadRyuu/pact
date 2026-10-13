# VT Structure

A market-structure indicator for VT Impact, modelled on the X-ALGO setup on XAUUSD. It has:

- **Swing highs and lows** labelled HH, LH, HL or LL
- **BOS and CHoCH** lines. A break with the trend is BOS. A break against it is CHoCH, marked with a reversal triangle
- **Fast and slow EMAs**: 21 (green) and 50 (blue) by default
- **A Fibonacci retracement of the current leg**: 0, 0.618, 0.65, 0.786 and 1, with the 0.618–0.786 zone shaded
- **Buy and sell signals** on CHoCH, or on CHoCH and BOS, with entry, SL and TP1 to TP3. The stop sits beyond the start of the leg plus an ATR buffer. The targets are 1R, 2R and 3R
- **A dashboard**: trend, strength (ADX), volume against its 20-bar average, session (Asia, London, New York), the structure trend on 5m, 15m and H1, and how the latest signal played out

It comes in two versions that use the same rules.

## 1. TradingView (`vt-structure.pine`)

Pine Script v6. Use this in the **Indicators → Your scripts** section of VT Impact.

1. On TradingView, open the Pine Editor, paste the file in and click **Add to chart**.
2. On VT Impact, save it as a script. Members can copy it from there.
3. To show its signals on the VT Impact gold chart, turn on alerts for the script on VT Impact. Then on TradingView, create an alert on one of the conditions: *Buy signal*, *Sell signal*, *Bullish/Bearish CHoCH* or *Bullish/Bearish BOS*. Turn on **Webhook URL** and paste VT Impact's address and message. Set `"side"` to `"buy"` for buy conditions, `"sell"` for sell conditions, or `"note"` for structure-only ones.

## 2. VT Impact's own charts (`vt-structure.js`)

This version is a plain ES module with no dependencies. Candles use the shape the site already uses: `{ time, open, high, low, close, volume }`.

- `definition` has the same shape as the entries in the built-in catalog (`sma`, `rsi`, `pressure` and so on), so it can be added to that list.
- `compute(candles, params)` returns the overlay line series named in `definition.outputs`: the two EMAs and the active swing high and low. The current chart can already draw these.
- `analyse(candles, params)` returns the parts the catalog can't express yet: `breaks` (BOS/CHoCH), `swings`, `signals` (entry, stop, targets, status), `leg` and `retracement`, and `dashboard`. Drawing these needs marker, box and table support in the chart component.
- `higherTimeframeTrend(candles, seconds)` resamples the feed to give the 15m and H1 arrows.

The value at every bar uses only that bar and earlier ones, so nothing repaints. The tests check this.

```sh
npm test
```

## Limitations

- A swing is only confirmed `swingLength` bars after it happens, so its label appears late.
- In ranges, structure flips often and signals whipsaw.
- Stops and targets are arithmetic. They are not a forecast. As with the rest of VT Impact, this describes what price has done and is not financial advice.
