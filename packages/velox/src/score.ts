import type { VeloxSettings } from './settings.ts'
import type { ScoreFactor, Timeframe, ZoneStatus } from './types.ts'

/** The facts a zone's score is built from. All of them are fixed when the zone is confirmed. */
export type ZoneScoreInput = {
  displacementATR: number
  departureBars: number
  /** The zone launched a break of structure. */
  structure: boolean
  /** The same break produced an order block on this zone. */
  orderBlock: boolean
  fvg: boolean
  timeframe: Timeframe
}

/** The facts an order block's score is built from, fixed at confirmation. */
export type OrderBlockScoreInput = {
  displacementATR: number
  impulseCandles: number
  /** Candles from the order block to the break. */
  bars: number
  onZone: boolean
  timeframe: Timeframe
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const one = (v: number) => Math.round(v * 10) / 10
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? `` : `s`}`

function freshness(status: ZoneStatus, touches: number): [number, string] {
  if (status === `fresh`) return [1, `Price has not returned.`]
  if (status === `tested`) return [touches <= 1 ? 0.5 : 0, `Visited ${plural(touches, `time`)}.`]
  return [0, `It is ${status}.`]
}

function total<K extends string>(parts: [K, string, number, string][], w: Record<K, number>): { strength: number; factors: ScoreFactor[] } {
  const factors = parts.map(([key, label, fraction, detail]) => ({ key: key as unknown as ScoreFactor[`key`], label, points: one(fraction * w[key]), max: w[key], detail }))
  const max = factors.reduce((a, f) => a + f.max, 0)
  const got = factors.reduce((a, f) => a + f.points, 0)
  return { strength: max > 0 ? Math.round((100 * got) / max) : 0, factors }
}

/**
 * Zone strength, 0–100, as weighted factors that each score 0–1:
 *  displacement  half marks at zoneMinDisplacementATR, full at twice it
 *  structure     the zone launched a break of structure
 *  orderBlock    the same break produced an order block on the zone
 *  fvg           the departure left a fair value gap
 *  speed         full when the break came on the next candle, none at speedBars
 *  freshness     fresh 1, one visit 0.5, then 0
 *  timeframe     the timeframe's own weight (4h more than 5m)
 * The weights are a starting point, not a measured result.
 */
export function scoreZone(input: ZoneScoreInput, status: ZoneStatus, touches: number, s: VeloxSettings) {
  const [fresh, freshDetail] = freshness(status, touches)
  return total(
    [
      [`displacement`, `Displacement`, clamp01(input.displacementATR / (2 * s.zoneMinDisplacementATR)), `Price closed ${input.displacementATR.toFixed(1)} ATR beyond the zone.`],
      [`structure`, `Structure break`, input.structure ? 1 : 0, input.structure ? `The move from here broke structure.` : `No break of structure.`],
      [`orderBlock`, `Order block`, input.orderBlock ? 1 : 0, input.orderBlock ? `An order block sits on the zone.` : `No order block on the zone.`],
      [`fvg`, `Fair value gap`, input.fvg ? 1 : 0, input.fvg ? `The move left a fair value gap.` : `No fair value gap in the move.`],
      [`speed`, `Speed`, clamp01(1 - (input.departureBars - 1) / s.speedBars), `${plural(input.departureBars, `candle`)} from the low/high to the break.`],
      [`freshness`, `Freshness`, fresh, freshDetail],
      [`timeframe`, `Timeframe`, clamp01(s.timeframeScore[input.timeframe]), `${input.timeframe} zone.`],
    ],
    s.weights,
  )
}

/**
 * Order-block strength, 0–100:
 *  displacement  half marks at orderBlocks.minDisplacementATR, full at twice it
 *  structure     it caused a break of structure (always true: it is required)
 *  freshness     as for zones
 *  timeframe     as for zones
 *  zone          it sits on a supply/demand zone
 *  impulse       strong candles in the move: full at twice minImpulseCandles
 *  speed         full when the break came on the next candle, none at orderBlocks.maxBars
 */
export function scoreOrderBlock(input: OrderBlockScoreInput, status: ZoneStatus, touches: number, s: VeloxSettings) {
  const ob = s.orderBlocks
  const [fresh, freshDetail] = freshness(status, touches)
  return total(
    [
      [`displacement`, `Displacement`, clamp01(input.displacementATR / (2 * ob.minDisplacementATR)), `The break closed ${input.displacementATR.toFixed(1)} ATR beyond it.`],
      [`structure`, `Structure break`, 1, `The move from it broke structure.`],
      [`freshness`, `Freshness`, fresh, freshDetail],
      [`timeframe`, `Timeframe`, clamp01(s.timeframeScore[input.timeframe]), `${input.timeframe} order block.`],
      [`zone`, `On a zone`, input.onZone ? 1 : 0, input.onZone ? `It sits on a supply/demand zone.` : `It is not on a zone.`],
      [`impulse`, `Impulse`, ob.minImpulseCandles === 0 ? 1 : clamp01(input.impulseCandles / (2 * ob.minImpulseCandles)), `${plural(input.impulseCandles, `strong candle`)} in the move.`],
      [`speed`, `Speed`, clamp01(1 - (input.bars - 1) / ob.maxBars), `${plural(input.bars, `candle`)} to the break.`],
    ],
    s.orderBlockWeights,
  )
}
