import type { Candle, Timeframe } from './types.ts'

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
}

/** A candle as a provider might send it: time in seconds, milliseconds or ISO text, numbers possibly as strings. */
export type RawCandle = {
  time: number | string
  open: number | string
  high: number | string
  low: number | string
  close: number | string
  volume?: number | string | null
}

export type CandleIssue = {
  kind: `invalid` | `duplicate` | `out-of-order` | `misaligned` | `gap`
  time: number | null
  detail: string
}

export type NormaliseOptions = {
  timeframe: Timeframe
  /** Unit of numeric `time` values. ISO strings are always parsed as UTC. */
  timeUnit?: `s` | `ms`
}

/**
 * Turns provider candles into the engine's candle type:
 *  - times become UTC seconds of the candle's open
 *  - candles with impossible prices are dropped
 *  - duplicate times keep the LAST copy (a re-sent candle is the newer version)
 *  - the result is sorted by time
 * Every change is reported in `issues`, so data problems are visible instead of silent.
 * Gaps are reported, never filled: inventing candles would invent swings.
 */
export function normalise(raw: readonly RawCandle[], options: NormaliseOptions): { candles: Candle[]; issues: CandleIssue[] } {
  const step = TIMEFRAME_SECONDS[options.timeframe]
  const issues: CandleIssue[] = []
  const byTime = new Map<number, Candle>()
  let previous = -Infinity

  for (const r of raw) {
    const time = toSeconds(r.time, options.timeUnit ?? `s`)
    const c: Candle = { time, open: Number(r.open), high: Number(r.high), low: Number(r.low), close: Number(r.close) }
    if (r.volume != null && r.volume !== ``) c.volume = Number(r.volume)

    const bad = invalidReason(c)
    if (bad) {
      issues.push({ kind: `invalid`, time: Number.isFinite(time) ? time : null, detail: bad })
      continue
    }
    if (time % step !== 0) issues.push({ kind: `misaligned`, time, detail: `open time is not a multiple of ${step}s` })
    if (byTime.has(time)) issues.push({ kind: `duplicate`, time, detail: `kept the later copy` })
    else if (time < previous) issues.push({ kind: `out-of-order`, time, detail: `sorted into place` })
    previous = Math.max(previous, time)
    byTime.set(time, c)
  }

  const candles = [...byTime.values()].sort((a, b) => a.time - b.time)
  for (let i = 1; i < candles.length; i++) {
    const gap = candles[i]!.time - candles[i - 1]!.time
    if (gap > step) issues.push({ kind: `gap`, time: candles[i - 1]!.time + step, detail: `${gap / step - 1} candle(s) missing` })
  }
  return { candles, issues }
}

function toSeconds(t: number | string, unit: `s` | `ms`): number {
  if (typeof t === `string`) {
    const n = Number(t)
    if (t.trim() !== `` && Number.isFinite(n)) return unit === `ms` ? Math.floor(n / 1000) : n
    const parsed = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z`)
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : NaN
  }
  return unit === `ms` ? Math.floor(t / 1000) : t
}

function invalidReason(c: Candle): string | null {
  if (!Number.isFinite(c.time)) return `unreadable time`
  for (const k of [`open`, `high`, `low`, `close`] as const) if (!Number.isFinite(c[k]) || c[k] <= 0) return `${k} is not a positive number`
  if (c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close) || c.high < c.low) return `high/low do not contain open/close`
  if (c.volume !== undefined && !(Number.isFinite(c.volume) && c.volume >= 0)) return `volume is not a number ≥ 0`
  return null
}

/** Close time of a candle: when its values became final. */
export const closeTime = (c: Candle, timeframe: Timeframe) => c.time + TIMEFRAME_SECONDS[timeframe]
