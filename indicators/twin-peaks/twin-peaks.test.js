import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyse } from './twin-peaks.js'

// Candles that walk through the given closes in straight lines, `steps` bars per segment, with a
// small wick each side. Deterministic, so every test sees the same chart.
function path(points, steps = 8) {
  const closes = []
  for (let k = 0; k < 16; k++) closes.push(points[0] + (k % 2 ? 0.6 : -0.6))
  for (let k = 0; k < points.length - 1; k++) {
    for (let s = 0; s < steps; s++) closes.push(points[k] + ((points[k + 1] - points[k]) * s) / steps)
  }
  closes.push(points.at(-1))
  return closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1]
    return { time: i * 3600, open, high: Math.max(open, close) + 0.4, low: Math.min(open, close) - 0.4, close, volume: 100 }
  })
}

const kinds = (events, id) => events.filter((e) => e.id === id).map((e) => e.type)

// Rally from 100 to 130, pull back to 116, back up to 130, then fall through the neckline.
const M = [100, 130, 116, 130, 100]
const W = [130, 100, 114, 100, 130]

test('a clean double top is flagged as developing, then confirmed with a SELL on the neckline break', () => {
  const candles = path(M)
  const { patterns, events } = analyse(candles)
  assert.equal(patterns.length, 1)
  const p = patterns[0]
  assert.equal(p.dir, -1)
  assert.ok(Math.abs(p.neck - (116 - 0.4)) < 1e-9, `neckline is the low of the trough`)
  assert.deepEqual(kinds(events, p.id).slice(0, 2), [`potential`, `confirmed`])
  // Developing is reported when the second peak is confirmed, not at the peak itself.
  const pot = events.find((e) => e.type === `potential`)
  assert.equal(pot.bar, p.b2 + 3)
  // The SELL is on the first close far enough below the neckline, and not before.
  const conf = events.find((e) => e.type === `confirmed`)
  assert.ok(candles[conf.bar].close < p.neck)
  for (let i = p.b2; i < conf.bar; i++) assert.ok(candles[i].close >= p.neck - 0.1 * 2, `no earlier close broke the neckline`)
})

test('a clean double bottom gives a BUY with the stop below the lowest bottom and a measured-move target', () => {
  const candles = path(W)
  const { patterns } = analyse(candles, { stopAtr: 0 })
  assert.equal(patterns.length, 1)
  const p = patterns[0]
  assert.equal(p.dir, 1)
  assert.ok([`confirmed`, `target`, `stopped`, `ended`].includes(p.state))
  assert.equal(p.stop, Math.min(p.p1, p.p2))
  assert.ok(Math.abs(p.target - (p.neck + (p.neck - Math.min(p.p1, p.p2)))) < 1e-9)
  assert.ok(p.entry > p.neck && p.entry < p.target && p.stop < p.entry)
})

test('peaks too far apart in price are not a double top', () => {
  const { patterns } = analyse(path([100, 130, 116, 136, 100]))
  assert.equal(patterns.filter((p) => p.dir === -1).length, 0)
})

test('a shallow dip between the peaks is not a pattern', () => {
  const { patterns } = analyse(path([100, 130, 128.5, 130, 100]))
  assert.equal(patterns.filter((p) => p.dir === -1).length, 0)
})

test('the trend filter wants a move into the first peak; turning it off accepts the shape on its own', () => {
  // Flat before the pattern, so there is no advance into the first peak.
  const candles = path([118, 118.5, 118, 130, 116, 130, 100])
  assert.equal(analyse(candles).patterns.filter((p) => p.dir === -1).length, 0)
  assert.equal(analyse(candles, { trendFilter: false }).patterns.filter((p) => p.dir === -1).length, 1)
})

test('a close above the peaks invalidates a developing double top, with no SELL', () => {
  const { patterns, events } = analyse(path([100, 130, 116, 129.5, 128, 140]))
  const top = patterns.find((p) => p.dir === -1)
  assert.ok(top, `expected a developing top`)
  assert.equal(top.state, `invalidated`)
  assert.ok(!events.some((e) => e.id === top.id && e.type === `confirmed`))
})

test('a developing pattern that never breaks expires', () => {
  const { patterns } = analyse(path([100, 130, 116, 130, 122, 126, 122, 126, 122, 126]))
  const top = patterns.find((p) => p.dir === -1)
  assert.equal(top.state, `expired`)
})

test('a break that pulls back to the neckline and holds is a retest', () => {
  const { patterns, events } = analyse(path([100, 130, 116, 130, 112, 115.8, 100], 8))
  const top = patterns.find((p) => p.dir === -1)
  assert.ok(top.retested, `expected a retest`)
  const r = events.find((e) => e.type === `retest`)
  assert.ok(r.bar > top.breakBar)
})

test('every pattern reports each stage at most once', () => {
  const candles = path([100, 130, 116, 130, 100, 114, 100, 130, 116, 129.6, 98, 112, 98.3, 125], 7)
  const { events } = analyse(candles)
  const seen = new Set()
  for (const e of events) {
    const key = `${e.id}:${e.type}`
    assert.ok(!seen.has(key), `duplicate ${key}`)
    seen.add(key)
  }
  assert.ok(events.some((e) => e.type === `confirmed`))
})

test('nothing repaints: events up to any bar are the same whether or not later candles exist', () => {
  const candles = path([100, 130, 116, 130, 100, 114, 100, 130, 116, 129.6, 98, 112, 98.3, 125], 7)
  const full = analyse(candles).events
  for (let cut = 10; cut <= candles.length; cut += 3) {
    const part = analyse(candles.slice(0, cut)).events
    const expected = full.filter((e) => e.bar < cut)
    assert.deepEqual(part, expected, `events differ when the chart ends at bar ${cut}`)
  }
})

// A seeded random walk with volatility clusters: long enough to produce many patterns of every kind.
function walk(n, seed = 7) {
  let x = seed
  const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648)
  let price = 100
  let vol = 0.6
  const out = []
  for (let i = 0; i < n; i++) {
    if (i % 50 === 0) vol = 0.3 + rnd()
    const open = price
    const close = open + (rnd() - 0.5) * 2 * vol + Math.sin(i / 40) * 0.15
    const high = Math.max(open, close) + rnd() * vol * 0.6
    const low = Math.min(open, close) - rnd() * vol * 0.6
    out.push({ time: i * 60, open, high, low, close, volume: 50 + rnd() * 100 })
    price = close
  }
  return out
}

test('on a long random walk: patterns of each kind, and no event changes when the chart is cut short', () => {
  const candles = walk(3000)
  const full = analyse(candles).events
  const types = new Set(full.map((e) => e.type))
  for (const t of [`potential`, `confirmed`, `invalidated`, `expired`, `retest`]) assert.ok(types.has(t), `expected some ${t} events`)
  for (const cut of [400, 777, 1500, 2222, 2999]) {
    const part = analyse(candles.slice(0, cut)).events
    assert.deepEqual(part, full.filter((e) => e.bar < cut), `events differ at ${cut}`)
  }
})

test('a double top and a double bottom never share bars: the first one found stands', () => {
  // A W whose middle is an M: the M is found first, so the W around it is ignored.
  const candles = path([140, 100, 121, 112, 121, 100, 130])
  const both = analyse(candles, { noOverlap: false }).patterns
  assert.deepEqual(both.map((p) => p.dir).sort(), [-1, 1], `without the rule both are found`)
  const { patterns } = analyse(candles)
  assert.equal(patterns.length, 1)
  assert.equal(patterns[0].dir, -1)
  // And on a long random walk no two opposite, still-valid patterns overlap.
  const live = analyse(walk(3000)).patterns.filter((p) => ![`invalidated`, `expired`, `superseded`].includes(p.state))
  for (const a of live) {
    for (const b of live) {
      if (a.dir === b.dir) continue
      const aEnd = a.breakBar ?? Infinity
      assert.ok(!(b.b1 <= aEnd && b.b2 >= a.b1 && b.detectBar > a.detectBar), `patterns ${a.id} and ${b.id} overlap`)
    }
  }
})
