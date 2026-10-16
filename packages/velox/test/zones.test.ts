import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEngine, run, type OrderBlock, type SupplyDemandZone, type VeloxSettingsInput } from '../src/index.ts'
import { bars, BOS_ROWS, instrument, mirror, STEP, T0 } from './helpers.ts'

// The 12 cases from the demand-zone / order-block spec, on a hand-built path (see BOS_ROWS):
// swing high 104.5 at candle 6, low 94 at candle 11 (a down-close candle: open 96, close 95.2),
// and candle 14 closes 105.2, breaking the high.

const settings: VeloxSettingsInput = { atrPeriod: 5, swingLength: 2 }
const candles = bars(BOS_ROWS)
const rows = () => BOS_ROWS.map((r) => [...r] as [number, number, number, number])
const at = (i: number) => T0 + i * STEP
const closeAt = (i: number) => at(i) + STEP

const after = (n: number, s = settings, input = candles) => run(input.slice(0, n), instrument(), s)
const demandAt94 = (n: number, s = settings) => after(n, s).zones.find((z) => z.type === `demand` && z.low === 94)
const bullishOb = (n: number, s = settings) => after(n, s).orderBlocks.find((b) => b.type === `bullish`)

const zoneFacts = (z: SupplyDemandZone) => [z.id, z.high, z.low, z.originTime, z.confirmedAt, z.strengthAtConfirmation, JSON.stringify(z.source)]
const obFacts = (b: OrderBlock) => [b.id, b.high, b.low, b.originTime, b.confirmedAt, b.strengthAtConfirmation, b.parentZoneId, b.bosId]

test('1. base, strong displacement and a bullish break: demand zone at the wick of the low that broke the high', () => {
  const z = demandAt94(15)
  assert.ok(z)
  assert.equal(z.low, 94) // the low's wick …
  assert.equal(z.high, 95.2) // … up to the bottom of that candle's body
  assert.equal(z.originTime, at(11))
  assert.equal(z.confirmedAt, closeAt(14)) // known when the breaking candle closed
  assert.ok(z.source.structureEventId)
  const event = after(15).structure.find((e) => e.id === z.source.structureEventId)!
  assert.deepEqual([event.kind, event.direction, event.level], [`CHoCH`, `up`, 104.5])
  assert.equal(z.status, `fresh`)
})

test('2. a weak bounce that breaks nothing makes no zone', () => {
  const weak = rows().slice(0, 12)
  weak.push([95.2, 96.5, 95, 96.2], [96.2, 96.8, 95.8, 96], [96, 96.3, 95.5, 95.7], [95.7, 96, 95.3, 95.6])
  for (const requireBOS of [true, false]) {
    assert.equal(run(bars(weak), instrument(), { ...settings, requireBOS }).zones.filter((z) => z.low === 94).length, 0, `requireBOS ${requireBOS}`)
  }
})

test('3. a strong move with no break: no zone by default, a lower-scored one when requireBOS is off', () => {
  const noBreak = rows().slice(0, 14) // rallies to 100.8, below the 104.5 high
  noBreak.push([100.8, 102, 100, 101.5], [101.5, 102.3, 99.5, 100])
  assert.equal(run(bars(noBreak), instrument(), settings).zones.filter((z) => z.low === 94).length, 0)
  const loose = run(bars(noBreak), instrument(), { ...settings, requireBOS: false }).zones.find((z) => z.low === 94)
  assert.ok(loose)
  assert.equal(loose.source.structureEventId, null)
  assert.equal(loose.score.find((f) => f.key === `structure`)!.points, 0)
  assert.ok(loose.strengthAtConfirmation < demandAt94(15)!.strengthAtConfirmation)
})

test('4. the order block only exists from the break, though it is drawn from its own candle', () => {
  assert.equal(bullishOb(14), undefined)
  const ob = bullishOb(15)
  assert.ok(ob)
  assert.equal(ob.originTime, at(11)) // the last down-close candle at the low
  assert.equal(ob.confirmedAt, closeAt(14))
  assert.deepEqual([ob.low, ob.high], [94, 96.4]) // its full range (orderBlocks.range = wick)
  assert.equal(ob.bosId, demandAt94(15)!.source.structureEventId)
})

test('5. later candles never move a zone or order block, or change when it was confirmed', () => {
  const zEarly = demandAt94(15)!
  const zLate = demandAt94(28)!
  assert.deepEqual(zoneFacts(zLate), zoneFacts(zEarly))
  assert.deepEqual(obFacts(bullishOb(28)!), obFacts(bullishOb(15)!))
  assert.notEqual(zLate.status, zEarly.status) // the status may change
})

test('6. five candles inside the zone are one visit', () => {
  for (const n of [20, 21, 22, 23]) assert.equal(demandAt94(n)!.touches, 1, `after ${n} candles`)
  assert.equal(demandAt94(20)!.status, `tested`)
  assert.equal(demandAt94(20)!.statusChangedAt, closeAt(19))
})

test('7. leaving by touchExitATR and coming back is a second visit', () => {
  const z = demandAt94(25)!
  assert.equal(z.touches, 2)
  assert.deepEqual(
    z.events.map((e) => [e.kind, e.time]),
    [
      [`touch`, closeAt(19)],
      [`left`, closeAt(23)],
      [`touch`, closeAt(24)],
    ],
  )
})

test('8. a wick below the zone with a close above it does not invalidate (close mode)', () => {
  const z = demandAt94(26)! // candle 25: low 93.6, close 94.3
  assert.equal(z.status, `mitigated`)
  assert.equal(after(26, { ...settings, invalidation: `wick` }).zones.find((x) => x.low === 94)!.status, `invalid`)
})

test('9. a close below the zone invalidates it, and it stays in the history', () => {
  const z = demandAt94(27)! // candle 26 closes 92.5
  assert.deepEqual([z.status, z.statusChangedAt], [`invalid`, closeAt(26)])
  assert.deepEqual(
    z.events.map((e) => e.kind),
    [`touch`, `left`, `touch`, `mitigated`, `invalidated`],
  )
})

// 10 (no forming higher-timeframe candle is used) is in data.test.ts and replay.test.ts.

test('11. an order block on the demand zone links both ways and lifts the zone’s strength', () => {
  const z = demandAt94(15)!
  const ob = bullishOb(15)!
  assert.equal(z.source.orderBlockId, ob.id)
  assert.deepEqual(z.relatedOrderBlockIds, [ob.id])
  assert.equal(ob.parentZoneId, z.id)
  assert.equal(z.score.find((f) => f.key === `orderBlock`)!.points, 15)
  assert.equal(ob.score.find((f) => f.key === `zone`)!.points, 10)
  const without = demandAt94(15, { ...settings, orderBlocks: { enabled: false } })!
  assert.equal(without.source.orderBlockId, null)
  assert.equal(z.strengthAtConfirmation - without.strengthAtConfirmation, 15)
})

test('12. a down-close candle without a strong enough move is not an order block, but the demand zone stands', () => {
  // Too few strong candles (the move has 3; require 4).
  assert.equal(bullishOb(15, { ...settings, orderBlocks: { minImpulseCandles: 4 } }), undefined)
  assert.ok(demandAt94(15, { ...settings, orderBlocks: { minImpulseCandles: 4 } }))
  // Not enough displacement.
  assert.equal(bullishOb(15, { ...settings, orderBlocks: { minDisplacementATR: 5 } }), undefined)
  // No break at all: no order block, even when zones without a break are allowed.
  const noBreak = rows().slice(0, 14)
  noBreak.push([100.8, 102, 100, 101.5], [101.5, 102.3, 99.5, 100])
  assert.equal(run(bars(noBreak), instrument(), { ...settings, requireBOS: false }).orderBlocks.filter((b) => b.type === `bullish`).length, 0)
})

test('a failed order block becomes a breaker, which ends when price closes back through it', () => {
  assert.equal(bullishOb(26)!.breaker, null)
  const ob = bullishOb(28)!
  assert.equal(ob.status, `invalid`)
  assert.deepEqual(ob.breaker, { since: closeAt(26), endedAt: closeAt(27) })
  assert.deepEqual(
    ob.events.slice(-3).map((e) => e.kind),
    [`invalidated`, `breaker`, `breaker-ended`],
  )
  assert.equal(after(28, { ...settings, orderBlocks: { breakers: false } }).orderBlocks.find((b) => b.type === `bullish`)!.breaker, null)
})

test('zone width options: wick (default), a fixed ATR band, or the broader base', () => {
  const z = demandAt94(15)!
  const band = after(15, { ...settings, zoneWidth: `atr` }).zones.find((x) => x.low === 94)!
  assert.equal(band.high, Number((94 + 0.25 * z.source.atr).toFixed(2)))
  const base = after(15, { ...settings, zoneWidth: `base` }).zones.find((x) => x.low === 94)!
  assert.ok(base.high >= z.high)
  const body = after(15, { ...settings, orderBlocks: { range: `body` } }).orderBlocks.find((b) => b.type === `bullish`)!
  assert.deepEqual([body.low, body.high], [95.2, 96])
})

test('supply zones and bearish order blocks mirror demand and bullish exactly', () => {
  const up = after(28)
  const down = run(mirror(candles), instrument(), settings)
  const d = up.zones.find((z) => z.low === 94)!
  const s = down.zones.find((z) => z.high === 200 - 94)!
  assert.equal(s.type, `supply`)
  assert.deepEqual([s.low, s.originTime, s.confirmedAt, s.strengthAtConfirmation, s.touches, s.status], [Number((200 - d.high).toFixed(2)), d.originTime, d.confirmedAt, d.strengthAtConfirmation, d.touches, d.status])
  const ob = up.orderBlocks.find((b) => b.type === `bullish`)!
  const bear = down.orderBlocks.find((b) => b.originTime === ob.originTime)!
  assert.equal(bear.type, `bearish`)
  assert.deepEqual([bear.low, bear.high, bear.status, bear.breaker], [Number((200 - ob.high).toFixed(2)), Number((200 - ob.low).toFixed(2)), ob.status, ob.breaker])
})

test('strength falls as a zone is used; the strength at confirmation never changes', () => {
  const fresh = demandAt94(15)!
  const used = demandAt94(25)!
  assert.equal(fresh.strength, fresh.strengthAtConfirmation)
  assert.equal(used.strengthAtConfirmation, fresh.strengthAtConfirmation)
  assert.ok(used.strength < fresh.strength)
  assert.equal(Math.round(fresh.score.reduce((a, f) => a + f.points, 0)), fresh.strength)
  for (const f of [...fresh.score, ...bullishOb(15)!.score]) assert.ok(f.points >= 0 && f.points <= f.max && f.detail.length > 0)
})

test('the engine refuses candles out of order, repeated, or off the timeframe grid', () => {
  const e = createEngine(instrument(), settings)
  e.push(candles[0]!)
  assert.throws(() => e.push(candles[0]!), RangeError)
  assert.throws(() => e.push({ ...candles[1]!, time: T0 - STEP }), RangeError)
  assert.throws(() => e.push({ ...candles[1]!, time: T0 + 60 }), RangeError)
})
