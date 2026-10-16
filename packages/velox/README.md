# Velox V1: calculation engine

`@pact/velox` is the deterministic engine behind **Velox V1**, the PACT supply and demand indicator. It is pure TypeScript: no React, no DOM, no network, no randomness and no clock. **The same candles and settings always give the same zones, signals and scores.**

Engine version: `0.1.0`, recorded on every zone, signal and state.

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
const state = engine.state()            // zones, signals, swings, developing candidates
```

On a live feed, keep the engine and `push` each candle **when it closes**. Don't recalculate history on every tick. `cacheKey(instrument, settings)` gives a server cache key: provider, symbol, timeframe, settings hash and engine version.

## Time

All times are Unix seconds, UTC. A candle's `time` is when it **opened**. It is known when it **closes** (`time + timeframe`).

- `originTime` is where something happened, so the chart can draw the zone from there.
- `confirmedAt` is the close of the candle on which the engine could first know it. **Nothing exists in the state before its `confirmedAt`**, and the replay tests check this candle by candle.

## Definitions (v0.1.0)

Every number below is a setting. Defaults are in brackets.

**Swing.** A candle whose high (or low) beats the `swingLength` (3) candles on each side. Ties count on the left but not on the right, as TradingView's pivots do. It is confirmed when the `swingLength`-th candle after it closes.

**Base.** The swing candle plus quiet neighbours, each with a high–low range of at most `baseRangeATR` (1.0) × ATR, up to `maxBaseCandles` (3) candles in all.

**Zone edges (`zoneWidth`).**
- `body-wick` (default): the far edge is the base's extreme wick and the near edge is its extreme body. This is the usual supply/demand convention. It covers the rejection wicks without stretching to the full range.
- `wick`: the base's full high–low range. Wider zones, more touches.
- `body`: bodies only. Tighter zones, more invalidations.

The height is then kept between `minWidthATR` (0.1) and `maxWidthATR` (1.5) × ATR by moving the near edge, so the far edge (where the stop goes) never moves.

**Demand zone.** Starts from a confirmed swing low. Within `departureBars` (6) candles after the base, a candle closes at least `displacementATR` (1.5) × ATR above the near edge. If price closes below the far edge first, or the window ends, it is discarded. With `requireStructureBreak` the departure must also close above the last confirmed swing high. **Supply** is the mirror image. While waiting for the departure, a candidate is listed under `developing` and is not a zone.

A new zone is skipped if `overlapLimit` (50%) of its height overlaps a fresh or tested zone of the same type.

**Lifecycle.** The order below is checked on every candle after confirmation. Status only ever moves forward.

| Status | Rule (demand; supply mirrored) |
|---|---|
| fresh | Confirmed, and no low has reached the near edge since. |
| tested | A low reached the near edge. |
| mitigated | A low reached `mitigationDepth` (50%) of the way into the zone. |
| invalid | A candle closed below the far edge minus `invalidationATR` (0) × ATR. Final. |

**Touches.** A touch starts when price reaches the near edge. Candles that stay in or near the zone don't add touches. Price must first move `touchExitATR` (0.5) × ATR beyond the near edge before a new return counts as another touch.

**Strength (0–100).** This is the sum of weighted factors, and each zone carries its own breakdown (`score`) so every point can be explained:

| Factor | Weight | Full marks when |
|---|---|---|
| Departure | 35 | the close reaches 2× the displacement threshold (half marks at the threshold) |
| Structure break | 20 | the departure closed beyond the last opposite swing |
| Tight base | 15 | the zone is `minWidthATR` tall (none at `maxWidthATR`) |
| Speed | 10 | the threshold was reached on the first candle after the base |
| Timeframe | 10 | 4h/1d (1h 70%, 15m 40%, 5m 20%) |
| Freshness | 10 | fresh (once touched 50%, then 0) |

`strengthAtConfirmation` never changes. `strength` updates with freshness. **The weights are a starting point, not a measured result.** They are settings so they can be calibrated against how zones actually behaved.

**Signals.** On the **first** return to a fresh zone whose `strengthAtConfirmation` ≥ `signals.minStrength` (60):

- **Buy** at a demand zone, **sell** at a supply zone.
- **Entry** at the near edge, or at the candle's open if it opened inside the zone.
- **Stop loss** beyond the far edge by `signals.stopBufferATR` (0.1) × ATR.
- **Take profit is always 1:1 with the stop:** `TP = entry ± (entry − SL)`. For example, entry 4000.00 and SL 3990.00 give TP 4010.00. For a sell, entry 4000.00 and SL 4010.00 give TP 3990.00.
- Outcome: if a candle reaches both the stop and the target, it counts as a **loss**, because the order inside a candle is unknown. On the entry candle only the stop is checked.

## What the tests prove

- **No repainting:** 3,000 candles are fed one at a time with the state saved after each. Once a zone, swing or signal appears, its confirmed facts never change and it never disappears. Status only moves forward. Event history is never rewritten.
- **No back-dating:** everything first appears on exactly the candle its `confirmedAt` names. Two planted cheats were caught: zone confirmation back-dated to the swing, and swings confirmed one candle early.
- **Live = historical:** replaying bar by bar and recalculating from history give identical results.
- **Higher timeframes:** a 1h candle is unavailable until its last 15m candle closes. A missing quarter doesn't close an hour early. Partial first buckets are dropped. 4h is aligned to 00/04/08… UTC.
- **Data:** duplicates, out-of-order candles, impossible prices, gaps and off-grid times are all handled and reported.
- **Exact behaviour** on a hand-built gold path: zone edges, confirmation time, touches, every lifecycle step, signal levels and outcome, with supply checked as the mirror of demand.

## Not in v0.1.0 yet

Higher-timeframe confluence in the score, CHoCH and order blocks, and clustering beyond the overlap rule are planned (phases 6–8). Candle history is kept in memory. A server will want to cap it.

See `docs/velox/plan.md` for the plan, including the TradingView route.
