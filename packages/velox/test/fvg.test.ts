import { test } from 'node:test'
import assert from 'node:assert/strict'
import { run, type VeloxSettingsInput } from '../src/index.ts'
import { bars, BOS_ROWS, DEMAND_ROWS, instrument, mirror, STEP, T0 } from './helpers.ts'

const settings: VeloxSettingsInput = { atrPeriod: 5, swingLength: 2 }
const candles = bars(DEMAND_ROWS)
const at = (i: number) => T0 + i * STEP
const closeAt = (i: number) => at(i) + STEP
const gapAfter = (n: number, low: number, high: number, input = candles, s = settings) =>
  run(input.slice(0, n), instrument(), s).fvgs.find((g) => g.low === low && g.high === high)

test('a bullish FVG is the untraded range between candle 1’s high and candle 3’s low, known when candle 3 closes', () => {
  // Candles 9, 10, 11: high[9] = 94.5, low[11] = 95.8.
  assert.equal(gapAfter(11, 94.5, 95.8), undefined)
  const g = gapAfter(12, 94.5, 95.8)
  assert.ok(g)
  assert.equal(g.direction, `bullish`)
  assert.equal(g.originTime, at(10)) // drawn from the middle candle
  assert.equal(g.confirmedAt, closeAt(11))
  assert.equal(g.status, `open`)
  assert.equal(g.filled, 0)
})

test('an FVG goes open → partial → filled as price trades back through it', () => {
  // 96.5–98.8 from candles 10–12. Candle 15 dips to 97, candle 16 to 93.8.
  assert.equal(gapAfter(15, 96.5, 98.8)!.status, `open`)
  const partial = gapAfter(16, 96.5, 98.8)!
  assert.equal(partial.status, `partial`)
  assert.equal(partial.filled, Number(((98.8 - 97) / 2.3).toFixed(4)))
  assert.equal(partial.statusChangedAt, closeAt(15))
  const filled = gapAfter(17, 96.5, 98.8)!
  assert.deepEqual([filled.status, filled.filled, filled.statusChangedAt], [`filled`, 1, closeAt(16)])
})

test('bearish FVGs mirror bullish ones', () => {
  const up = gapAfter(17, 96.5, 98.8)!
  const down = gapAfter(17, 200 - 98.8, 200 - 96.5, mirror(candles))!
  assert.equal(down.direction, `bearish`)
  assert.deepEqual([down.originTime, down.confirmedAt, down.status, down.filled], [up.originTime, up.confirmedAt, up.status, up.filled])
})

test('gaps smaller than fvg.minSizeATR are ignored', () => {
  assert.ok(gapAfter(12, 94.5, 95.8)) // 0.44 ATR
  assert.equal(gapAfter(12, 94.5, 95.8, candles, { ...settings, fvg: { minSizeATR: 0.5 } }), undefined)
  assert.equal(run(candles, instrument(), { ...settings, fvg: { enabled: false } }).fvgs.length, 0)
})

test('a zone whose departure left an FVG records it and scores for it', () => {
  // BOS_ROWS: the rally from the 94 low leaves a bullish gap between candle 11's high (96.4) and candle 13's low (97.6).
  const up = bars(BOS_ROWS).slice(0, 15)
  const state = run(up, instrument(), settings)
  const zone = state.zones.find((z) => z.type === `demand` && z.low === 94)!
  const gap = state.fvgs.find((g) => g.direction === `bullish` && g.low === 96.4 && g.high === 97.6)!
  assert.equal(zone.source.fvgId, gap.id)
  assert.equal(zone.score.find((f) => f.key === `fvg`)!.points, 10)

  const without = run(up, instrument(), { ...settings, fvg: { enabled: false } }).zones.find((z) => z.type === `demand` && z.low === 94)!
  assert.equal(without.source.fvgId, null)
  assert.equal(without.score.find((f) => f.key === `fvg`)!.points, 0)
  assert.equal(zone.strengthAtConfirmation - without.strengthAtConfirmation, 10)
})
