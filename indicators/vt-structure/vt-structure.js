// VT Structure for VT Impact's own charts. The same rules as vt-structure.pine, as pure functions
// over candles shaped { time, open, high, low, close, volume }, oldest first.
//
// `definition` follows the shape of the built-in indicator catalog (key, params, outputs with an
// overlay or panel placement). `compute` returns the line series the chart can draw today.
// `analyse` returns everything else the TradingView version shows — structure breaks, the
// retracement of the current leg, the latest signal with its levels, and the dashboard readings —
// for the chart to draw as markers, boxes and a table.

export const definition = {
  key: `structure`,
  name: `VT Structure`,
  category: `trend`,
  summary: `Swing highs and lows, the breaks between them, and where price sits in the current leg.`,
  explanation: `A swing high is a high that the bars on each side of it did not exceed; a swing low is the reverse. When price closes beyond the latest swing in the direction of the trend, that is a break of structure (BOS). When it closes beyond one against the trend, that is a change of character (CHoCH) and the trend flips. The current leg runs from where the last break started to the furthest price since, and its Fibonacci retracement levels are drawn across it.`,
  howToRead: [
    `Successive BOS in one direction describe a trend that has kept making new extremes.`,
    `A CHoCH says the last swing against the trend gave way. It does not say the new direction will last.`,
    `The 0.618 to 0.786 retracement is a zone many traders watch. Price can pass straight through it.`,
    `Buy and sell signals are this rule applied to past candles, with the stop beyond the start of the leg and targets at multiples of that risk.`,
  ],
  limitations: [
    `A swing is only confirmed after the bars that follow it, so swing labels appear late by the swing length.`,
    `In ranges, structure flips back and forth and signals whipsaw.`,
    `Stops and targets are arithmetic, not a view on where price will go. Results on past candles do not carry forward.`,
  ],
  params: [
    { key: `swingLength`, label: `Swing length`, min: 2, max: 50, step: 1, default: 10 },
    { key: `fast`, label: `Fast EMA`, min: 2, max: 200, step: 1, default: 21 },
    { key: `slow`, label: `Slow EMA`, min: 3, max: 400, step: 1, default: 50 },
    { key: `stopAtr`, label: `Stop buffer (× ATR)`, min: 0, max: 5, step: 0.05, default: 0.25 },
  ],
  outputs: [
    { key: `emaFast`, label: `Fast EMA`, placement: `overlay` },
    { key: `emaSlow`, label: `Slow EMA`, placement: `overlay` },
    { key: `swingHigh`, label: `Swing high`, placement: `overlay` },
    { key: `swingLow`, label: `Swing low`, placement: `overlay` },
  ],
}

export const defaults = {
  swingLength: 10,
  fast: 21,
  slow: 50,
  stopAtr: 0.25,
  breakOn: `close`, // `close` or `wick`
  signalOn: `choch`, // `choch` or `choch-bos`
  emaFilter: false,
  fib: [0, 0.618, 0.65, 0.786, 1],
  targets: [1, 2, 3],
}

const empty = (n) => Array.from({ length: n }, () => null)

function ema(values, period) {
  const out = empty(values.length)
  if (values.length < period) return out
  const k = 2 / (period + 1)
  let s = 0
  for (let i = 0; i < period; i++) s += values[i]
  s /= period
  out[period - 1] = s
  for (let i = period; i < values.length; i++) {
    s = values[i] * k + s * (1 - k)
    out[i] = s
  }
  return out
}

function wilder(values, period) {
  const out = empty(values.length)
  if (values.length < period) return out
  let s = 0
  for (let i = 0; i < period; i++) s += values[i]
  s /= period
  out[period - 1] = s
  for (let i = period; i < values.length; i++) {
    s = (s * (period - 1) + values[i]) / period
    out[i] = s
  }
  return out
}

function trueRange(candles) {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low
    const pc = candles[i - 1].close
    return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc))
  })
}

export function atr(candles, period = 14) {
  return wilder(trueRange(candles), period)
}

// ADX as TradingView's ta.dmi computes it: Wilder-smoothed DI+ and DI-, then Wilder-smoothed DX.
export function adx(candles, period = 14) {
  const n = candles.length
  const out = empty(n)
  if (n <= period * 2) return out
  const plus = [0]
  const minus = [0]
  for (let i = 1; i < n; i++) {
    const up = candles[i].high - candles[i - 1].high
    const down = candles[i - 1].low - candles[i].low
    plus.push(up > down && up > 0 ? up : 0)
    minus.push(down > up && down > 0 ? down : 0)
  }
  const tr = trueRange(candles)
  const sTr = wilder(tr.slice(1), period)
  const sPlus = wilder(plus.slice(1), period)
  const sMinus = wilder(minus.slice(1), period)
  const dx = sTr.map((t, i) => {
    if (t == null || !(t > 0)) return null
    const p = (100 * sPlus[i]) / t
    const m = (100 * sMinus[i]) / t
    return p + m === 0 ? 0 : (100 * Math.abs(p - m)) / (p + m)
  })
  const first = dx.findIndex((v) => v !== null)
  if (first === -1) return out
  const smoothed = wilder(dx.slice(first), period)
  for (let i = 0; i < smoothed.length; i++) out[i + first + 1] = smoothed[i]
  return out
}

// The pivot at bar i is confirmed at bar i + len: no bar within len on either side goes beyond it.
function pivot(candles, i, len, field, better) {
  if (i - len < 0 || i + len >= candles.length) return null
  const v = candles[i][field]
  for (let j = i - len; j <= i + len; j++) {
    if (j === i) continue
    const w = candles[j][field]
    // TradingView's pivot needs strictly better than bars to the right, and not worse than those to the left.
    if (j < i ? better(w, v) : !better(v, w)) return null
  }
  return v
}
const gt = (a, b) => a > b
const lt = (a, b) => a < b

/**
 * Runs the structure rules bar by bar. Every value at index i uses only candles 0..i,
 * so nothing repaints.
 */
export function analyse(candles, params = {}) {
  const p = { ...defaults, ...params }
  const n = candles.length
  const len = p.swingLength
  if (!Number.isInteger(len) || len < 1) throw new RangeError(`swingLength must be a positive integer`)
  if (p.fast >= p.slow) throw new RangeError(`fast EMA must be shorter than slow EMA`)

  const closes = candles.map((c) => c.close)
  const emaFast = ema(closes, p.fast)
  const emaSlow = ema(closes, p.slow)
  const atr14 = atr(candles, 14)

  const swings = []
  const breaks = []
  const signals = []
  const swingHigh = empty(n)
  const swingLow = empty(n)
  const trendSeries = empty(n)

  let sh = null // { price, index, broken }
  let sl = null
  let trend = 0
  let leg = null // { from, fromIndex, to, toIndex, breakIndex }
  let trade = null

  for (let i = 0; i < n; i++) {
    const c = candles[i]

    const ph = pivot(candles, i - len, len, `high`, gt)
    if (ph !== null) {
      swings.push({ index: i - len, time: candles[i - len].time, kind: `high`, price: ph, tag: sh ? (ph > sh.price ? `HH` : `LH`) : null, confirmedAt: i })
      sh = { price: ph, index: i - len, broken: false }
    }
    const pl = pivot(candles, i - len, len, `low`, lt)
    if (pl !== null) {
      swings.push({ index: i - len, time: candles[i - len].time, kind: `low`, price: pl, tag: sl ? (pl > sl.price ? `HL` : `LL`) : null, confirmedAt: i })
      sl = { price: pl, index: i - len, broken: false }
    }

    const upSrc = p.breakOn === `wick` ? c.high : c.close
    const dnSrc = p.breakOn === `wick` ? c.low : c.close
    let bull = !!sh && !sh.broken && upSrc > sh.price
    let bear = !!sl && !sl.broken && dnSrc < sl.price
    if (bull && bear) {
      bull = c.close >= c.open
      bear = !bull
    }

    if (bull || bear) {
      const level = bull ? sh : sl
      const kind = (bull ? trend <= 0 : trend >= 0) ? `CHoCH` : `BOS`
      level.broken = true
      breaks.push({ index: i, time: c.time, direction: bull ? `up` : `down`, kind, price: level.price, fromIndex: level.index })

      // The leg starts at the opposite extreme since the broken swing was made.
      const start = Math.max(level.index, i - 499)
      let from = i
      for (let j = start; j <= i; j++) {
        if (bull ? candles[j].low < candles[from].low : candles[j].high > candles[from].high) from = j
      }
      let to = i
      for (let j = from; j <= i; j++) {
        if (bull ? candles[j].high > candles[to].high : candles[j].low < candles[to].low) to = j
      }
      leg = {
        from: bull ? candles[from].low : candles[from].high,
        fromIndex: from,
        to: bull ? candles[to].high : candles[to].low,
        toIndex: to,
        breakIndex: i,
      }
      trend = bull ? 1 : -1

      const fresh = kind === `CHoCH` || p.signalOn === `choch-bos`
      const agrees = !p.emaFilter || (emaFast[i] != null && emaSlow[i] != null && (bull ? emaFast[i] > emaSlow[i] : emaFast[i] < emaSlow[i]))
      if (fresh && agrees && atr14[i] != null) {
        const dir = bull ? 1 : -1
        const entry = c.close
        const stop = leg.from - dir * atr14[i] * p.stopAtr
        const risk = Math.abs(entry - stop)
        trade = {
          index: i,
          time: c.time,
          side: bull ? `buy` : `sell`,
          trigger: kind,
          entry,
          stop,
          targets: p.targets.map((r) => entry + dir * risk * r),
          hit: 0,
          stopped: false,
        }
        signals.push(trade)
      }
    } else if (leg) {
      if (trend === 1 && c.high > leg.to) Object.assign(leg, { to: c.high, toIndex: i })
      if (trend === -1 && c.low < leg.to) Object.assign(leg, { to: c.low, toIndex: i })
    }

    // Follow the open trade from the bar after its signal. The stop is checked first.
    if (trade && trade.index < i && !trade.stopped && trade.hit < trade.targets.length) {
      const dir = trade.side === `buy` ? 1 : -1
      if (dir === 1 ? c.low <= trade.stop : c.high >= trade.stop) trade.stopped = true
      else {
        const best = dir === 1 ? c.high : c.low
        while (trade.hit < trade.targets.length && dir * (best - trade.targets[trade.hit]) >= 0) trade.hit++
      }
    }

    swingHigh[i] = sh && !sh.broken ? sh.price : null
    swingLow[i] = sl && !sl.broken ? sl.price : null
    trendSeries[i] = trend
  }

  const retracement = leg
    ? p.fib.map((ratio) => ({ ratio, price: leg.to + (leg.from - leg.to) * ratio }))
    : []

  return {
    series: { emaFast, emaSlow, swingHigh, swingLow, trend: trendSeries },
    swings,
    breaks,
    signals: signals.map((s) => ({ ...s, status: tradeStatus(s) })),
    leg,
    retracement,
    dashboard: dashboard(candles, trend, signals.at(-1)),
  }
}

export function tradeStatus(t) {
  if (t.stopped) return t.hit > 0 ? `TP${t.hit} then stop` : `Stop hit`
  return t.hit === 0 ? `Open` : `TP${t.hit} hit`
}

/** The line series for the catalog's chart, keyed by `definition.outputs`. */
export function compute(candles, params = {}) {
  const { series } = analyse(candles, params)
  return { emaFast: series.emaFast, emaSlow: series.emaSlow, swingHigh: series.swingHigh, swingLow: series.swingLow }
}

const SESSIONS = [
  { name: `Asia`, tz: `Asia/Tokyo`, from: 9, to: 18 },
  { name: `London`, tz: `Europe/London`, from: 8, to: 17 },
  { name: `New York`, tz: `America/New_York`, from: 8, to: 17 },
]

function localHour(time, tz) {
  const ms = toSeconds(time) * 1000
  const parts = new Intl.DateTimeFormat(`en-GB`, { timeZone: tz, hour: `numeric`, minute: `numeric`, hourCycle: `h23` }).formatToParts(ms)
  const get = (t) => Number(parts.find((x) => x.type === t)?.value)
  return get(`hour`) + get(`minute`) / 60
}

export function session(time) {
  const open = SESSIONS.filter((s) => {
    const h = localHour(time, s.tz)
    return h >= s.from && h < s.to
  }).map((s) => s.name)
  if (open.includes(`London`) && open.includes(`New York`)) return `London / NY`
  return open.includes(`New York`) ? `New York` : open.includes(`London`) ? `London` : open.includes(`Asia`) ? `Asia` : `Off hours`
}

function dashboard(candles, trend, lastSignal) {
  const n = candles.length
  if (n === 0) return null
  const last = candles[n - 1]
  const a = adx(candles, 14)[n - 1]
  let vol = null
  if (n >= 20) {
    let s = 0
    for (let i = n - 20; i < n; i++) s += candles[i].volume ?? 0
    const avg = s / 20
    vol = avg > 0 ? (last.volume ?? 0) / avg : null
  }
  return {
    trend: trend === 1 ? `Bullish` : trend === -1 ? `Bearish` : `Undecided`,
    strength: a == null ? null : a >= 25 ? `Strong` : a >= 20 ? `Moderate` : `Weak`,
    adx: a,
    volume: vol == null ? null : vol >= 1.5 ? `High` : vol <= 0.7 ? `Low` : `Normal`,
    session: session(last.time),
    signal: lastSignal ? { side: lastSignal.side, status: tradeStatus(lastSignal) } : null,
  }
}

const toSeconds = (time) => (typeof time === `number` ? (time < 1e12 ? time : time / 1000) : Date.parse(time) / 1000)

/**
 * Groups lower-timeframe candles into a higher timeframe (in seconds), so the dashboard's
 * 15m and H1 arrows can come from the same feed. Only closed higher-timeframe bars are kept.
 */
export function resample(candles, seconds) {
  const out = []
  for (const c of candles) {
    const bucket = Math.floor(toSeconds(c.time) / seconds) * seconds
    const cur = out.at(-1)
    if (cur && cur.time === bucket) {
      cur.high = Math.max(cur.high, c.high)
      cur.low = Math.min(cur.low, c.low)
      cur.close = c.close
      cur.volume += c.volume ?? 0
    } else out.push({ time: bucket, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? 0 })
  }
  // The newest bucket is still forming unless the last candle reaches its end.
  if (candles.length > 1) {
    const last = toSeconds(candles.at(-1).time)
    const step = last - toSeconds(candles.at(-2).time)
    if (last + step < out.at(-1).time + seconds) out.pop()
  }
  return out
}

/** Structure trend (1 up, -1 down, 0 undecided) of the last closed bar on a higher timeframe. */
export function higherTimeframeTrend(candles, seconds, params = {}) {
  const htf = resample(candles, seconds)
  return htf.length ? analyse(htf, params).series.trend.at(-1) : 0
}
