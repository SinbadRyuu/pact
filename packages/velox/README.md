# Velox V1: calculation engine

`@pact/velox` is the deterministic engine behind **Velox V1**, the PACT supply and demand indicator. It is pure TypeScript: no React, no DOM, no network, no randomness and no clock. **The same candles and settings always give the same zones, signals and scores.**

Engine version: `0.3.0`, recorded on every zone, signal and state.

```sh
npm test         # node --test (Node 22.18+ runs the TypeScript directly)
npm run typecheck
```

## Use

```ts
import { createEngine, normalise } from '@pact/velox'

const { candles, issues } = normalise(providerCandles, { timeframe: '15m' })
const engine = createEngine({ symbol: 'XAUUSD', provider: 'coinbase-paxg', timeframe: '15m', pricePrecision: 2 })
for (const c of candles) engine.push(c) // CLOSED candles only, oldest first
const state = engine.state()            // zones, order blocks, structure breaks, fair value gaps, swings
```

On a live feed, keep the engine and `push` each candle **when it closes**. Don't recalculate history on every tick. `cacheKey(instrument, settings)` gives a server cache key: provider, symbol, timeframe, settings hash and engine version.

## Time

All times are Unix seconds, UTC. A candle's `time` is when it **opened**. It is known when it **closes** (`time + timeframe`).

- `originTime` is where something happened, so the chart can draw the zone from there.
- `confirmedAt` is the close of the candle on which the engine could first know it. **Nothing exists in the state before its `confirmedAt`**, and the replay tests check this candle by candle.

## Definitions (v0.3.0)

The full design, with the reasoning, is in `docs/velox/zones-and-order-blocks.md`. Every number below is a setting. Defaults are in brackets.

**Swing.** A candle whose high (or low) beats the `swingLength` (10) candles on each side. Ties count on the left but not on the right, as TradingView's pivots do. It is confirmed when the `swingLength`-th candle after it closes.

**Break of structure.** A candle **closes** above the last confirmed swing high that hasn't been broken yet (or below the last swing low). If the trend was the other way, or there was none, it is a **CHoCH**; otherwise it is a **BOS**.

**Demand zone: the place price turned from.** On a bullish break, the origin is the **lowest low** between the broken swing high and the breaking candle: "the low that broke the high". The zone runs from that wick up to the near edge (`zoneWidth`):
- `wick` (default): the bottom of the origin candle's body, so the zone is the lower wick.
- `atr`: a band of `zoneAtrBand` (0.25) × ATR from the wick.
- `base`: the highest body of the origin candle plus its quiet neighbours. This is a broader zone.

The height is kept between `minHeightATR` (0.15) and `maxHeightATR` (1.0) × ATR by moving the near edge only. The breaking candle must close at least `zoneMinDisplacementATR` (1.5) × ATR beyond the near edge. A new zone is skipped if `overlapLimit` (50%) of it overlaps a fresh or tested zone. **Supply** is the mirror image.

With `requireBOS: false`, zones also come from any confirmed swing that price leaves by `zoneMinDisplacementATR` within `departureBars` (6) candles, without a break. These zones score nothing for structure.

**Order block: the candle the move started from.** On the same break: the last **down-close** candle (bullish) or **up-close** candle (bearish) at or before the origin, up to `orderBlocks.lookback` (5) candles back. Its edges (`orderBlocks.range`) are `wick` (default, the full low–high), `body` (open–close) or `hybrid` (low–open). It is only kept if all of these hold:
- the break closed at least `minDisplacementATR` (1.5) × ATR beyond it
- the move had at least `minImpulseCandles` (2) strong candles, each with a body of at least `impulseBodyRatio` (0.5) of its range
- the break came within `maxBars` (30) candles
- no candle closed through it on the way

It is confirmed when the breaking candle closes, not when its own candle closed. It links to the zone it sits on (`parentZoneId`, within `nearATR` (0.5) × ATR). The zone records it in `source.orderBlockId` and `relatedOrderBlockIds`.

**Breaker block.** When an order block is invalidated, it becomes a breaker (`breaker.since`) and its role flips: a failed bullish order block now acts as resistance. The breaker ends (`breaker.endedAt`) when a later candle closes back beyond its near edge.

**Fair value gap (FVG).** A three-candle imbalance. **Bullish:** the third candle's low is above the first candle's high, and the gap is the range between them. **Bearish:** the third candle's high is below the first candle's low. The gap is drawn from the middle candle and confirmed when the third candle closes. Gaps smaller than `fvg.minSizeATR` (0.3) × ATR are ignored. Status goes **open** → **partial** → **filled**.

**Lifecycle (zones and order blocks).** Checked in this order on every candle after confirmation. Status only ever moves forward, and nothing is deleted from the history.

| Status | Rule (demand / bullish; supply / bearish mirrored) |
|---|---|
| fresh | Confirmed, and no low has reached the near edge since. |
| tested | A low reached the near edge. Candles staying inside count as **one visit**. Another visit only counts after a low has been more than `touchExitATR` (0.5) × ATR above the near edge. |
| mitigated | A low reached `mitigationDepth` (50%) of the way to the far edge. |
| invalid | A candle **closed** below the far edge minus `invalidationBufferATR` (0) × ATR (`invalidation: close`), or a wick went below it (`invalidation: wick`). |

**Strength (0–100), with a line-by-line breakdown in `score`.** The weights are starting points, not measured results.

| Zone | Max | Order block | Max |
|---|---|---|---|
| Displacement (half at the minimum, full at twice it) | 25 | Displacement | 20 |
| Launched a break of structure | 15 | Caused the break | 20 |
| Order block on the zone | 15 | Freshness | 15 |
| FVG in the move | 10 | Timeframe | 15 |
| Speed (`speedBars` (20) candles scores 0) | 10 | On a zone | 10 |
| Freshness | 10 | Impulse | 10 |
| Timeframe | 15 | Speed (`maxBars` scores 0) | 10 |

`strengthAtConfirmation` never changes. `strength` updates with freshness.

Buy/sell signals were removed in 0.3.0.

## What the tests prove

- **No repainting:** 3,000 candles are fed one at a time with the state saved after each. Once a zone, order block, break, FVG or swing appears, its confirmed facts never change and it never disappears. Status only moves forward, and event, link and breaker history only grow.
- **No back-dating:** everything first appears on exactly the candle its `confirmedAt` names. On 0.3.0, two planted cheats were caught: zones back-dated to their low/high, and order blocks back-dated to their own candle. Earlier versions also caught swings and FVGs claimed one candle early.
- **Live = historical:** replaying bar by bar and recalculating from history give identical results.
- **Higher timeframes:** a 1h candle is unavailable until its last 15m candle closes. A missing quarter doesn't close an hour early. Partial first buckets are dropped. 4h is aligned to 00/04/08… UTC.
- **Data:** duplicates, out-of-order candles, impossible prices, gaps and off-grid times are all handled and reported.
- **The 12 spec cases** (`test/zones.test.ts`) on a hand-built gold path: the demand zone at the wick of the low that broke the high; no zone from a weak bounce; no zone without a break unless `requireBOS` is off; the order block existing only from the break; nothing moving later; one visit for five candles; a second visit after leaving; a wick through not invalidating, but a close through doing so; closed higher-timeframe candles only; order block/zone links and the bonus; and order blocks rejected for a weak move. Also tested: breakers, zone shapes, and supply/bearish as the exact mirror.

## Not in v0.3.0 yet

Higher-timeframe confluence in the score and a `developing` state are planned. The TradingView script already shows higher-timeframe zones. Candle history is kept in memory, and a server will want to cap it.

See `docs/velox/plan.md` for the plan, including the TradingView route.
