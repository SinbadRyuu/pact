import { TIMEFRAME_SECONDS } from './candles.ts'
import type { Candle, Timeframe } from './types.ts'

export type Aggregated = {
  /** Higher-timeframe candles that had closed by `asOf`. Safe to use for confirmed zones. */
  closed: Candle[]
  /** The higher-timeframe candle still in progress at `asOf`, if any. Display only: never confirm anything from it. */
  forming: Candle | null
}

/**
 * Builds higher-timeframe candles from lower-timeframe ones, using only what was known at `asOf`
 * (a Unix time in seconds; default: the close of the last input candle).
 *
 * Buckets are aligned to UTC: 1h on the hour, 4h at 00, 04, 08 … UTC, 1d at 00:00 UTC.
 * A bucket is closed once `asOf` has reached its end. Until then it is `forming`, even if its last
 * lower-timeframe candle is simply missing: a gap is never taken as a close.
 * If the input starts part-way through a bucket, that first partial bucket is left out.
 */
export function aggregate(candles: readonly Candle[], from: Timeframe, to: Timeframe, asOf?: number): Aggregated {
  const step = TIMEFRAME_SECONDS[from]
  const size = TIMEFRAME_SECONDS[to]
  if (size <= step || size % step !== 0) throw new RangeError(`cannot build ${to} candles from ${from}`)

  const last = candles.at(-1)
  const now = asOf ?? (last ? last.time + step : -Infinity)
  const buckets: Candle[] = []

  for (const c of candles) {
    if (c.time + step > now) break // that lower-timeframe candle had not closed yet
    const start = Math.floor(c.time / size) * size
    const b = buckets.at(-1)
    if (b && b.time === start) {
      b.high = Math.max(b.high, c.high)
      b.low = Math.min(b.low, c.low)
      b.close = c.close
      if (c.volume !== undefined) b.volume = (b.volume ?? 0) + c.volume
    } else {
      const n: Candle = { time: start, open: c.open, high: c.high, low: c.low, close: c.close }
      if (c.volume !== undefined) n.volume = c.volume
      buckets.push(n)
    }
  }

  // History that starts part-way through a bucket gives that bucket the wrong open and range: drop it.
  if (buckets.length && candles[0]!.time !== buckets[0]!.time) buckets.shift()

  const tail = buckets.at(-1)
  if (tail && tail.time + size > now) return { closed: buckets.slice(0, -1), forming: tail }
  return { closed: buckets, forming: null }
}
