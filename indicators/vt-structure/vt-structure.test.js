import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyse, compute, definition, resample, session, higherTimeframeTrend } from './vt-structure.js'

// Builds candles that walk through the given closes in straight lines, `steps` bars per segment.
function path(points, steps = 6, start = Date.UTC(2026, 9, 12, 13) / 1000) {
  const closes = []
  for (let k = 0; k < points.length - 1; k++) {
    for (let s = 0; s < steps; s++) closes.push(points[k] + ((points[k + 1] - points[k]) * s) / steps)
  }
  closes.push(points.at(-1))
  return closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1]
    return { time: start + i * 300, open, high: Math.max(open, close) + 0.5, low: Math.min(open, close) - 0.5, close, volume: 100 }
  })
}

const params = { swingLength: 3, fast: 3, slow: 5 }

test('an uptrend breaking its last higher low is a bearish CHoCH, and each lower low after it a BOS', () => {
  // Up, pull back, up (bullish break), then down through the higher low, bounce, and down again.
  const candles = path([100, 120, 110, 130, 115, 105, 112, 95, 101, 85], 6)
  const { breaks } = analyse(candles, params)
  const kinds = breaks.map((b) => `${b.direction} ${b.kind}`)
  assert.deepEqual(kinds, [`up CHoCH`, `down CHoCH`, `down BOS`, `down BOS`])
})

test('the retracement runs from the start of the leg (1) to its furthest point (0)', () => {
  const candles = path([100, 120, 110, 130, 115, 105, 112, 95, 101, 85], 6)
  const { leg, retracement } = analyse(candles, params)
  assert.equal(leg.to, Math.min(...candles.slice(leg.breakIndex).map((c) => c.low)))
  const at = (r) => retracement.find((x) => x.ratio === r).price
  assert.equal(at(0), leg.to)
  assert.equal(at(1), leg.from)
  assert.ok(at(0.618) > at(0) && at(0.786) > at(0.618) && at(1) > at(0.786))
})

test('a sell signal puts the stop above the leg and targets below at multiples of the risk', () => {
  const candles = path([100, 120, 110, 130, 115, 105, 112, 95, 101, 85], 6)
  const { signals } = analyse(candles, { ...params, stopAtr: 0 })
  const sell = signals.find((s) => s.side === `sell`)
  assert.ok(sell, `expected a sell signal`)
  const risk = sell.stop - sell.entry
  assert.ok(risk > 0)
  sell.targets.forEach((tp, k) => assert.ok(Math.abs(sell.entry - tp - risk * (k + 1)) < 1e-9))
})

test('BOS only signals when asked to', () => {
  const candles = path([100, 120, 110, 130, 115, 105, 112, 95, 101, 85], 6)
  assert.equal(analyse(candles, params).signals.length, 2)
  assert.equal(analyse(candles, { ...params, signalOn: `choch-bos` }).signals.length, 4)
})

test('values never change when later candles arrive', () => {
  const candles = path([100, 120, 110, 130, 115, 105, 112, 95, 101, 85, 99, 90], 6)
  const full = analyse(candles, params).series
  for (const cut of [20, 35, 50]) {
    const part = analyse(candles.slice(0, cut), params).series
    for (const key of Object.keys(part)) assert.deepEqual(part[key], full[key].slice(0, cut), `${key} at ${cut}`)
  }
})

test('a target counts as hit once price reaches it', () => {
  const candles = path([100, 120, 110, 130, 115, 105, 112, 95, 101, 85], 6)
  const sell = analyse(candles, { ...params, stopAtr: 0, targets: [0.5, 50, 100] }).signals.at(-1)
  assert.equal(sell.hit, 1)
  assert.equal(sell.status, `TP1 hit`)
})

test('compute returns one series per catalog output, as long as the candles', () => {
  const candles = path([100, 120, 110, 130, 115], 6)
  const out = compute(candles, params)
  assert.deepEqual(Object.keys(out).sort(), definition.outputs.map((o) => o.key).sort())
  for (const v of Object.values(out)) assert.equal(v.length, candles.length)
})

test('sessions follow local time, including the London and New York overlap', () => {
  assert.equal(session(Date.UTC(2026, 9, 12, 1) / 1000), `Asia`)
  assert.equal(session(Date.UTC(2026, 9, 12, 9) / 1000), `London`)
  assert.equal(session(Date.UTC(2026, 9, 12, 13) / 1000), `London / NY`)
  assert.equal(session(Date.UTC(2026, 9, 12, 18) / 1000), `New York`)
  assert.equal(session(Date.UTC(2026, 9, 12, 22) / 1000), `Off hours`)
})

test('resampling keeps only closed higher-timeframe bars', () => {
  const start = Date.UTC(2026, 9, 12, 13) / 1000
  const five = Array.from({ length: 7 }, (_, i) => ({ time: start + i * 300, open: i, high: i + 1, low: i - 1, close: i + 0.5, volume: 1 }))
  const fifteen = resample(five, 900)
  assert.equal(fifteen.length, 2)
  assert.deepEqual(fifteen[0], { time: start, open: 0, high: 3, low: -1, close: 2.5, volume: 3 })
  assert.equal(typeof higherTimeframeTrend(five, 900, params), `number`)
})

test('bad settings are refused', () => {
  assert.throws(() => analyse([], { fast: 50, slow: 21 }), RangeError)
  assert.throws(() => analyse([], { swingLength: 0 }), RangeError)
})
