import type { Timeframe } from './types.ts'

export const ENGINE_VERSION = `0.2.0`

export type ZoneWidth = `body-wick` | `wick` | `body`

export type VeloxSettings = {
  /** Candles each side of a swing. A swing is confirmed `swingLength` candles after it happens. */
  swingLength: number
  atrPeriod: number

  /** Most candles a base can have, including the swing candle. */
  maxBaseCandles: number
  /** A neighbour joins the base only if its high–low range is at most this many ATRs. */
  baseRangeATR: number
  /**
   * How the zone's edges are drawn from the base candles:
   *  body-wick  far edge at the extreme wick, near edge at the extreme body (default; the usual S&D convention)
   *  wick       full high–low range of the base
   *  body       bodies only
   */
  zoneWidth: ZoneWidth
  /** Zones are widened to at least this many ATRs tall … */
  minWidthATR: number
  /** … and trimmed (on the near edge) to at most this many. */
  maxWidthATR: number

  /** Price must close at least this many ATRs beyond the near edge … */
  displacementATR: number
  /** … within this many candles after the base. */
  departureBars: number
  /** Only keep zones whose departure also closed beyond the last opposite swing. */
  requireStructureBreak: boolean
  /** Skip a new zone if this fraction of its height overlaps a fresh or tested zone of the same type. 0 keeps every zone. */
  overlapLimit: number

  /** Another touch only counts after price has left the zone by this many ATRs. */
  touchExitATR: number
  /** Fraction of the zone's height price must reach for the zone to count as mitigated. */
  mitigationDepth: number
  /** A close this many ATRs beyond the far edge invalidates the zone. */
  invalidationATR: number

  signals: {
    enabled: boolean
    /** Only zones at least this strong produce a signal. */
    minStrength: number
    /** Stop-loss distance beyond the far edge, in ATRs. */
    stopBufferATR: number
  }

  fvg: {
    enabled: boolean
    /** Gaps smaller than this many ATRs are ignored. */
    minSizeATR: number
  }

  weights: Record<`displacement` | `structure` | `fvg` | `base` | `speed` | `timeframe` | `freshness`, number>
  timeframeScore: Record<Timeframe, number>
}

export const DEFAULT_SETTINGS: VeloxSettings = {
  swingLength: 3,
  atrPeriod: 14,
  maxBaseCandles: 3,
  baseRangeATR: 1,
  zoneWidth: `body-wick`,
  minWidthATR: 0.1,
  maxWidthATR: 1.5,
  displacementATR: 1.5,
  departureBars: 6,
  requireStructureBreak: false,
  overlapLimit: 0.5,
  touchExitATR: 0.5,
  mitigationDepth: 0.5,
  invalidationATR: 0,
  signals: { enabled: true, minStrength: 60, stopBufferATR: 0.1 },
  // Starting weights, out of 100. Not calibrated yet: they are there to be tuned against historical results.
  fvg: { enabled: true, minSizeATR: 0.3 },
  weights: { displacement: 30, structure: 20, fvg: 10, base: 15, speed: 5, timeframe: 10, freshness: 10 },
  timeframeScore: { '5m': 0.2, '15m': 0.4, '1h': 0.7, '4h': 1, '1d': 1 },
}

export type VeloxSettingsInput = Partial<Omit<VeloxSettings, `signals` | `fvg` | `weights` | `timeframeScore`>> & {
  signals?: Partial<VeloxSettings[`signals`]>
  fvg?: Partial<VeloxSettings[`fvg`]>
  weights?: Partial<VeloxSettings[`weights`]>
  timeframeScore?: Partial<VeloxSettings[`timeframeScore`]>
}

export function resolveSettings(input: VeloxSettingsInput = {}): VeloxSettings {
  const s: VeloxSettings = {
    ...DEFAULT_SETTINGS,
    ...input,
    signals: { ...DEFAULT_SETTINGS.signals, ...input.signals },
    fvg: { ...DEFAULT_SETTINGS.fvg, ...input.fvg },
    weights: { ...DEFAULT_SETTINGS.weights, ...input.weights },
    timeframeScore: { ...DEFAULT_SETTINGS.timeframeScore, ...input.timeframeScore },
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
  for (const k of [`baseRangeATR`, `minWidthATR`, `maxWidthATR`, `displacementATR`, `touchExitATR`, `invalidationATR`] as const) pos(s[k], k)
  pos(s.signals.stopBufferATR, `signals.stopBufferATR`)
  pos(s.fvg.minSizeATR, `fvg.minSizeATR`)
  if (s.minWidthATR > s.maxWidthATR) throw new RangeError(`minWidthATR must not exceed maxWidthATR`)
  if (!(s.mitigationDepth > 0 && s.mitigationDepth <= 1)) throw new RangeError(`mitigationDepth must be in (0, 1]`)
  if (!(s.overlapLimit >= 0 && s.overlapLimit <= 1)) throw new RangeError(`overlapLimit must be in [0, 1]`)
  return s
}
