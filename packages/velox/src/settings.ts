import type { Timeframe } from './types.ts'

export const ENGINE_VERSION = `0.3.0`

/**
 * How a supply/demand zone's near (proximal) edge is drawn. The far (distal) edge is always the wick
 * of the origin candle.
 *  wick  the origin candle's wick: for demand, from its low up to the bottom of its body (default)
 *  atr   a fixed band of `zoneAtrBand` × ATR from the wick
 *  base  the origin candle plus quiet neighbours, up to their highest body (a broader zone)
 */
export type ZoneWidth = `wick` | `atr` | `base`

/** Which part of the order-block candle is used: its full range, its body, or wick-to-open. */
export type OrderBlockRange = `wick` | `body` | `hybrid`

export type VeloxSettings = {
  /** Candles each side of a swing. A swing is confirmed `swingLength` candles after it happens. */
  swingLength: number
  atrPeriod: number

  /**
   * true: zones only come from moves that broke structure (a candle closed beyond the last swing).
   * false: zones also come from any swing that price left by `zoneMinDisplacementATR` within
   * `departureBars`, without a break. Those score nothing for structure.
   */
  requireBOS: boolean
  zoneWidth: ZoneWidth
  zoneAtrBand: number
  /** Zones are kept between these heights (in ATR) by moving the near edge only. */
  minHeightATR: number
  maxHeightATR: number
  /** `base` width only: neighbours join the base if their range is at most this many ATRs … */
  baseRangeATR: number
  /** … up to this many candles in all. */
  maxBaseCandles: number
  /** The break (or departure) must close at least this many ATRs beyond the zone's near edge. */
  zoneMinDisplacementATR: number
  /** Window for zones without a break (`requireBOS: false`). */
  departureBars: number
  /** Candles from origin to break after which the speed factor scores nothing. */
  speedBars: number
  /** Skip a new zone if this fraction of its height overlaps a fresh or tested zone of the same type. 0 keeps all. */
  overlapLimit: number

  orderBlocks: {
    enabled: boolean
    /** Candles to look back from the origin for the last opposite-close candle. */
    lookback: number
    range: OrderBlockRange
    /** The break must close at least this many ATRs beyond the order block's near edge. */
    minDisplacementATR: number
    /** Strong candles in the move's direction needed between the order block and the break … */
    minImpulseCandles: number
    /** … where strong means body ÷ range at least this. */
    impulseBodyRatio: number
    /** The break must come within this many candles of the order block. */
    maxBars: number
    /** An order block counts as on a zone if it overlaps it or is within this many ATRs. */
    nearATR: number
    /** Failed order blocks become breaker blocks. */
    breakers: boolean
  }

  /** Another touch only counts after price has left by this many ATRs beyond the near edge. */
  touchExitATR: number
  /** Fraction of the height price must reach to count as mitigated. */
  mitigationDepth: number
  /** close: a candle must close beyond the far edge to invalidate. wick: touching beyond it is enough. */
  invalidation: `close` | `wick`
  invalidationBufferATR: number

  fvg: {
    enabled: boolean
    /** Gaps smaller than this many ATRs are ignored. */
    minSizeATR: number
  }

  weights: Record<`displacement` | `structure` | `orderBlock` | `fvg` | `speed` | `freshness` | `timeframe`, number>
  orderBlockWeights: Record<`displacement` | `structure` | `freshness` | `timeframe` | `zone` | `impulse` | `speed`, number>
  timeframeScore: Record<Timeframe, number>
}

export const DEFAULT_SETTINGS: VeloxSettings = {
  swingLength: 10,
  atrPeriod: 14,
  requireBOS: true,
  zoneWidth: `wick`,
  zoneAtrBand: 0.25,
  minHeightATR: 0.15,
  maxHeightATR: 1,
  baseRangeATR: 1,
  maxBaseCandles: 3,
  zoneMinDisplacementATR: 1.5,
  departureBars: 6,
  speedBars: 20,
  overlapLimit: 0.5,
  orderBlocks: {
    enabled: true,
    lookback: 5,
    range: `wick`,
    minDisplacementATR: 1.5,
    minImpulseCandles: 2,
    impulseBodyRatio: 0.5,
    maxBars: 30,
    nearATR: 0.5,
    breakers: true,
  },
  touchExitATR: 0.5,
  mitigationDepth: 0.5,
  invalidation: `close`,
  invalidationBufferATR: 0,
  fvg: { enabled: true, minSizeATR: 0.3 },
  // Starting weights, out of 100 each. Not calibrated yet: they are there to be tuned against results.
  weights: { displacement: 25, structure: 15, orderBlock: 15, fvg: 10, speed: 10, freshness: 10, timeframe: 15 },
  orderBlockWeights: { displacement: 20, structure: 20, freshness: 15, timeframe: 15, zone: 10, impulse: 10, speed: 10 },
  timeframeScore: { '5m': 0.2, '15m': 0.4, '1h': 0.7, '4h': 1, '1d': 1 },
}

export type VeloxSettingsInput = Partial<Omit<VeloxSettings, `orderBlocks` | `fvg` | `weights` | `orderBlockWeights` | `timeframeScore`>> & {
  orderBlocks?: Partial<VeloxSettings[`orderBlocks`]>
  fvg?: Partial<VeloxSettings[`fvg`]>
  weights?: Partial<VeloxSettings[`weights`]>
  orderBlockWeights?: Partial<VeloxSettings[`orderBlockWeights`]>
  timeframeScore?: Partial<VeloxSettings[`timeframeScore`]>
}

export function resolveSettings(input: VeloxSettingsInput = {}): VeloxSettings {
  const d = DEFAULT_SETTINGS
  const s: VeloxSettings = {
    ...d,
    ...input,
    orderBlocks: { ...d.orderBlocks, ...input.orderBlocks },
    fvg: { ...d.fvg, ...input.fvg },
    weights: { ...d.weights, ...input.weights },
    orderBlockWeights: { ...d.orderBlockWeights, ...input.orderBlockWeights },
    timeframeScore: { ...d.timeframeScore, ...input.timeframeScore },
  }
  const int = (v: number, name: string, min: number, max: number) => {
    if (!Number.isInteger(v) || v < min || v > max) throw new RangeError(`${name} must be a whole number from ${min} to ${max}`)
  }
  const pos = (v: number, name: string) => {
    if (!(Number.isFinite(v) && v >= 0)) throw new RangeError(`${name} must be zero or more`)
  }
  int(s.swingLength, `swingLength`, 1, 50)
  int(s.atrPeriod, `atrPeriod`, 1, 500)
  int(s.maxBaseCandles, `maxBaseCandles`, 1, 10)
  int(s.departureBars, `departureBars`, 1, 100)
  int(s.speedBars, `speedBars`, 1, 500)
  int(s.orderBlocks.lookback, `orderBlocks.lookback`, 0, 50)
  int(s.orderBlocks.minImpulseCandles, `orderBlocks.minImpulseCandles`, 0, 50)
  int(s.orderBlocks.maxBars, `orderBlocks.maxBars`, 1, 500)
  for (const k of [`zoneAtrBand`, `minHeightATR`, `maxHeightATR`, `baseRangeATR`, `zoneMinDisplacementATR`, `touchExitATR`, `invalidationBufferATR`] as const) pos(s[k], k)
  for (const k of [`minDisplacementATR`, `impulseBodyRatio`, `nearATR`] as const) pos(s.orderBlocks[k], `orderBlocks.${k}`)
  pos(s.fvg.minSizeATR, `fvg.minSizeATR`)
  if (s.minHeightATR > s.maxHeightATR) throw new RangeError(`minHeightATR must not exceed maxHeightATR`)
  if (!(s.mitigationDepth > 0 && s.mitigationDepth <= 1)) throw new RangeError(`mitigationDepth must be in (0, 1]`)
  if (!(s.overlapLimit >= 0 && s.overlapLimit <= 1)) throw new RangeError(`overlapLimit must be in [0, 1]`)
  if (s.orderBlocks.impulseBodyRatio > 1) throw new RangeError(`orderBlocks.impulseBodyRatio must be at most 1`)
  return s
}
