# Velox V1: demand zones vs order blocks (design proposal)

Status: **approved and built** (engine 0.3.0 and the TradingView script), with these choices: demand = thin wick band, order block = **full wick range** (`obRange = wick`), swing length 10, buy/sell signals removed.
Written 19 October 2026, after the review of Velox V1 next to FluidTrades SMC Lite on XAUUSD 5m.

## What the review showed

- The **demand zones you want** are the ones in the FluidTrades screenshot: a thin band at **the low that the move launched from**, where that move then broke a previous high. *"That low broke that high … that's the strong demand zone off that wick, because you've had a break of structure off it."*
- What Velox drew as "DEMAND" was a broad base box, and its order blocks were labelled **"OB @ DEMAND"**, which read as an order block being called a demand zone. Both need fixing.
- Remove the **buy/sell signals** and the **Fibonacci**.
- Keep **sessions**, **FVGs**, **BOS/CHoCH** and **breaker blocks**.
- Add **multi-timeframe** zones.

## 1. The difference, in plain words

| | Demand zone | Bullish order block |
|---|---|---|
| **What it is** | The **place** price turned up from: the low (wick) that the move launched from, when that move went on to break a previous swing high. | The **candle** the move started from: the last down-close candle before the bullish move. |
| **Built from** | Wicks: the low of the turning candle and its lower wick. | The candle's body: its open and close. |
| **When it becomes real** | At the close of the candle that breaks the swing high (the BOS/CHoCH). | At the same moment, and only if the move away from it was strong enough. Before that it is just a red candle. |
| **Can exist without the other?** | Yes. There may be no down-close candle near the low (for example, a hammer after green candles), or the candle may fail the order block's stricter rules. | No. An order block only exists as the origin of a move that also created a demand zone, so it always sits on or next to one. |
| **When they overlap** | Confluence: the demand zone's strength goes up and the order block is linked to it. | |

**Supply zones and bearish order blocks are the exact mirror:** the high that the drop launched from, and the last up-close candle before the drop.

> Your written spec describes demand as the *broader* area with the order block inside it. Your voice note and the FluidTrades screenshot describe demand as a *thin wick zone at the low*, with the order block being the candle body next to it. These two can't both be the default. Velox will default to the screenshot version, and the broader "base" version stays available as a setting (`demandWidth = base`). See question 1.

## 2. Deterministic V1 algorithms

Every rule runs on **closed candles only**. A candle that is still forming can't create, confirm or invalidate anything.

### 2.1 Swings and structure (shared)

1. **Swing high:** a candle whose high is greater than the `swingLength` candles on its right and at least as high as those on its left. It is confirmed `swingLength` candles later. The swing low is the mirror.
2. **Bullish break:** a candle **closes** above the most recent confirmed swing high that hasn't been broken yet. If the trend was down or undecided it is a **CHoCH**, otherwise a **BOS**. The bearish break is the mirror. Each break is stored as a `StructureEvent { id, kind, direction, level, swingId, time }`.

### 2.2 Demand zone

On every bullish BOS/CHoCH at candle `t`, breaking swing high `H` at candle `h`:

1. **Origin:** the candle `o` with the **lowest low** strictly after `h`, up to and including `t`. This is "the low that broke the high". It is known at `t`, because it is a minimum over candles that have all closed.
2. **Distal edge:** `low[o]`, the wick.
3. **Proximal edge** (`demandWidth`):
   - `wick` (default): `min(open[o], close[o])`, the top of the lower wick.
   - `atr`: `low[o] + demandAtrBand × ATR`, the same shape as the FluidTrades bands.
   - `base`: the highest body of `o` plus its quiet neighbours. This is the broader zone from the written spec.

   The height is then kept between `minHeightATR` and `maxHeightATR` × ATR by moving the proximal edge only, so the distal edge never moves.
4. **Displacement check:** `(close[t] − proximal) / ATR[o] ≥ demandMinDisplacementATR`. If it fails, no zone is created.
5. **Overlap check:** if at least `overlapLimit` of the new zone overlaps a live demand zone on the same timeframe, the new one is dropped.
6. **Store the zone:**
   - `originTime = time[o]` (where the chart starts drawing it)
   - `confirmedAt = close time of t`
   - `structureEventId` (the break)
   - `displacementATR` and `departureBars = t − o`

**Without a BOS** (`requireBOS = false`): a second source can be switched on. It creates a demand zone from any confirmed swing low that moves `demandMinDisplacementATR` away within `departureBars` candles, even with no break. These zones always score lower. This is what Velox did before.

### 2.3 Bullish order block

On the **same** bullish break (`t`, origin `o`):

1. **Origin candle:** starting at `o` and working back up to `obLookback` candles, take the first candle that **closed down** (`close < open`). If there is none, there is **no order block** for this break, but the demand zone still stands.
2. **Edges** (`obRange`):
   - `wick` (default): its full low–high range.
   - `body`: from the candle's close up to its open.
   - `hybrid`: from its low up to its open.
3. **It must have caused the move.** Reject the order block if any of these is true:
   - `(close[t] − proximal) / ATR < obMinDisplacementATR` (the move away was too small).
   - Fewer than `minImpulseCandles` up-close candles between the order block and `t` have a body of at least `impulseBodyRatio` of their range.
   - `t − ob > obMaxBars` (the break came too long after it).
   - Any candle between the order block and `t` closed below its distal edge.
4. **Store it:**
   - `originTime = time[ob]`
   - `confirmedAt = close time of t` (it is only known to be an order block once the break happens)
   - `bosId`
   - `parentZoneId`: the demand zone from step 2.2 if they overlap or are within `obNearATR` × ATR of each other. That zone gets the confluence bonus and lists the order block in `relatedOrderBlockIds`.

### 2.4 Lifecycle (zones and order blocks use the same rules)

| State | Rule (demand / bullish order block; supply and bearish are the mirror) |
|---|---|
| developing | (optional display) a confirmed swing low that has bounced but not broken structure yet. **Never used for trading or alerts.** |
| fresh | confirmed, and no candle's low has reached the proximal edge since. |
| tested | a candle's low reached the proximal edge. This counts as **one visit**, however many candles stay inside. A new visit only counts after a candle's low has been more than `touchExitATR` × ATR above the proximal edge. |
| mitigated | a candle's low reached `mitigationDepth` of the way from the proximal edge to the distal edge. |
| invalid | a candle **closed** below the distal edge minus `invalidationBufferATR` × ATR. A wick through it is not enough (unless `invalidation = wick`). |

**Nothing is deleted from the engine's history**, so states can be replayed and tested. The chart hides invalid items by default.

**Breaker block:** when an order block goes invalid and `showBreakers` is on, it is redrawn as a breaker with its role flipped (a failed bullish order block becomes resistance). The breaker ends when a candle closes back through it.

### 2.5 Strength (0–100, every point explained)

Starting weights. They are settings and **not calibrated yet**.

| Demand / supply zone | Max | Order block | Max |
|---|---|---|---|
| Displacement (ATR multiple) | 25 | Displacement | 20 |
| Structure (BOS/CHoCH; 0 in the no-BOS source) | 15 | Caused the BOS | 20 |
| Order block inside or next to it | 15 | Freshness | 15 |
| FVG left by the departure | 10 | Timeframe | 15 |
| Speed (`t − o` in candles) | 10 | Sits on a demand zone | 10 |
| Freshness | 10 | Impulse quality (body ratio) | 10 |
| Timeframe | 15 | Speed | 10 |
| (Higher-timeframe overlap: planned, not yet scored) | | | |

## 3. Every setting

| Setting | Default | What it does |
|---|---|---|
| `swingLength` | **10** | Candles each side of a swing (FluidTrades uses 10; 3 gave too many) |
| `atrPeriod` | 14 | ATR used for every "× ATR" setting |
| `requireBOS` | true | Demand/supply only from moves that broke structure |
| `demandWidth` | `wick` | `wick` / `atr` / `base` |
| `demandAtrBand` | 0.25 | Height for `atr` mode |
| `minHeightATR` / `maxHeightATR` | 0.15 / 1.0 | Keeps zones visible but not huge |
| `demandMinDisplacementATR` | 1.5 | Minimum move away for a zone |
| `departureBars` | 6 | Window for the no-BOS source |
| `overlapLimit` | 0.5 | Drop a new zone that mostly overlaps a live one |
| `obLookback` | 5 | How far back from the low to look for the last opposite-close candle |
| `obRange` | `wick` | `wick` / `body` / `hybrid` |
| `obMinDisplacementATR` | 1.5 | Minimum move away for an order block |
| `minImpulseCandles` | 2 | Strong candles needed in the move |
| `impulseBodyRatio` | 0.5 | What counts as a strong candle (body ÷ range) |
| `obMaxBars` | 30 | Break must come within this many candles |
| `obNearATR` | 0.5 | How close an order block must be to count as "on" a zone |
| `touchExitATR` | 0.5 | Distance price must leave before another visit counts |
| `mitigationDepth` | 0.5 | Mitigated at halfway |
| `invalidation` / `invalidationBufferATR` | `close` / 0 | `close` or `wick`, plus an optional buffer |
| `showBreakers` | true | Turn failed order blocks into breakers |
| `timeframes` | chart + 15m, 1H, 4H | Higher timeframes to show (only those above the chart's) |
| `maxPerSide` | 3 | Nearest live zones shown above and below price, per timeframe, plus any zone price is inside |
| `showInvalid` / `showDeveloping` | false / false | Show history or candidates |
| `weights.*` | table 2.5 | Strength weights |

## 4. How it stays honest (no repainting, no look-ahead)

1. **Two times on everything.** `originTime` is where it is drawn from. `confirmedAt` is when it became known: the close of the breaking candle. Alerts, backtests and replays only ever use `confirmedAt`.
2. **Closed candles only.** In the TradingView script, structure breaks, zone and order block creation, and invalidation all wait for `barstate.isconfirmed`. A live candle that pokes above a high and then falls back creates nothing.
3. **Origins are minimums over closed candles.** The demand origin is the lowest low between the swing high and the breaking candle, so it can't move once the break has closed. Swings are only used after their confirmation candle.
4. **The lifecycle only moves forward:** fresh → tested → mitigated → invalid. Future candles change the status, never the edges, origin or confirmation time.
5. **Higher timeframes use closed candles only.** In the engine, `aggregate()` already keeps a forming hour or 4h candle out of the confirmed list, and that is tested. In Pine, TradingView's standard non-repainting request is used (`expr[1]` with `lookahead_on`): at 10:15, the 15m chart sees 1H zones from the 09:00 candle at most, never the 10:00 one.
6. **Proof.** The engine's replay test feeds candles one at a time and fails if anything confirmed is rewritten, back-dated or deleted. It already caught two planted cheats. The 12 cases from the spec become named tests:

| # | Test | Expected |
|---|---|---|
| 1 | Clear base, strong displacement, bullish BOS | Demand zone at the wick of the low, `confirmedAt` = BOS close |
| 2 | Weak bounce, no displacement | No zone |
| 3 | Strong move, no BOS | No zone with `requireBOS`; otherwise a lower-scored zone |
| 4 | Valid bullish order block | Exists only from the BOS candle's close, drawn from its own candle |
| 5 | More candles arrive | Edges, origin and `confirmedAt` unchanged |
| 6 | Five candles inside the zone | One visit |
| 7 | Leaves by ≥ `touchExitATR` and returns | Second visit |
| 8 | Wick below the distal edge, close above | Still valid (close mode) |
| 9 | Close below the distal edge | Invalid |
| 10 | 15m chart with 1H zones | No forming 1H candle used |
| 11 | Order block inside a demand zone | Demand gets the order-block bonus; order block has `parentZoneId` |
| 12 | Down-close candle with no displacement or BOS | Rejected as an order block |

## 5. What changes, once approved

**Engine (`packages/velox`, version 0.3.0):** new `StructureEvent` and `OrderBlock` types; demand/supply from the break origin (wick); order blocks with the validation above; parent/child links; the new strength tables; tests 1–12.

**TradingView script (`indicators/velox/velox-v1.pine`):**
- Demand/supply drawn as thin wick bands from the origin low/high, labelled `DEMAND · 82` / `1H DEMAND · 88`.
- Order blocks labelled **`OB`** only, never "OB @ DEMAND". A thicker border marks one that sits on a zone.
- Breaker blocks, FVGs, BOS/CHoCH and sessions stay.
- **Buy/sell signals and the Fibonacci are removed.**
- 15m, 1H and 4H zones are shown on lower charts, from closed higher-timeframe candles only.
- Alerts: new demand/supply zone, new order block, price entering a fresh zone.
