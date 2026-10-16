import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregate, createEngine, run, type SupplyDemandZone, type VeloxState } from '../src/index.ts'
import { instrument, walk } from './helpers.ts'

// Historical replay: feed candles one at a time, keep the state after each, and check that
// nothing the engine claimed as confirmed was later rewritten or back-dated.

const candles = walk(3000)
const settings = { signals: { minStrength: 0 } }

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
  baseEndTime: z.baseEndTime,
  confirmedAt: z.confirmedAt,
  strengthAtConfirmation: z.strengthAtConfirmation,
  source: z.source,
  engineVersion: z.engineVersion,
})

test('the walk produces enough zones and signals to make the replay meaningful', () => {
  assert.ok(final.zones.filter((z) => z.type === `demand`).length >= 5, `demand zones: ${final.zones.length}`)
  assert.ok(final.zones.filter((z) => z.type === `supply`).length >= 5)
  assert.ok(final.signals.length >= 5)
  assert.ok(final.fvgs.length >= 20 && final.fvgs.some((g) => g.status === `open`) && final.fvgs.some((g) => g.status === `filled`))
  assert.ok(final.zones.some((z) => z.source.fvgId !== null))
  assert.ok(final.zones.some((z) => z.status === `invalid`) && final.zones.some((z) => z.status !== `invalid`))
})

test('replaying bar by bar ends in exactly the same state as one full run', () => {
  assert.deepEqual(run(candles, instrument(), settings), final)
})

test('no zone, swing or signal appears before the candle that confirmed it', () => {
  for (const snap of snapshots) {
    for (const z of snap.zones) assert.ok(z.confirmedAt <= snap.asOf!, `${z.id} known at ${z.confirmedAt} but shown at ${snap.asOf}`)
    for (const s of snap.swings) assert.ok(s.confirmedAt <= snap.asOf!)
    for (const g of snap.fvgs) assert.ok(g.confirmedAt <= snap.asOf! && g.statusChangedAt <= snap.asOf!)
    for (const z of snap.zones) if (z.source.fvgId) assert.ok(snap.fvgs.some((g) => g.id === z.source.fvgId && g.confirmedAt <= z.confirmedAt))
    for (const s of snap.signals) assert.ok(s.time < snap.asOf!)
    for (const z of snap.zones) for (const e of z.events) assert.ok(e.time > z.confirmedAt && e.time <= snap.asOf!)
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
    for (const s of snap.signals) firstAppearance(s.id, s.time + 900, snap.asOf!)
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

test('zone status only moves forward, and touches only go up', () => {
  const rank = { fresh: 0, tested: 1, mitigated: 2, invalid: 3 }
  const last = new Map<string, SupplyDemandZone>()
  for (const snap of snapshots) {
    for (const z of snap.zones) {
      const prev = last.get(z.id)
      if (prev) {
        assert.ok(rank[z.status] >= rank[prev.status], `${z.id}: ${prev.status} → ${z.status}`)
        assert.ok(z.touches >= prev.touches)
        assert.deepEqual(z.events.slice(0, prev.events.length), prev.events, `${z.id}: history rewritten`)
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

test('signal levels never change, and an outcome once decided is final', () => {
  const seen = new Map<string, VeloxState[`signals`][number]>()
  for (const snap of snapshots) {
    for (const s of snap.signals) {
      const prev = seen.get(s.id)
      if (prev) {
        assert.deepEqual([s.entry, s.stopLoss, s.takeProfit, s.time], [prev.entry, prev.stopLoss, prev.takeProfit, prev.time])
        if (prev.outcome !== `open`) assert.deepEqual([s.outcome, s.closedAt], [prev.outcome, prev.closedAt])
      }
      seen.set(s.id, s)
    }
  }
  for (const s of final.signals) {
    assert.equal(Number(Math.abs(s.takeProfit - s.entry).toFixed(2)), Number(Math.abs(s.entry - s.stopLoss).toFixed(2)), `${s.id} is not 1:1`)
    assert.ok(s.side === `buy` ? s.stopLoss < s.entry && s.entry < s.takeProfit : s.takeProfit < s.entry && s.entry < s.stopLoss)
  }
})

test('the state after n candles is the same live or recalculated from history (spot checks)', () => {
  for (const n of [1, 50, 437, 1200, 2999]) assert.deepEqual(run(candles.slice(0, n), instrument(), settings), snapshots[n - 1])
})

test('same candles and settings give identical output; different settings give a different hash', () => {
  assert.deepEqual(run(candles, instrument(), settings), run(candles, instrument(), settings))
  assert.notEqual(run(candles.slice(0, 10), instrument(), { displacementATR: 2 }).settingsHash, final.settingsHash)
})

test('a 1h engine fed from 15m candles only ever sees closed hours', () => {
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
