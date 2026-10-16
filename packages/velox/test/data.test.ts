import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregate, cacheKey, normalise, resolveSettings } from '../src/index.ts'
import { bars, instrument, STEP, T0 } from './helpers.ts'

test('normalise sorts, keeps the later copy of a duplicate, drops impossible candles and reports each change', () => {
  const { candles, issues } = normalise(
    [
      { time: T0 + STEP, open: 2, high: 3, low: 1, close: 2 },
      { time: T0, open: 1, high: 2, low: 0.5, close: 1.5 },
      { time: T0 + STEP, open: 2, high: 3.5, low: 1, close: 3 }, // re-sent: the newer copy wins
      { time: T0 + 2 * STEP, open: 2, high: 1, low: 3, close: 2 }, // high below low
      { time: T0 + 4 * STEP, open: `3`, high: `4`, low: `2.5`, close: `3.5`, volume: `10` },
    ],
    { timeframe: `15m` },
  )
  assert.deepEqual(candles.map((c) => c.time), [T0, T0 + STEP, T0 + 4 * STEP])
  assert.equal(candles[1]!.close, 3)
  assert.equal(candles[2]!.volume, 10)
  assert.deepEqual(issues.map((i) => i.kind).sort(), [`duplicate`, `gap`, `invalid`, `out-of-order`])
  assert.match(issues.find((i) => i.kind === `gap`)!.detail, /^2 candle/)
})

test('normalise reads ISO text as UTC and milliseconds when told to, and flags off-grid times', () => {
  const iso = normalise([{ time: `2026-10-12T08:00:00`, open: 1, high: 1, low: 1, close: 1 }], { timeframe: `15m` })
  assert.equal(iso.candles[0]!.time, T0)
  const ms = normalise([{ time: T0 * 1000, open: 1, high: 1, low: 1, close: 1 }], { timeframe: `15m`, timeUnit: `ms` })
  assert.equal(ms.candles[0]!.time, T0)
  const off = normalise([{ time: T0 + 60, open: 1, high: 1, low: 1, close: 1 }], { timeframe: `15m` })
  assert.equal(off.issues[0]!.kind, `misaligned`)
})

const quarter = bars([
  [10, 11, 9, 10.5], // 08:00
  [10.5, 12, 10, 11.5], // 08:15
  [11.5, 11.8, 8, 9], // 08:30
  [9, 10, 8.5, 9.5], // 08:45
  [9.5, 13, 9.4, 12], // 09:00
  [12, 12.5, 11, 11.2], // 09:15
])

test('10. at 08:30 the 08:00 hour is still forming and is not given as closed', () => {
  const { closed, forming } = aggregate(quarter.slice(0, 2), `15m`, `1h`)
  assert.deepEqual(closed, [])
  assert.deepEqual(forming, { time: T0, open: 10, high: 12, low: 9, close: 11.5 })
})

test('the 08:00 hour closes only when the 08:45 candle closes', () => {
  assert.equal(aggregate(quarter.slice(0, 3), `15m`, `1h`).closed.length, 0)
  const { closed, forming } = aggregate(quarter.slice(0, 4), `15m`, `1h`)
  assert.deepEqual(closed, [{ time: T0, open: 10, high: 12, low: 8, close: 9.5 }])
  assert.equal(forming, null)
  assert.deepEqual(aggregate(quarter, `15m`, `1h`).forming, { time: T0 + 3600, open: 9.5, high: 13, low: 9.4, close: 11.2 })
})

test('a missing last quarter does not close the hour early, but time passing does', () => {
  const gappy = quarter.slice(0, 3) // 08:45 never arrived
  assert.equal(aggregate(gappy, `15m`, `1h`, T0 + 3599).closed.length, 0)
  assert.equal(aggregate(gappy, `15m`, `1h`, T0 + 3600).closed.length, 1)
})

test('lower-timeframe candles that had not closed by asOf are ignored', () => {
  const { forming } = aggregate(quarter, `15m`, `1h`, T0 + 4 * STEP + 1) // 09:00:01: the 09:00 candle is still open
  assert.equal(forming, null)
})

test('4h candles are aligned to 00, 04, 08 … UTC', () => {
  const day = bars(Array.from({ length: 40 }, () => [1, 2, 0.5, 1.5] as const), Date.UTC(2026, 9, 12, 2) / 1000)
  const { closed } = aggregate(day, `15m`, `4h`)
  assert.deepEqual(closed.map((c) => new Date(c.time * 1000).getUTCHours()), [4, 8])
})

test('the cache key changes with the feed, timeframe and settings', () => {
  const base = cacheKey(instrument())
  assert.notEqual(base, cacheKey(instrument({ provider: `oanda` })))
  assert.notEqual(base, cacheKey(instrument({ timeframe: `1h` })))
  assert.notEqual(base, cacheKey(instrument(), { swingLength: 5 }))
  assert.equal(base, cacheKey(instrument(), {}))
})

test('bad settings are refused', () => {
  assert.throws(() => resolveSettings({ swingLength: 0 }), RangeError)
  assert.throws(() => resolveSettings({ mitigationDepth: 0 }), RangeError)
  assert.throws(() => resolveSettings({ minHeightATR: 2, maxHeightATR: 1 }), RangeError)
})
