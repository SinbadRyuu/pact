import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEngine, oneToOne, run } from '../src/index.ts'
import { bars, DEMAND_ROWS, instrument, mirror, STEP, T0 } from './helpers.ts'

const settings = { atrPeriod: 5, swingLength: 2, signals: { minStrength: 0 } }
const demandCandles = bars(DEMAND_ROWS)
const at = (i: number) => T0 + i * STEP
const closeAt = (i: number) => at(i) + STEP

function demandZone(candles = demandCandles) {
  const state = run(candles, instrument(), settings)
  const zone = state.zones.find((z) => z.type === `demand` && z.low === 92)
  assert.ok(zone, `expected a demand zone at 92`)
  return { state, zone }
}

test('a swing low with a strong rally away from it becomes a demand zone, drawn from the base to its body', () => {
  const { zone } = demandZone(demandCandles.slice(0, 13))
  assert.equal(zone.low, 92) // the base candle's wick
  assert.equal(zone.high, 94) // the base candle's body top
  assert.equal(zone.originTime, at(9))
  assert.equal(zone.source.baseCandles, 1)
  assert.equal(zone.status, `fresh`)
  assert.equal(zone.touches, 0)
})

test('the zone is dated where it happened but only exists from when it was confirmed', () => {
  const { zone } = demandZone(demandCandles.slice(0, 13))
  // Swing at index 9 needs 2 more candles: it is known at the close of index 11.
  assert.equal(zone.confirmedAt, closeAt(11))
  assert.ok(zone.originTime < zone.confirmedAt)
  for (const n of [10, 11]) {
    const early = run(demandCandles.slice(0, n), instrument(), settings)
    assert.equal(early.zones.length, 0, `no zone may exist after only ${n} candles`)
  }
  assert.equal(run(demandCandles.slice(0, 12), instrument(), settings).zones.length, 1)
})

test('supply zones mirror demand zones exactly', () => {
  const { zone: d } = demandZone()
  const s = run(mirror(demandCandles), instrument(), settings).zones.find((z) => z.type === `supply`)
  assert.ok(s)
  assert.equal(s.low, 200 - d.high)
  assert.equal(s.high, 200 - d.low)
  assert.equal(s.confirmedAt, d.confirmedAt)
  assert.equal(s.strengthAtConfirmation, d.strengthAtConfirmation)
  assert.equal(s.touches, d.touches)
  assert.equal(s.status, d.status)
})

test('candles that stay inside the zone count as one touch, and a new touch needs price to leave first', () => {
  const touchesAfter = (n: number) => demandZone(demandCandles.slice(0, n)).zone.touches
  assert.equal(touchesAfter(16), 0)
  assert.equal(touchesAfter(17), 1) // index 16 dips to 93.8
  assert.equal(touchesAfter(19), 1) // index 17 and 18 are still inside
  assert.equal(touchesAfter(20), 1) // index 19 leaves
  assert.equal(touchesAfter(21), 2) // index 20 comes back
})

test('the lifecycle runs fresh → tested → mitigated → invalid, each at the candle that caused it', () => {
  const statusAfter = (n: number) => demandZone(demandCandles.slice(0, n)).zone
  assert.equal(statusAfter(16).status, `fresh`)
  assert.deepEqual([statusAfter(17).status, statusAfter(17).statusChangedAt], [`tested`, closeAt(16)])
  assert.deepEqual([statusAfter(22).status, statusAfter(22).statusChangedAt], [`mitigated`, closeAt(21)])
  assert.deepEqual([statusAfter(23).status, statusAfter(23).statusChangedAt], [`invalid`, closeAt(22)])
  assert.deepEqual(
    statusAfter(23).events.map((e) => e.kind),
    [`touch`, `left`, `touch`, `mitigated`, `invalidated`],
  )
})

test('strength falls as the zone is used, but the strength at confirmation never changes', () => {
  const fresh = demandZone(demandCandles.slice(0, 16)).zone
  const used = demandZone().zone
  assert.equal(fresh.strength, fresh.strengthAtConfirmation)
  assert.equal(used.strengthAtConfirmation, fresh.strengthAtConfirmation)
  assert.ok(used.strength < fresh.strength)
  const total = fresh.score.reduce((a, f) => a + f.points, 0)
  assert.equal(Math.round(total), fresh.strength) // weights add to 100 by default
  for (const f of fresh.score) assert.ok(f.points >= 0 && f.points <= f.max && f.detail.length > 0)
})

test('the first return to a fresh zone gives a buy with its stop below the zone and a 1:1 target', () => {
  const { state, zone } = demandZone()
  assert.equal(state.signals.length, 1)
  const s = state.signals[0]!
  assert.equal(s.side, `buy`)
  assert.equal(s.zoneId, zone.id)
  assert.equal(s.time, at(16))
  assert.equal(s.entry, 94) // the zone's near edge
  assert.ok(s.stopLoss < zone.low)
  assert.equal(Number((s.takeProfit - s.entry).toFixed(2)), Number((s.entry - s.stopLoss).toFixed(2)))
  assert.equal(s.outcome, `tp`) // index 18 reaches the target before anything reaches the stop
  assert.equal(s.closedAt, closeAt(18))
})

test('sell signals mirror buys: stop above the zone, target 1:1 below the entry', () => {
  const buy = demandZone().state.signals[0]!
  const sell = run(mirror(demandCandles), instrument(), settings).signals[0]!
  assert.equal(sell.side, `sell`)
  assert.equal(sell.entry, Number((200 - buy.entry).toFixed(2)))
  assert.equal(sell.stopLoss, Number((200 - buy.stopLoss).toFixed(2)))
  assert.equal(sell.takeProfit, Number((200 - buy.takeProfit).toFixed(2)))
  assert.ok(sell.stopLoss > sell.entry && sell.takeProfit < sell.entry)
  assert.equal(sell.outcome, buy.outcome)
})

test('the target is always 1:1 with the stop', () => {
  assert.deepEqual(oneToOne(4000, 3990, 2), { risk: 10, takeProfit: 4010 })
  assert.deepEqual(oneToOne(4000, 4010, 2), { risk: 10, takeProfit: 3990 })
  assert.deepEqual(oneToOne(4169.31, 4175.08, 2), { risk: 5.77, takeProfit: 4163.54 })
})

test('weak zones give no signal', () => {
  const state = run(demandCandles, instrument(), { ...settings, signals: { minStrength: 101 } })
  assert.equal(state.signals.length, 0)
})

test('a candle that reaches both stop and target counts as a loss', () => {
  const rows = DEMAND_ROWS.slice(0, 17).map((r) => [...r] as [number, number, number, number])
  rows.push([95, 99, 90, 95]) // huge candle through both levels
  const s = run(bars(rows), instrument(), settings).signals[0]!
  assert.equal(s.outcome, `sl`)
})

test('a candle closing beyond the far edge before confirmation kills the candidate', () => {
  const rows = DEMAND_ROWS.slice(0, 11).map((r) => [...r] as [number, number, number, number])
  rows.push([96, 96.2, 91, 91.5]) // closes below 92 instead of rallying
  rows.push([91.5, 99, 91.4, 98.5])
  assert.equal(run(bars(rows), instrument(), settings).zones.filter((z) => z.low === 92).length, 0)
})

test('the engine refuses candles out of order, repeated, or off the timeframe grid', () => {
  const e = createEngine(instrument(), settings)
  e.push(demandCandles[0]!)
  assert.throws(() => e.push(demandCandles[0]!), RangeError)
  assert.throws(() => e.push({ ...demandCandles[1]!, time: T0 - STEP }), RangeError)
  assert.throws(() => e.push({ ...demandCandles[1]!, time: T0 + 60 }), RangeError)
})
