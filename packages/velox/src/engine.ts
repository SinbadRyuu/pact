import { TIMEFRAME_SECONDS } from './candles.ts'
import { stableHash } from './hash.ts'
import { scoreZone, type ScoreInput } from './score.ts'
import { ENGINE_VERSION, resolveSettings, type VeloxSettings, type VeloxSettingsInput } from './settings.ts'
import type { Candle, DevelopingZone, Instrument, Signal, SupplyDemandZone, Swing, VeloxState, ZoneStatus, ZoneType } from './types.ts'

export type Engine = {
  readonly settings: VeloxSettings
  /** Process the next CLOSED candle. Times must strictly increase; a forming candle must never be pushed. */
  push(candle: Candle): void
  /** A copy of everything known after the last pushed candle. */
  state(): VeloxState
}

type Candidate = {
  type: ZoneType
  swing: Swing
  b0: number
  b1: number
  near: number
  far: number
  atr: number
}

type LiveZone = {
  zone: SupplyDemandZone
  confirmedIndex: number
  atr: number
  scoreInput: ScoreInput
  inside: boolean
}

type LiveSignal = Signal & { index: number }

/**
 * Velox runs bar by bar. On each closed candle it can only see that candle and the ones before it,
 * so a result produced at bar n is exactly what was knowable at bar n: replaying history one candle
 * at a time gives the same answers as running it all at once, and later candles can change a zone's
 * status but never its confirmed facts.
 */
export function createEngine(instrument: Instrument, input: VeloxSettingsInput = {}): Engine {
  const settings = resolveSettings(input)
  const step = TIMEFRAME_SECONDS[instrument.timeframe]
  const settingsHash = stableHash(settings)
  const L = settings.swingLength

  const candles: Candle[] = []
  const atr: (number | null)[] = []
  let trSum = 0
  const swings: Swing[] = []
  let pending: Candidate[] = []
  const zones: LiveZone[] = []
  const signals: LiveSignal[] = []

  const round = (v: number) => Number(v.toFixed(instrument.pricePrecision))
  const closeOf = (i: number) => candles[i]!.time + step
  const c = (i: number) => candles[i]!

  function updateAtr(i: number) {
    const k = c(i)
    const tr = i === 0 ? k.high - k.low : Math.max(k.high - k.low, Math.abs(k.high - c(i - 1).close), Math.abs(k.low - c(i - 1).close))
    const n = settings.atrPeriod
    if (i < n - 1) {
      trSum += tr
      atr.push(null)
    } else if (i === n - 1) {
      trSum += tr
      atr.push(trSum / n)
    } else {
      atr.push(((atr[i - 1] as number) * (n - 1) + tr) / n)
    }
  }

  // A swing at p is confirmed at i = p + L: it must beat the L candles on each side
  // (strictly on the right, at least equal on the left, as TradingView's pivots do).
  function detectSwing(i: number) {
    const p = i - L
    if (p < L) return
    for (const kind of [`high`, `low`] as const) {
      const v = kind === `high` ? c(p).high : c(p).low
      let ok = true
      for (let j = p - L; j <= p + L && ok; j++) {
        if (j === p) continue
        const w = kind === `high` ? c(j).high : c(j).low
        const beaten = kind === `high` ? (j < p ? w > v : w >= v) : j < p ? w < v : w <= v
        if (beaten) ok = false
      }
      if (!ok) continue
      const swing: Swing = { id: `${instrument.timeframe}:${kind}:${c(p).time}`, kind, price: v, time: c(p).time, index: p, confirmedAt: closeOf(i), confirmedIndex: i }
      swings.push(swing)
      const cand = baseFor(swing, i)
      if (cand) pending.push(cand)
    }
  }

  // The base is the swing candle plus quiet neighbours (range ≤ baseRangeATR), up to maxBaseCandles.
  function baseFor(swing: Swing, i: number): Candidate | null {
    const a = atr[swing.index]
    if (a == null || !(a > 0)) return null
    const quiet = (j: number) => c(j).high - c(j).low <= settings.baseRangeATR * a
    let b0 = swing.index
    let b1 = swing.index
    while (b1 - b0 + 1 < settings.maxBaseCandles && b0 - 1 >= 0 && quiet(b0 - 1)) b0--
    while (b1 - b0 + 1 < settings.maxBaseCandles && b1 + 1 <= i && quiet(b1 + 1)) b1++

    const type: ZoneType = swing.kind === `low` ? `demand` : `supply`
    const sign = type === `demand` ? 1 : -1
    let near = -sign * Infinity
    let far = sign * Infinity
    for (let j = b0; j <= b1; j++) {
      const k = c(j)
      const bodyNear = sign > 0 ? Math.max(k.open, k.close) : Math.min(k.open, k.close)
      const bodyFar = sign > 0 ? Math.min(k.open, k.close) : Math.max(k.open, k.close)
      const wickNear = sign > 0 ? k.high : k.low
      const wickFar = sign > 0 ? k.low : k.high
      const n = settings.zoneWidth === `wick` ? wickNear : bodyNear
      const f = settings.zoneWidth === `body` ? bodyFar : wickFar
      near = sign > 0 ? Math.max(near, n) : Math.min(near, n)
      far = sign > 0 ? Math.min(far, f) : Math.max(far, f)
    }
    const height = sign * (near - far)
    if (height < settings.minWidthATR * a) near = far + sign * settings.minWidthATR * a
    if (height > settings.maxWidthATR * a) near = far + sign * settings.maxWidthATR * a
    return { type, swing, b0, b1, near: round(near), far: round(far), atr: a }
  }

  function overlapsActive(cand: Candidate): boolean {
    if (settings.overlapLimit === 0) return false
    const lo = Math.min(cand.near, cand.far)
    const hi = Math.max(cand.near, cand.far)
    for (const z of zones) {
      if (z.zone.type !== cand.type || (z.zone.status !== `fresh` && z.zone.status !== `tested`)) continue
      const overlap = Math.min(hi, z.zone.high) - Math.max(lo, z.zone.low)
      if (hi > lo && overlap / (hi - lo) >= settings.overlapLimit) return true
    }
    return false
  }

  // A candidate becomes a zone when, within departureBars after its base, price closed displacementATR
  // beyond the near edge (and, if required, beyond the last opposite swing). It dies if price closes
  // beyond its far edge first, or the window ends.
  function checkCandidates(i: number) {
    const keep: Candidate[] = []
    for (const cand of pending) {
      const sign = cand.type === `demand` ? 1 : -1
      const windowEnd = cand.b1 + settings.departureBars
      let best = 0
      let reachedAt = -1
      let brokeFar = false
      for (let j = cand.b1 + 1; j <= i; j++) {
        if (sign * (c(j).close - cand.far) < 0) brokeFar = true
        if (j > windowEnd) continue
        const d = (sign * (c(j).close - cand.near)) / cand.atr
        if (d > best) best = d
        if (reachedAt < 0 && d >= settings.displacementATR) reachedAt = j
      }
      if (brokeFar) continue

      const opposite = [...swings].reverse().find((s) => s.kind === (sign > 0 ? `high` : `low`) && s.index < cand.swing.index && s.confirmedIndex <= i)
      let broke: { swingId: string; price: number } | null = null
      if (opposite) {
        for (let j = cand.b1 + 1; j <= i && !broke; j++) if (sign * (c(j).close - opposite.price) > 0) broke = { swingId: opposite.id, price: opposite.price }
      }

      const ready = reachedAt >= 0 && (!settings.requireStructureBreak || broke !== null)
      if (ready) {
        if (!overlapsActive(cand)) confirm(cand, i, best, reachedAt - cand.b1, broke)
        continue
      }
      if (i < windowEnd) keep.push(cand)
    }
    pending = keep
  }

  function confirm(cand: Candidate, i: number, displacementATR: number, departureBars: number, broke: { swingId: string; price: number } | null) {
    const scoreInput: ScoreInput = {
      displacementATR,
      departureBars,
      heightATR: Math.abs(cand.near - cand.far) / cand.atr,
      brokeStructure: broke !== null,
      timeframe: instrument.timeframe,
    }
    const scored = scoreZone(scoreInput, `fresh`, 0, settings)
    const id = `${instrument.symbol}:${instrument.provider}:${instrument.timeframe}:${cand.type}:${c(cand.b0).time}`
    const zone: SupplyDemandZone = {
      id,
      type: cand.type,
      symbol: instrument.symbol,
      provider: instrument.provider,
      timeframe: instrument.timeframe,
      high: Math.max(cand.near, cand.far),
      low: Math.min(cand.near, cand.far),
      originTime: c(cand.b0).time,
      baseEndTime: c(cand.b1).time,
      confirmedAt: closeOf(i),
      strengthAtConfirmation: scored.strength,
      strength: scored.strength,
      score: scored.factors,
      status: `fresh`,
      statusChangedAt: closeOf(i),
      touches: 0,
      events: [],
      source: {
        swingId: cand.swing.id,
        displacementATR: Number(displacementATR.toFixed(2)),
        departureBars,
        baseCandles: cand.b1 - cand.b0 + 1,
        brokeStructure: broke,
        atr: Number(cand.atr.toFixed(instrument.pricePrecision + 2)),
      },
      engineVersion: ENGINE_VERSION,
    }
    const k = c(i)
    const inside = cand.type === `demand` ? k.low <= zone.high : k.high >= zone.low
    zones.push({ zone, confirmedIndex: i, atr: cand.atr, scoreInput, inside })
  }

  function setStatus(z: LiveZone, status: ZoneStatus, at: number) {
    if (z.zone.status === status) return
    z.zone.status = status
    z.zone.statusChangedAt = at
  }

  // Lifecycle, in this order on each candle after confirmation:
  //   left     price moved touchExitATR beyond the near edge after a touch
  //   touch    price came back to the near edge (counted once per visit)
  //   mitigated  price reached mitigationDepth of the way into the zone
  //   invalid  a candle closed invalidationATR beyond the far edge
  function runLifecycle(i: number) {
    const k = c(i)
    const at = closeOf(i)
    for (const z of zones) {
      if (z.confirmedIndex >= i || z.zone.status === `invalid`) continue
      const zone = z.zone
      const demand = zone.type === `demand`
      const near = demand ? zone.high : zone.low
      const far = demand ? zone.low : zone.high
      const sign = demand ? 1 : -1
      const height = zone.high - zone.low
      const reach = demand ? k.low : k.high // how far into the zone this candle went

      if (z.inside && sign * (reach - near) > settings.touchExitATR * z.atr) {
        z.inside = false
        zone.events.push({ time: at, kind: `left` })
      }
      if (!z.inside && sign * (reach - near) <= 0) {
        const wasFresh = zone.status === `fresh`
        z.inside = true
        zone.touches++
        zone.events.push({ time: at, kind: `touch` })
        if (wasFresh) {
          setStatus(z, `tested`, at)
          maybeSignal(z, i)
        }
      }
      if ((zone.status === `fresh` || zone.status === `tested`) && sign * (reach - (near - sign * settings.mitigationDepth * height)) <= 0) {
        setStatus(z, `mitigated`, at)
        zone.events.push({ time: at, kind: `mitigated` })
      }
      if (sign * (k.close - (far - sign * settings.invalidationATR * z.atr)) < 0) {
        setStatus(z, `invalid`, at)
        zone.events.push({ time: at, kind: `invalidated` })
      }
      const scored = scoreZone(z.scoreInput, zone.status, zone.touches, settings)
      zone.strength = scored.strength
      zone.score = scored.factors
    }
  }

  // First return to a fresh zone strong enough to trade. Entry at the near edge (or the open, if the
  // candle opened inside the zone), stop beyond the far edge, target 1:1 with the stop.
  function maybeSignal(z: LiveZone, i: number) {
    const s = settings.signals
    if (!s.enabled || z.zone.strengthAtConfirmation < s.minStrength) return
    const k = c(i)
    const demand = z.zone.type === `demand`
    const sign = demand ? 1 : -1
    const near = demand ? z.zone.high : z.zone.low
    const far = demand ? z.zone.low : z.zone.high
    const entry = round(sign * (k.open - near) < 0 ? k.open : near)
    const stopLoss = round(far - sign * s.stopBufferATR * z.atr)
    if (sign * (entry - stopLoss) <= 0) return // opened beyond the stop: no trade
    const { risk, takeProfit } = oneToOne(entry, stopLoss, instrument.pricePrecision)
    const sig: LiveSignal = {
      id: `${z.zone.id}:signal`,
      zoneId: z.zone.id,
      side: demand ? `buy` : `sell`,
      time: k.time,
      entry,
      stopLoss,
      takeProfit,
      risk,
      outcome: `open`,
      closedAt: null,
      engineVersion: ENGINE_VERSION,
      index: i,
    }
    // On the entry candle we cannot know whether the target came before the fill, so only the stop is checked.
    if (sign * ((demand ? k.low : k.high) - stopLoss) <= 0) {
      sig.outcome = `sl`
      sig.closedAt = closeOf(i)
    }
    signals.push(sig)
  }

  // A candle reaching both the stop and the target counts as a loss: the order inside a candle is unknown.
  function trackSignals(i: number) {
    const k = c(i)
    for (const s of signals) {
      if (s.outcome !== `open` || s.index >= i) continue
      const buy = s.side === `buy`
      if (buy ? k.low <= s.stopLoss : k.high >= s.stopLoss) {
        s.outcome = `sl`
        s.closedAt = closeOf(i)
      } else if (buy ? k.high >= s.takeProfit : k.low <= s.takeProfit) {
        s.outcome = `tp`
        s.closedAt = closeOf(i)
      }
    }
  }

  return {
    settings,
    push(candle) {
      const last = candles.at(-1)
      if (last && candle.time <= last.time) throw new RangeError(`candles must be pushed in time order without repeats (got ${candle.time} after ${last.time})`)
      if (candle.time % step !== 0) throw new RangeError(`candle time ${candle.time} is not aligned to ${instrument.timeframe}`)
      candles.push({ ...candle })
      const i = candles.length - 1
      updateAtr(i)
      trackSignals(i)
      runLifecycle(i)
      detectSwing(i)
      checkCandidates(i)
    },
    state() {
      const developing: DevelopingZone[] = pending.map((p) => ({
        type: p.type,
        swingId: p.swing.id,
        high: Math.max(p.near, p.far),
        low: Math.min(p.near, p.far),
        originTime: c(p.b0).time,
        // Close of the last candle in the departure window, assuming no gaps.
        expiresAfter: c(p.b1).time + step * (settings.departureBars + 1),
      }))
      return structuredClone({
        engine: `velox` as const,
        engineVersion: ENGINE_VERSION,
        settingsHash,
        instrument,
        asOf: candles.length ? closeOf(candles.length - 1) : null,
        candles: candles.length,
        swings,
        zones: zones.map((z) => z.zone),
        developing,
        signals: signals.map(({ index: _index, ...s }) => s),
      })
    },
  }
}

/**
 * The take-profit for a 1:1 risk-to-reward trade: as far from the entry as the stop, on the other side.
 * Entry 4000.00 with stop 3990.00 gives 4010.00; entry 4000.00 with stop 4010.00 gives 3990.00.
 */
export function oneToOne(entry: number, stopLoss: number, precision: number): { risk: number; takeProfit: number } {
  const round = (v: number) => Number(v.toFixed(precision))
  const risk = round(Math.abs(entry - stopLoss))
  return { risk, takeProfit: round(entry + (entry > stopLoss ? risk : -risk)) }
}

/** Runs the engine over a whole series of closed candles and returns the final state. */
export function run(candles: readonly Candle[], instrument: Instrument, settings?: VeloxSettingsInput): VeloxState {
  const engine = createEngine(instrument, settings)
  for (const k of candles) engine.push(k)
  return engine.state()
}
