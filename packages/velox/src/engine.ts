import { TIMEFRAME_SECONDS } from './candles.ts'
import { stableHash } from './hash.ts'
import { scoreOrderBlock, scoreZone, type OrderBlockScoreInput, type ZoneScoreInput } from './score.ts'
import { ENGINE_VERSION, resolveSettings, type VeloxSettings, type VeloxSettingsInput } from './settings.ts'
import type {
  Candle,
  FairValueGap,
  Instrument,
  LevelEvent,
  OrderBlock,
  StructureEvent,
  SupplyDemandZone,
  Swing,
  VeloxState,
  ZoneStatus,
} from './types.ts'

export type Engine = {
  readonly settings: VeloxSettings
  /** Process the next CLOSED candle. Times must strictly increase; a forming candle must never be pushed. */
  push(candle: Candle): void
  /** A copy of everything known after the last pushed candle. */
  state(): VeloxState
}

/** Shared lifecycle bookkeeping for zones and order blocks. `bull` = demand / bullish order block. */
type Tracked = {
  bull: boolean
  item: { high: number; low: number; status: ZoneStatus; statusChangedAt: number; touches: number; events: LevelEvent[] }
  confirmedIndex: number
  atr: number
  inside: boolean
  rescore: () => void
  breaker?: OrderBlock[`breaker`]
}

type Pending = { swing: Swing; near: number; far: number; atr: number }

// Highest lookback for any search, so the TradingView version (which can only see 500 candles back)
// gives the same answers.
const MAX_LOOKBACK = 499

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
  const tf = instrument.timeframe
  const prefix = `${instrument.symbol}:${instrument.provider}:${tf}`

  const candles: Candle[] = []
  const atr: (number | null)[] = []
  let trSum = 0
  const swings: Swing[] = []
  const structure: StructureEvent[] = []
  const zones: (Tracked & { zone: SupplyDemandZone })[] = []
  const blocks: (Tracked & { block: OrderBlock })[] = []
  const fvgs: { gap: FairValueGap; first: number; confirmedIndex: number }[] = []
  let pending: Pending[] = []
  let lastHigh: { swing: Swing; broken: boolean } | null = null
  let lastLow: { swing: Swing; broken: boolean } | null = null
  let trend = 0

  const round = (v: number) => Number(v.toFixed(instrument.pricePrecision))
  const closeOf = (i: number) => candles[i]!.time + step
  const c = (i: number) => candles[i]!
  const isUp = (i: number) => c(i).close > c(i).open
  const isDown = (i: number) => c(i).close < c(i).open

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

  // ───────────── Lifecycle (zones and order blocks alike) ─────────────

  function setStatus(t: Tracked, status: ZoneStatus, at: number) {
    if (t.item.status === status) return
    t.item.status = status
    t.item.statusChangedAt = at
  }

  // In this order on each candle after confirmation:
  //   left        price moved touchExitATR beyond the near edge after a visit
  //   touch       price reached the near edge (once per visit)
  //   mitigated   price reached mitigationDepth of the height
  //   invalidated a candle closed (or wicked, in wick mode) beyond the far edge
  // Breakers (failed order blocks) end when a later candle closes back beyond the near edge.
  function stepTracked(t: Tracked, i: number) {
    const k = c(i)
    const at = closeOf(i)
    const it = t.item
    const sign = t.bull ? 1 : -1
    const near = t.bull ? it.high : it.low
    const far = t.bull ? it.low : it.high

    if (it.status === `invalid`) {
      if (t.breaker && t.breaker.endedAt === null && t.breaker.since < at && sign * (k.close - near) > 0) {
        t.breaker.endedAt = at
        it.events.push({ time: at, kind: `breaker-ended` })
      }
      return
    }

    const reach = t.bull ? k.low : k.high
    if (t.inside && sign * (reach - near) > settings.touchExitATR * t.atr) {
      t.inside = false
      it.events.push({ time: at, kind: `left` })
    }
    if (!t.inside && sign * (reach - near) <= 0) {
      t.inside = true
      it.touches++
      it.events.push({ time: at, kind: `touch` })
      if (it.status === `fresh`) setStatus(t, `tested`, at)
    }
    const depth = near - sign * settings.mitigationDepth * (it.high - it.low)
    if ((it.status === `fresh` || it.status === `tested`) && sign * (reach - depth) <= 0) {
      setStatus(t, `mitigated`, at)
      it.events.push({ time: at, kind: `mitigated` })
    }
    const breach = settings.invalidation === `close` ? k.close : reach
    if (sign * (breach - (far - sign * settings.invalidationBufferATR * t.atr)) < 0) {
      setStatus(t, `invalid`, at)
      it.events.push({ time: at, kind: `invalidated` })
      if (t.breaker === null && settings.orderBlocks.breakers) {
        t.breaker = { since: at, endedAt: null }
        it.events.push({ time: at, kind: `breaker` })
      }
    }
    t.rescore()
  }

  function runLifecycle(i: number) {
    for (const z of zones) if (z.confirmedIndex < i) stepTracked(z, i)
    for (const b of blocks) {
      if (b.confirmedIndex < i) stepTracked(b, i)
      b.block.breaker = b.breaker ?? null
    }
  }

  // ───────────── Fair value gaps ─────────────

  // Bullish on candles i-2, i-1, i: low[i] > high[i-2]. Bearish: high[i] < low[i-2].
  function detectFvg(i: number) {
    if (!settings.fvg.enabled || i < 2) return
    const a = atr[i]
    if (a == null || !(a > 0)) return
    const first = c(i - 2)
    const third = c(i)
    for (const direction of [`bullish`, `bearish`] as const) {
      const low = direction === `bullish` ? first.high : third.high
      const high = direction === `bullish` ? third.low : first.low
      if (!(high > low) || (high - low) / a < settings.fvg.minSizeATR) continue
      fvgs.push({
        gap: {
          id: `${prefix}:fvg:${direction}:${c(i - 1).time}`,
          direction,
          symbol: instrument.symbol,
          provider: instrument.provider,
          timeframe: tf,
          high: round(high),
          low: round(low),
          originTime: c(i - 1).time,
          confirmedAt: closeOf(i),
          sizeATR: Number(((high - low) / a).toFixed(2)),
          status: `open`,
          statusChangedAt: closeOf(i),
          filled: 0,
          engineVersion: ENGINE_VERSION,
        },
        first: i - 2,
        confirmedIndex: i,
      })
    }
  }

  // Fill is measured by wicks: how far price has traded back into the gap, 0 to 1.
  function runFvgLifecycle(i: number) {
    const k = c(i)
    for (const f of fvgs) {
      const g = f.gap
      if (f.confirmedIndex >= i || g.status === `filled`) continue
      const depth = g.direction === `bullish` ? (g.high - k.low) / (g.high - g.low) : (k.high - g.low) / (g.high - g.low)
      if (depth <= g.filled) continue
      g.filled = Number(Math.min(1, depth).toFixed(4))
      const status = g.filled >= 1 ? `filled` : `partial`
      if (status !== g.status) {
        g.status = status
        g.statusChangedAt = closeOf(i)
      }
    }
  }

  // ───────────── Swings ─────────────

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
      const swing: Swing = { id: `${tf}:${kind}:${c(p).time}`, kind, price: v, time: c(p).time, index: p, confirmedAt: closeOf(i), confirmedIndex: i }
      swings.push(swing)
      if (kind === `high`) lastHigh = { swing, broken: false }
      else lastLow = { swing, broken: false }
      if (!settings.requireBOS) {
        const edges = zoneEdges(kind === `low`, p, p, i)
        if (edges) pending.push({ swing, ...edges })
      }
    }
  }

  // ───────────── Zones ─────────────

  /**
   * Edges of a zone whose origin candle is o. The far edge is o's wick; the near edge depends on
   * zoneWidth. `from`..`to` bounds the neighbours a `base` zone may include.
   */
  function zoneEdges(bull: boolean, o: number, from: number, to: number): { near: number; far: number; atr: number } | null {
    const a = atr[o]
    if (a == null || !(a > 0)) return null
    const sign = bull ? 1 : -1
    const k = c(o)
    const far = bull ? k.low : k.high
    let near: number
    if (settings.zoneWidth === `wick`) near = bull ? Math.min(k.open, k.close) : Math.max(k.open, k.close)
    else if (settings.zoneWidth === `atr`) near = far + sign * settings.zoneAtrBand * a
    else {
      const quiet = (j: number) => c(j).high - c(j).low <= settings.baseRangeATR * a
      let b0 = o
      let b1 = o
      while (b1 - b0 + 1 < settings.maxBaseCandles && b0 - 1 >= from && quiet(b0 - 1)) b0--
      while (b1 - b0 + 1 < settings.maxBaseCandles && b1 + 1 <= to && quiet(b1 + 1)) b1++
      near = bull ? -Infinity : Infinity
      for (let j = b0; j <= b1; j++) {
        const body = bull ? Math.max(c(j).open, c(j).close) : Math.min(c(j).open, c(j).close)
        near = bull ? Math.max(near, body) : Math.min(near, body)
      }
    }
    const height = sign * (near - far)
    if (height < settings.minHeightATR * a) near = far + sign * settings.minHeightATR * a
    if (height > settings.maxHeightATR * a) near = far + sign * settings.maxHeightATR * a
    return { near: round(near), far: round(far), atr: a }
  }

  const overlapFraction = (lo: number, hi: number, z: { high: number; low: number }) => (hi > lo ? Math.max(0, Math.min(hi, z.high) - Math.max(lo, z.low)) / (hi - lo) : 0)
  const near = (a: { high: number; low: number }, b: { high: number; low: number }, gap: number) => Math.max(a.low, b.low) - Math.min(a.high, b.high) <= gap

  function overlapsLive(bull: boolean, lo: number, hi: number): boolean {
    if (settings.overlapLimit === 0) return false
    return zones.some((z) => z.bull === bull && (z.item.status === `fresh` || z.item.status === `tested`) && overlapFraction(lo, hi, z.item) >= settings.overlapLimit)
  }

  function departureFvg(bull: boolean, o: number, i: number): string | null {
    const direction = bull ? `bullish` : `bearish`
    const f = fvgs.find((x) => x.gap.direction === direction && x.first >= o && x.confirmedIndex <= i)
    return f ? f.gap.id : null
  }

  function addZone(bull: boolean, o: number, i: number, edges: { near: number; far: number; atr: number }, displacementATR: number, departureBars: number, structureEventId: string | null, swingId: string | null, ob: { id: string; high: number; low: number } | null) {
    const id = `${prefix}:${bull ? `demand` : `supply`}:${c(o).time}`
    if (zones.some((z) => z.zone.id === id)) return null
    const fvgId = departureFvg(bull, o, i)
    const box = { high: Math.max(edges.near, edges.far), low: Math.min(edges.near, edges.far) }
    const onZone = ob !== null && near(ob, box, settings.orderBlocks.nearATR * edges.atr)
    const input: ZoneScoreInput = { displacementATR, departureBars, structure: structureEventId !== null, orderBlock: onZone, fvg: fvgId !== null, timeframe: tf }
    const scored = scoreZone(input, `fresh`, 0, settings)
    const zone: SupplyDemandZone = {
      id,
      type: bull ? `demand` : `supply`,
      symbol: instrument.symbol,
      provider: instrument.provider,
      timeframe: tf,
      ...box,
      originTime: c(o).time,
      confirmedAt: closeOf(i),
      strengthAtConfirmation: scored.strength,
      strength: scored.strength,
      score: scored.factors,
      status: `fresh`,
      statusChangedAt: closeOf(i),
      touches: 0,
      events: [],
      source: {
        structureEventId,
        swingId,
        displacementATR: Number(displacementATR.toFixed(2)),
        departureBars,
        orderBlockId: onZone ? ob.id : null,
        fvgId,
        atr: Number(edges.atr.toFixed(instrument.pricePrecision + 2)),
      },
      relatedOrderBlockIds: onZone ? [ob.id] : [],
      engineVersion: ENGINE_VERSION,
    }
    const reach = bull ? c(i).low : c(i).high
    const tracked = {
      bull,
      item: zone,
      zone,
      confirmedIndex: i,
      atr: edges.atr,
      inside: (bull ? 1 : -1) * (reach - (bull ? zone.high : zone.low)) <= 0,
      rescore: () => {
        const s = scoreZone(input, zone.status, zone.touches, settings)
        zone.strength = s.strength
        zone.score = s.factors
      },
    }
    zones.push(tracked)
    return tracked
  }

  // Zones without a break (requireBOS: false): a confirmed swing that price leaves by
  // zoneMinDisplacementATR within departureBars. Dropped if price closes beyond its far edge first.
  function checkPending(i: number) {
    const keep: Pending[] = []
    for (const p of pending) {
      const bull = p.swing.kind === `low`
      const sign = bull ? 1 : -1
      const o = p.swing.index
      let reached = -1
      let best = 0
      let broke = false
      for (let j = o + 1; j <= i; j++) {
        if (sign * (c(j).close - p.far) < 0) broke = true
        if (j > o + settings.departureBars) continue
        const d = (sign * (c(j).close - p.near)) / p.atr
        best = Math.max(best, d)
        if (reached < 0 && d >= settings.zoneMinDisplacementATR) reached = j
      }
      if (broke) continue
      if (reached >= 0) {
        const lo = Math.min(p.near, p.far)
        const hi = Math.max(p.near, p.far)
        if (!overlapsLive(bull, lo, hi)) addZone(bull, o, i, p, best, reached - o, null, p.swing.id, null)
        continue
      }
      if (i < o + settings.departureBars) keep.push(p)
    }
    pending = keep
  }

  // ───────────── Structure breaks → zones and order blocks ─────────────

  function detectBreak(i: number) {
    const k = c(i)
    let up = lastHigh !== null && !lastHigh.broken && k.close > lastHigh.swing.price
    let down = lastLow !== null && !lastLow.broken && k.close < lastLow.swing.price
    if (up && down) {
      // An outside candle broke both sides: its direction decides.
      up = k.close >= k.open
      down = !up
    }
    if (up) onBreak(true, i)
    if (down) onBreak(false, i)
  }

  function onBreak(bull: boolean, i: number) {
    const level = (bull ? lastHigh : lastLow)!
    level.broken = true
    const sign = bull ? 1 : -1
    const event: StructureEvent = {
      id: `${tf}:${bull ? `up` : `down`}:${c(i).time}`,
      kind: (bull ? trend <= 0 : trend >= 0) ? `CHoCH` : `BOS`,
      direction: bull ? `up` : `down`,
      level: level.swing.price,
      swingId: level.swing.id,
      time: c(i).time,
      confirmedAt: closeOf(i),
    }
    structure.push(event)
    trend = sign

    // Origin: the lowest low (highest high for supply) after the broken swing, up to this candle.
    // "The low that broke the high." Ties keep the earliest candle.
    const from = Math.max(level.swing.index + 1, i - MAX_LOOKBACK)
    let o = from
    for (let j = from; j <= i; j++) if (bull ? c(j).low < c(o).low : c(j).high > c(o).high) o = j
    const edges = zoneEdges(bull, o, from, i)
    if (!edges) return

    const ob = settings.orderBlocks.enabled ? findOrderBlock(bull, o, from, i, edges.atr) : null
    const displacementATR = (sign * (c(i).close - edges.near)) / edges.atr
    let zone: ReturnType<typeof addZone> = null
    if (displacementATR >= settings.zoneMinDisplacementATR) {
      const lo = Math.min(edges.near, edges.far)
      const hi = Math.max(edges.near, edges.far)
      if (!overlapsLive(bull, lo, hi)) zone = addZone(bull, o, i, edges, displacementATR, i - o, event.id, null, ob ? { id: ob.id, high: ob.high, low: ob.low } : null)
    }
    if (ob) addOrderBlock(bull, ob, i, event.id, zone?.zone ?? null, edges.atr)
  }

  type ObCandidate = { id: string; index: number; high: number; low: number; displacementATR: number; impulseCandles: number }

  // The last opposite-close candle at or before the origin, accepted only if the move from it was
  // strong enough: displacement, impulse candles, a timely break, and no close through it on the way.
  function findOrderBlock(bull: boolean, o: number, from: number, i: number, a: number): ObCandidate | null {
    const s = settings.orderBlocks
    const sign = bull ? 1 : -1
    let ob = -1
    for (let j = o; j >= Math.max(from, o - s.lookback); j--) {
      if (bull ? isDown(j) : isUp(j)) {
        ob = j
        break
      }
    }
    if (ob < 0 || i - ob > s.maxBars) return null
    const k = c(ob)
    const high = s.range === `wick` ? k.high : s.range === `body` ? Math.max(k.open, k.close) : bull ? k.open : k.high
    const low = s.range === `wick` ? k.low : s.range === `body` ? Math.min(k.open, k.close) : bull ? k.low : k.open
    const nearEdge = bull ? high : low
    const farEdge = bull ? low : high
    const displacementATR = (sign * (c(i).close - nearEdge)) / a
    if (displacementATR < s.minDisplacementATR) return null
    let impulse = 0
    for (let j = ob + 1; j <= i; j++) {
      const x = c(j)
      if (sign * (x.close - farEdge) < 0) return null
      const range = x.high - x.low
      if ((bull ? isUp(j) : isDown(j)) && range > 0 && Math.abs(x.close - x.open) / range >= s.impulseBodyRatio) impulse++
    }
    if (impulse < s.minImpulseCandles) return null
    return { id: `${prefix}:ob:${bull ? `bullish` : `bearish`}:${k.time}`, index: ob, high: round(high), low: round(low), displacementATR, impulseCandles: impulse }
  }

  function addOrderBlock(bull: boolean, ob: ObCandidate, i: number, bosId: string, sameBreakZone: SupplyDemandZone | null, a: number) {
    if (blocks.some((b) => b.block.id === ob.id)) return
    const gap = settings.orderBlocks.nearATR * a
    const parent = sameBreakZone && near(ob, sameBreakZone, gap) ? sameBreakZone : (zones.find((z) => z.bull === bull && z.zone.status !== `invalid` && near(ob, z.zone, gap))?.zone ?? null)
    const input: OrderBlockScoreInput = { displacementATR: ob.displacementATR, impulseCandles: ob.impulseCandles, bars: i - ob.index, onZone: parent !== null, timeframe: tf }
    const scored = scoreOrderBlock(input, `fresh`, 0, settings)
    const block: OrderBlock = {
      id: ob.id,
      type: bull ? `bullish` : `bearish`,
      symbol: instrument.symbol,
      provider: instrument.provider,
      timeframe: tf,
      high: ob.high,
      low: ob.low,
      originTime: c(ob.index).time,
      confirmedAt: closeOf(i),
      strengthAtConfirmation: scored.strength,
      strength: scored.strength,
      score: scored.factors,
      status: `fresh`,
      statusChangedAt: closeOf(i),
      touches: 0,
      events: [],
      displacementATR: Number(ob.displacementATR.toFixed(2)),
      impulseCandles: ob.impulseCandles,
      bosId,
      parentZoneId: parent?.id ?? null,
      breaker: null,
      engineVersion: ENGINE_VERSION,
    }
    if (parent && !parent.relatedOrderBlockIds.includes(block.id)) parent.relatedOrderBlockIds.push(block.id)
    const reach = bull ? c(i).low : c(i).high
    blocks.push({
      bull,
      item: block,
      block,
      confirmedIndex: i,
      atr: a,
      inside: (bull ? 1 : -1) * (reach - (bull ? block.high : block.low)) <= 0,
      breaker: null,
      rescore: () => {
        const s = scoreOrderBlock(input, block.status, block.touches, settings)
        block.strength = s.strength
        block.score = s.factors
      },
    })
  }

  return {
    settings,
    push(candle) {
      const last = candles.at(-1)
      if (last && candle.time <= last.time) throw new RangeError(`candles must be pushed in time order without repeats (got ${candle.time} after ${last.time})`)
      if (candle.time % step !== 0) throw new RangeError(`candle time ${candle.time} is not aligned to ${tf}`)
      candles.push({ ...candle })
      const i = candles.length - 1
      updateAtr(i)
      runLifecycle(i)
      runFvgLifecycle(i)
      detectFvg(i)
      detectSwing(i)
      checkPending(i)
      detectBreak(i)
    },
    state() {
      return structuredClone({
        engine: `velox` as const,
        engineVersion: ENGINE_VERSION,
        settingsHash,
        instrument,
        asOf: candles.length ? closeOf(candles.length - 1) : null,
        candles: candles.length,
        swings,
        structure,
        zones: zones.map((z) => z.zone),
        orderBlocks: blocks.map((b) => b.block),
        fvgs: fvgs.map((f) => f.gap),
      })
    },
  }
}

/** Runs the engine over a whole series of closed candles and returns the final state. */
export function run(candles: readonly Candle[], instrument: Instrument, settings?: VeloxSettingsInput): VeloxState {
  const engine = createEngine(instrument, settings)
  for (const k of candles) engine.push(k)
  return engine.state()
}
