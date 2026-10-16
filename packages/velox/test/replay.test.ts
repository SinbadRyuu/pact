import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregate, createEngine, run, type OrderBlock, type SupplyDemandZone, type VeloxState } from '../src/index.ts'
import { instrument, walk } from './helpers.ts'

// Historical replay: feed candles one at a time, keep the state after each, and check that
// nothing the engine claimed as confirmed was later rewritten or back-dated.

const candles = walk(3000)
const settings = {}

const snapshots: VeloxState[] = []
{
  const engine = createEngine(instrument(), settings)
  for (const k of candles) {
    engine.push(k)
    snapshots.push(engine.state())
  }
}
const final = snapshots.at(-1)!

// What was decided when the zone was confirmed. Status, touches and current strength may change later.
const confirmedFacts = (z: SupplyDemandZone) => ({
  id: z.id,
  type: z.type,
  high: z.high,
  low: z.low,
  originTime: z.originTime,
  confirmedAt: z.confirmedAt,
  strengthAtConfirmation: z.strengthAtConfirmation,
  source: z.source,
  engineVersion: z.engineVersion,
})

const obFacts = (b: OrderBlock) => ({
  id: b.id,
  type: b.type,
  high: b.high,
  low: b.low,
  originTime: b.originTime,
  confirmedAt: b.confirmedAt,
  strengthAtConfirmation: b.strengthAtConfirmation,
  displacementATR: b.displacementATR,
  impulseCandles: b.impulseCandles,
  bosId: b.bosId,
  parentZoneId: b.parentZoneId,
  engineVersion: b.engineVersion,
})

test('the walk produces enough zones, order blocks and breakers to make the replay meaningful', () => {
  assert.ok(final.zones.filter((z) => z.type === `demand`).length >= 10, `demand zones: ${final.zones.length}`)
  assert.ok(final.zones.filter((z) => z.type === `supply`).length >= 10)
  assert.ok(final.orderBlocks.filter((b) => b.type === `bullish`).length >= 5 && final.orderBlocks.filter((b) => b.type === `bearish`).length >= 5)
  assert.ok(final.orderBlocks.filter((b) => b.breaker?.endedAt).length >= 5)
  assert.ok(final.structure.some((e) => e.kind === `BOS`) && final.structure.some((e) => e.kind === `CHoCH`))
  assert.ok(final.fvgs.length >= 20 && final.fvgs.some((g) => g.status === `open`) && final.fvgs.some((g) => g.status === `filled`))
  assert.ok(final.zones.some((z) => z.source.fvgId !== null))
  assert.ok(final.zones.some((z) => z.status === `invalid`) && final.zones.some((z) => z.status !== `invalid`))
})

test('replaying bar by bar ends in exactly the same state as one full run', () => {
  assert.deepEqual(run(candles, instrument(), settings), final)
})

test('no zone, order block, break, swing or FVG appears before the candle that confirmed it', () => {
  for (const snap of snapshots) {
    for (const z of snap.zones) assert.ok(z.confirmedAt <= snap.asOf!, `${z.id} known at ${z.confirmedAt} but shown at ${snap.asOf}`)
    for (const s of snap.swings) assert.ok(s.confirmedAt <= snap.asOf!)
    for (const g of snap.fvgs) assert.ok(g.confirmedAt <= snap.asOf! && g.statusChangedAt <= snap.asOf!)
    for (const z of snap.zones) if (z.source.fvgId) assert.ok(snap.fvgs.some((g) => g.id === z.source.fvgId && g.confirmedAt <= z.confirmedAt))
    for (const e of snap.structure) assert.ok(e.confirmedAt <= snap.asOf!)
    for (const z of [...snap.zones, ...snap.orderBlocks]) for (const e of z.events) assert.ok(e.time > z.confirmedAt && e.time <= snap.asOf!)
    for (const b of snap.orderBlocks) {
      assert.ok(b.originTime < b.confirmedAt)
      assert.ok(snap.structure.some((e) => e.id === b.bosId && e.confirmedAt === b.confirmedAt), `${b.id} has no break behind it`)
      if (b.parentZoneId) assert.ok(snap.zones.some((z) => z.id === b.parentZoneId && z.confirmedAt <= b.confirmedAt))
    }
    for (const z of snap.zones) if (z.source.structureEventId) assert.ok(snap.structure.some((e) => e.id === z.source.structureEventId && e.confirmedAt === z.confirmedAt))
  }
})

test('confirmation times are honest: everything first appears at exactly the candle it says it was confirmed on', () => {
  // Catches back-dating: a zone claiming confirmedAt 10:00 must not first appear at 10:45.
  const seen = new Set<string>()
  const firstAppearance = (id: string, claimed: number, asOf: number) => {
    if (seen.has(id)) return
    seen.add(id)
    assert.equal(claimed, asOf, `${id} claims ${claimed} but first appeared at ${asOf}`)
  }
  for (const snap of snapshots) {
    for (const z of snap.zones) firstAppearance(z.id, z.confirmedAt, snap.asOf!)
    for (const s of snap.swings) firstAppearance(s.id, s.confirmedAt, snap.asOf!)
    for (const g of snap.fvgs) firstAppearance(g.id, g.confirmedAt, snap.asOf!)
    for (const b of snap.orderBlocks) firstAppearance(b.id, b.confirmedAt, snap.asOf!)
    for (const e of snap.structure) firstAppearance(e.id, e.confirmedAt, snap.asOf!)
  }
})

test('once confirmed, a zone never changes what it claimed, and never disappears', () => {
  const firstSeen = new Map<string, ReturnType<typeof confirmedFacts>>()
  for (const snap of snapshots) {
    const ids = new Set(snap.zones.map((z) => z.id))
    for (const id of firstSeen.keys()) assert.ok(ids.has(id), `${id} vanished at ${snap.asOf}`)
    for (const z of snap.zones) {
      const seen = firstSeen.get(z.id)
      if (seen) assert.deepEqual(confirmedFacts(z), seen, `${z.id} was rewritten at ${snap.asOf}`)
      else firstSeen.set(z.id, confirmedFacts(z))
    }
  }
})

test('once confirmed, an order block never changes what it claimed, and never disappears', () => {
  const firstSeen = new Map<string, ReturnType<typeof obFacts>>()
  for (const snap of snapshots) {
    const ids = new Set(snap.orderBlocks.map((b) => b.id))
    for (const id of firstSeen.keys()) assert.ok(ids.has(id), `${id} vanished at ${snap.asOf}`)
    for (const b of snap.orderBlocks) {
      const seen = firstSeen.get(b.id)
      if (seen) assert.deepEqual(obFacts(b), seen, `${b.id} was rewritten at ${snap.asOf}`)
      else firstSeen.set(b.id, obFacts(b))
    }
  }
})

test('zone and order-block status only moves forward; touches, links and breaker history only grow', () => {
  const rank = { fresh: 0, tested: 1, mitigated: 2, invalid: 3 }
  const last = new Map<string, SupplyDemandZone | OrderBlock>()
  for (const snap of snapshots) {
    for (const z of [...snap.zones, ...snap.orderBlocks]) {
      const prev = last.get(z.id)
      if (prev) {
        assert.ok(rank[z.status] >= rank[prev.status], `${z.id}: ${prev.status} → ${z.status}`)
        assert.ok(z.touches >= prev.touches)
        assert.deepEqual(z.events.slice(0, prev.events.length), prev.events, `${z.id}: history rewritten`)
        if (`relatedOrderBlockIds` in z && `relatedOrderBlockIds` in prev) assert.deepEqual(z.relatedOrderBlockIds.slice(0, prev.relatedOrderBlockIds.length), prev.relatedOrderBlockIds)
        if (`breaker` in prev && prev.breaker) {
          const b = (z as OrderBlock).breaker!
          assert.equal(b.since, prev.breaker.since)
          if (prev.breaker.endedAt !== null) assert.equal(b.endedAt, prev.breaker.endedAt)
        }
      }
      last.set(z.id, z)
    }
  }
})

test('an FVG never changes its edges or dates, its fill only deepens, and it never disappears', () => {
  const rank = { open: 0, partial: 1, filled: 2 }
  const last = new Map<string, VeloxState[`fvgs`][number]>()
  for (const snap of snapshots) {
    const ids = new Set(snap.fvgs.map((g) => g.id))
    for (const id of last.keys()) assert.ok(ids.has(id), `${id} vanished`)
    for (const g of snap.fvgs) {
      const prev = last.get(g.id)
      if (prev) {
        assert.deepEqual([g.direction, g.high, g.low, g.originTime, g.confirmedAt, g.sizeATR], [prev.direction, prev.high, prev.low, prev.originTime, prev.confirmedAt, prev.sizeATR])
        assert.ok(g.filled >= prev.filled && rank[g.status] >= rank[prev.status])
      }
      last.set(g.id, g)
    }
  }
})

test('the state after n candles is the same live or recalculated from history (spot checks)', () => {
  for (const n of [1, 50, 437, 1200, 2999]) assert.deepEqual(run(candles.slice(0, n), instrument(), settings), snapshots[n - 1])
})

test('same candles and settings give identical output; different settings give a different hash', () => {
  assert.deepEqual(run(candles, instrument(), settings), run(candles, instrument(), settings))
  assert.notEqual(run(candles.slice(0, 10), instrument(), { zoneMinDisplacementATR: 2 }).settingsHash, final.settingsHash)
})

test('10. a 1h engine fed from 15m candles only ever sees closed hours', () => {
  const hourly = createEngine(instrument({ timeframe: `1h` }), settings)
  let fed = 0
  for (let i = 0; i < 800; i++) {
    const asOf = candles[i]!.time + 900
    const { closed, forming } = aggregate(candles.slice(0, i + 1), `15m`, `1h`, asOf)
    for (const h of closed.slice(fed)) {
      assert.ok(h.time + 3600 <= asOf, `an hour was used before it closed`)
      hourly.push(h)
    }
    fed = closed.length
    if (forming) assert.ok(forming.time + 3600 > asOf)
    for (const z of hourly.state().zones) assert.ok(z.confirmedAt <= asOf)
  }
  assert.ok(fed >= 190)
})
