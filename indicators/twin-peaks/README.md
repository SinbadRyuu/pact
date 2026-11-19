# PACT | Twin Peaks — V1

A TradingView indicator that finds double tops and double bottoms, follows each one from **developing** to **confirmed**, and marks the neckline, the breakout, retests, and reference stop and target levels.

| File | What it is |
| --- | --- |
| `twin-peaks.pine` | The indicator (Pine Script v6). Paste this into TradingView. |
| `twin-peaks.js` | The same rules in JavaScript, so they can be tested outside TradingView. |
| `twin-peaks.test.js` | Tests: clean patterns, rejected shapes, state changes, no duplicates, no repainting. |
| `scan.js` | Runs the rules over recent public crypto candles and counts what they find. |

## Add it to TradingView

1. Open a chart. Click **Pine Editor** at the bottom.
2. Select everything in the editor and delete it.
3. Paste the whole of `twin-peaks.pine`.
4. Click **Save**, then **Add to chart**.
5. If a red error appears at the bottom, screenshot it and send it over.

To get alerts: **Alerts → Create alert → Condition: Twin Peaks**. Then pick either:
- one of the named conditions (for example *Double top confirmed (SELL)*), or
- **Any alert() function call** for every event with full details (symbol, timeframe, pattern, stage, neckline, stop, target). Choose which events in the **Alerts** settings group.

## What you see on the chart

- **Dotted, softer lines**: a pattern that is still **developing**. It can still fail.
- **Solid lines and a BUY or SELL label**: the neckline broke on a closed bar. That label never moves.
- **Grey, dashed**: **invalidated** (price closed beyond the peaks) or **expired** (no breakout in time).
- **The tag on the neckline** says what the pattern is and its state. Hover over it to see why it qualified: peak difference, height, bars between peaks and the prior trend.
- **Hover over BUY or SELL** for the entry reference, stop, measured-move target and reward-to-risk.
- **ENTRY, STOP and TARGET lines** show for the latest signal by default, until one of them is hit.
- **The status panel** (top right) shows the latest double top and double bottom and their state.

## Signal modes

| Mode | Shows |
| --- | --- |
| **Combined** (default) | Developing patterns, BUY/SELL on the breakout, a small RETEST mark |
| **Early warning** | Developing patterns and their alerts. Breakouts are marked BREAK, not given as signals |
| **Breakout** | Only confirmed patterns, BUY/SELL on the breakout |
| **Breakout + retest** | BUY/SELL only when a breakout comes back to the neckline and holds |

## The rules

1. **Swings.** A swing high must be higher than the 6 bars before it, and not beaten by the 3 bars after it. That means a swing is only known 3 bars after it happens.
2. **The pair.** When a new swing forms, the script looks back for an earlier one:
   - 8 to 120 bars earlier
   - within 0.6 ATR in price
   - nothing in between goes beyond them
   - at least 2 ATR from the higher peak to the neckline (the lowest low between the peaks)
   - with a rise into the first peak at least as big as the pattern (a fall for bottoms). This can be turned off.
3. **Developing.** The pattern shows up when the second peak is confirmed, 3 bars after it.
4. **Confirmed.** A bar closes at least 0.1 ATR beyond the neckline, with optional volume and candle-body filters. If that first close is already more than 2.5 ATR past the neckline, the move is marked but no signal is given.
5. **Invalidated.** A close beyond the peaks by more than the tolerance.
6. **Expired.** No breakout within one pattern-width of bars after the second peak (at least 15 bars).
7. **Retest.** Within 20 bars of the breakout, price comes back within 0.3 ATR of the neckline and closes on the breakout side.
8. **Levels.** The stop goes 0.25 ATR beyond the highest peak or lowest bottom. The target is the measured move: pattern height projected from the neckline. Optional 1R, 2R and 3R targets.

If a newer pair forms while a pattern is still developing, the newer one replaces it. The old one was provisional, so it is removed.

A double top and a double bottom never share bars. The one found first stands. An opposite pattern that would overlap it is ignored, unless the first one has been invalidated or has expired. You can switch this off under **Detection**.

## Repainting

- Every decision is made on a **closed bar**. On the live bar, nothing changes until it closes.
- A BUY or SELL appears on the bar where the breakout became known, never on the earlier peak.
- Pattern lines are drawn back to the peaks for readability, but a pattern **appears** only when its second swing is confirmed.
- The JavaScript tests check this. They cut the chart short at many points and confirm every earlier event is identical.

## What has been checked, and what hasn't

- ✅ The rules in `twin-peaks.js` pass 12 tests: clean M and W patterns, rejected shapes, invalidation, expiry, retest, no duplicate events, no overlapping tops and bottoms, and no repainting.
- ✅ On recent public candles (BTC, ETH, SOL, PAXG gold and EUR on 15m, 1h, 4h and 1D), the defaults gave about 6 to 19 confirmed patterns per 1,000 bars. Run `node scan.js` to repeat this.
- ⚠️ **`twin-peaks.pine` has not been compiled yet.** No TradingView compiler is available outside TradingView. The script was written for Pine v6 and reviewed line by line against the JavaScript model, but the first paste into TradingView is its first compile.
- ⚠️ **There are no performance figures.** Win rate, profit factor and drawdown need a separate strategy script with defined entries, exits, costs and out-of-sample periods. That is Phase 6.

## Not in V1 yet

These are left out on purpose so the core works first:

- **Quality score (0–100):** Phase 4. For now, the tag tooltip shows the raw measurements a score would use.
- **RSI divergence filter:** Phase 3.
- **Warning before the second peak is confirmed:** for example, "price is testing the first peak's zone". V1 waits for the swing confirmation (3 bars by default). Lower *Swing confirmation* for earlier, noisier detection.
- **Strategy version for backtesting:** Phase 6.

## Run the tests

```sh
cd indicators/twin-peaks
npm test          # rule tests
node scan.js      # needs internet; counts patterns on public candles
```

Stops and targets are arithmetic from the pattern. They are not predictions, and this is not financial advice.
