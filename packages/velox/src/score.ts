import type { VeloxSettings } from './settings.ts'
import type { ScoreFactor, Timeframe, ZoneStatus } from './types.ts'

/** The facts a zone's score is built from. All of them are fixed when the zone is confirmed. */
export type ScoreInput = {
  displacementATR: number
  departureBars: number
  heightATR: number
  brokeStructure: boolean
  fvg: boolean
  timeframe: Timeframe
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const one = (v: number) => Math.round(v * 10) / 10

/**
 * Strength from 0 to 100, as a sum of weighted factors that each score 0–1:
 *
 *  displacement  how far price left: half marks at the threshold, full marks at twice it
 *  structure     whether the departure closed beyond the last opposite swing
 *  fvg           whether the departure left a fair value gap in the zone's direction
 *  base          how tight the zone is: full at minWidthATR, none at maxWidthATR
 *  speed         how quickly the threshold was reached: full on the first candle
 *  timeframe     the timeframe's own weight (4h counts more than 15m)
 *  freshness     fresh 1, touched once 0.5, more often 0; mitigated or invalid 0
 *
 * The weights are a starting point, not a measured result. They are settings so they can be
 * calibrated against how zones actually behaved.
 */
export function scoreZone(input: ScoreInput, status: ZoneStatus, touches: number, s: VeloxSettings): { strength: number; factors: ScoreFactor[] } {
  const w = s.weights
  const parts: [ScoreFactor[`key`], string, number, string][] = [
    [
      `displacement`,
      `Departure`,
      clamp01(input.displacementATR / (2 * s.displacementATR)),
      `Closed ${input.displacementATR.toFixed(1)} ATR beyond the zone (threshold ${s.displacementATR}).`,
    ],
    [
      `structure`,
      `Structure break`,
      input.brokeStructure ? 1 : 0,
      input.brokeStructure ? `The departure closed beyond the last opposite swing.` : `The departure did not break the last opposite swing.`,
    ],
    [
      `fvg`,
      `Fair value gap`,
      input.fvg ? 1 : 0,
      input.fvg ? `The departure left a fair value gap.` : `The departure left no fair value gap.`,
    ],
    [
      `base`,
      `Tight base`,
      s.maxWidthATR === s.minWidthATR ? 1 : clamp01((s.maxWidthATR - input.heightATR) / (s.maxWidthATR - s.minWidthATR)),
      `Zone is ${input.heightATR.toFixed(2)} ATR tall.`,
    ],
    [
      `speed`,
      `Speed`,
      clamp01(1 - (input.departureBars - 1) / s.departureBars),
      `Threshold reached ${input.departureBars} candle${input.departureBars === 1 ? `` : `s`} after the base.`,
    ],
    [`timeframe`, `Timeframe`, clamp01(s.timeframeScore[input.timeframe]), `${input.timeframe} zone.`],
    [
      `freshness`,
      `Freshness`,
      status === `fresh` ? 1 : status === `tested` && touches <= 1 ? 0.5 : 0,
      status === `fresh` ? `Price has not returned.` : status === `tested` ? `Touched ${touches} time${touches === 1 ? `` : `s`}.` : `Zone is ${status}.`,
    ],
  ]
  const factors = parts.map(([key, label, fraction, detail]) => ({ key, label, points: one(fraction * w[key]), max: w[key], detail }))
  const max = factors.reduce((a, f) => a + f.max, 0)
  const got = factors.reduce((a, f) => a + f.points, 0)
  return { strength: max > 0 ? Math.round((100 * got) / max) : 0, factors }
}
