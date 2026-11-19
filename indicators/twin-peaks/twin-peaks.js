// PACT | Twin Peaks — reference model.
//
// The same rules as twin-peaks.pine, as one pure function over candles shaped
// { time, open, high, low, close, volume }, oldest first. It exists so the rules can be tested
// outside TradingView: on hand-built patterns, on real candles, and for repainting (every event is
// decided on the bar it is reported on, using that bar and earlier ones only).
//
// Keep this file and the Pine script in step. When a rule changes in one, change it in the other.

export const defaults = {
  // Swings
  swingLeft: 6, // bars to the left a swing high/low must beat
  swingRight: 3, // bars to the right it must hold; this is the confirmation delay
  // Pattern shape
  tolMode: `atr`, // `atr` or `percent`
  tolAtr: 0.6, // max difference between the two peaks, × ATR
  tolPct: 0.5, // max difference between the two peaks, % of price
  minHeightAtr: 2.0, // min distance from the higher peak to the neckline, × ATR
  minSep: 8, // min bars between the two peaks
  maxSep: 120, // max bars between the two peaks
  // Trend context
  trendFilter: true,
  trendLookback: 60, // bars before the first peak to look for the move into it
  trendMinMove: 1.0, // that move must be at least this × the pattern height
  // Breakout
  breakAtr: 0.1, // close beyond the neckline by at least this × ATR
  bodyFilter: false,
  bodyMin: 0.5, // breakout candle body as a share of its range
  volFilter: false,
  volLen: 20,
  volMult: 1.2,
  lateAtr: 2.5, // a first close further than this × ATR beyond the neckline is too late to chase
  expiryMult: 1.0, // a pattern must break within this × its width (bars) after the second peak…
  expiryMin: 15, // …and never less than this many bars
  // After the breakout
  retestBars: 20,
  retestAtr: 0.3, // how close to the neckline counts as a retest, × ATR
  trackBars: 150, // stop following a signal after this many bars
  stopAtr: 0.25, // stop buffer beyond the highest peak / lowest bottom, × ATR
  atrLen: 14,
  // A double top and a double bottom may not share bars: the one found first stands, and an
  // opposite pattern overlapping it is ignored.
  noOverlap: true,
}

// Wilder's ATR, the same as ta.atr in Pine.
export function atr(candles, len) {
  const out = new Array(candles.length).fill(null)
  let prev = null
  let sum = 0
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const tr = i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close))
    if (i < len) {
      sum += tr
      if (i === len - 1) prev = sum / len
    } else {
      prev = (prev * (len - 1) + tr) / len
    }
    out[i] = prev
  }
  return out
}

function sma(values, len) {
  const out = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= len) sum -= values[i - len]
    if (i >= len - 1) out[i] = sum / len
  }
  return out
}

// A swing high at bar p: higher than each of the `left` bars before it, and not exceeded by any of
// the `right` bars after it. Known only at bar p + right.
function isPivot(candles, p, left, right, dir) {
  if (p - left < 0 || p + right >= candles.length) return false
  const v = dir > 0 ? candles[p].high : candles[p].low
  for (let k = 1; k <= left; k++) {
    const w = dir > 0 ? candles[p - k].high : candles[p - k].low
    if (dir > 0 ? w >= v : w <= v) return false
  }
  for (let k = 1; k <= right; k++) {
    const w = dir > 0 ? candles[p + k].high : candles[p + k].low
    if (dir > 0 ? w > v : w < v) return false
  }
  return true
}

// dir: -1 = double top (bearish), +1 = double bottom (bullish).
// state: developing → confirmed → (target | stopped | ended), or developing → (invalidated | expired | superseded | late)
export function analyse(candles, params = {}) {
  const P = { ...defaults, ...params }
  const n = candles.length
  const atrS = atr(candles, P.atrLen)
  const vols = candles.map((c) => c.volume ?? 0)
  const volAvg = sma(vols, P.volLen)
  let hasVolume = false // becomes true at the first bar with volume, as in the Pine script

  const pivHi = [] // { price, bar }
  const pivLo = []
  const patterns = []
  const events = []
  const active = { [-1]: null, [1]: null } // developing pattern per direction
  const tracked = [] // confirmed patterns still being followed

  const emit = (type, pat, bar, price) => events.push({ type, dir: pat.dir, bar, price, id: pat.id })

  for (let i = 0; i < n; i++) {
    const c = candles[i]
    const a = atrS[i]
    if (vols[i] > 0) hasVolume = true

    // 1. New swings, confirmed `swingRight` bars after they happen. Swings are recorded from the
    // first bar; patterns need ATR, so none are looked for until it exists.
    const p = i - P.swingRight
    for (const dir of [-1, 1]) {
      if (!isPivot(candles, p, P.swingLeft, P.swingRight, dir === -1 ? 1 : -1)) continue
      const price = dir === -1 ? candles[p].high : candles[p].low
      const list = dir === -1 ? pivHi : pivLo
      const pat = a == null ? null : findCandidate(candles, list, price, p, i, a, dir, P)
      list.push({ price, bar: p })
      if (list.length > 12) list.shift()
      if (!pat) continue
      if (P.noOverlap && overlapsOpposite(patterns, pat, i)) continue
      const old = active[dir]
      if (old) {
        old.state = `superseded`
        old.endBar = i
      }
      pat.id = patterns.length
      patterns.push(pat)
      active[dir] = pat
      emit(`potential`, pat, i, pat.neck)
    }

    if (a == null) continue

    // 2. Developing patterns: confirm, invalidate or expire.
    for (const dir of [-1, 1]) {
      const pat = active[dir]
      if (!pat) continue
      const s = dir // +1 bottom, -1 top: price moves in direction s after a break
      const extreme = pat.extreme
      const tol = tolerance(P, a, extreme)
      const beyond = s * (c.close - pat.neck) // > 0 once the close is past the neckline
      if (s * (extreme - c.close) > tol) {
        // Closed beyond the peaks/bottoms by more than the tolerance.
        pat.state = `invalidated`
        pat.endBar = i
        active[dir] = null
        emit(`invalidated`, pat, i, c.close)
        continue
      }
      if (beyond >= P.breakAtr * a && passesFilters(c, i, s, P, hasVolume, volAvg)) {
        active[dir] = null
        pat.breakBar = i
        pat.endBar = i
        if (beyond > P.lateAtr * a) {
          pat.state = `late`
          emit(`late`, pat, i, c.close)
          continue
        }
        pat.state = `confirmed`
        pat.entry = c.close
        pat.stop = extreme - s * P.stopAtr * a
        pat.risk = s * (pat.entry - pat.stop)
        pat.target = pat.neck + s * pat.height
        pat.volRatio = hasVolume && volAvg[i] ? c.volume / volAvg[i] : null
        tracked.push(pat)
        emit(`confirmed`, pat, i, c.close)
        continue
      }
      if (i - pat.b2 > Math.max(P.expiryMin, Math.round(P.expiryMult * (pat.b2 - pat.b1)))) {
        pat.state = `expired`
        pat.endBar = i
        active[dir] = null
        emit(`expired`, pat, i, pat.neck)
      }
    }

    // 3. Confirmed patterns: retest, then stop or target.
    for (let k = tracked.length - 1; k >= 0; k--) {
      const pat = tracked[k]
      if (pat.breakBar === i) continue
      const s = pat.dir
      const adverse = s > 0 ? c.low : c.high
      const favour = s > 0 ? c.high : c.low
      let done = null
      if (s * (pat.stop - adverse) >= 0) done = `stopped`
      else if (s * (favour - pat.target) >= 0) done = `target`
      if (!done && !pat.retested && i - pat.breakBar <= P.retestBars) {
        const touched = s * (adverse - pat.neck) <= P.retestAtr * a
        const held = s * (c.close - pat.neck) > 0
        if (touched && held) {
          pat.retested = true
          pat.retestBar = i
          emit(`retest`, pat, i, c.close)
        }
      }
      if (!done && i - pat.breakBar >= P.trackBars) done = `ended`
      if (done) {
        pat.state = done
        pat.endBar = i
        tracked.splice(k, 1)
        emit(done, pat, i, done === `stopped` ? pat.stop : done === `target` ? pat.target : c.close)
      }
    }
  }
  return { patterns, events }
}

// The bars a pattern occupies: from its first swing to now while developing, or to its breakout.
// Invalidated, expired and superseded patterns no longer count.
function overlapsOpposite(patterns, pat, i) {
  return patterns.some((q) => {
    if (q.dir === pat.dir || [`invalidated`, `expired`, `superseded`].includes(q.state)) return false
    const end = q.state === `developing` ? i : q.breakBar
    return pat.b1 <= end && pat.b2 >= q.b1
  })
}

function tolerance(P, a, price) {
  return P.tolMode === `percent` ? (P.tolPct / 100) * price : P.tolAtr * a
}

function passesFilters(c, i, s, P, hasVolume, volAvg) {
  if (P.bodyFilter) {
    const range = c.high - c.low
    const body = s * (c.close - c.open)
    if (range <= 0 || body / range < P.bodyMin) return false
  }
  if (P.volFilter && hasVolume && volAvg[i] > 0 && c.volume < P.volMult * volAvg[i]) return false
  return true
}

// Looks for an earlier swing that pairs with the new one at bar b2 (known at bar i).
function findCandidate(candles, list, p2, b2, i, a, dir, P) {
  const s = dir // -1 top, +1 bottom
  const tol = tolerance(P, a, p2)
  for (let j = list.length - 1; j >= 0; j--) {
    const { price: p1, bar: b1 } = list[j]
    const sep = b2 - b1
    if (sep < P.minSep) continue
    if (sep > P.maxSep) break
    // An earlier swing beyond the new one by more than the tolerance blocks everything older.
    if (s * (p2 - p1) > tol) break
    if (Math.abs(p2 - p1) > tol) continue
    // Between the two swings: the neckline is the furthest retreat, and nothing may go past the peaks.
    const extreme = s < 0 ? Math.max(p1, p2) : Math.min(p1, p2)
    let neck = s < 0 ? Infinity : -Infinity
    let nb = -1
    let blocked = false
    for (let b = b1 + 1; b < b2; b++) {
      const cb = candles[b]
      if (s < 0 ? cb.low < neck : cb.high > neck) {
        neck = s < 0 ? cb.low : cb.high
        nb = b
      }
      if (s < 0 ? cb.high > extreme : cb.low < extreme) blocked = true
    }
    if (blocked) break
    const height = Math.abs(extreme - neck)
    if (height < P.minHeightAtr * a) continue
    let prior = null
    if (P.trendFilter) {
      const from = Math.max(0, b1 - P.trendLookback)
      if (b1 - from < 5) continue
      let origin = s < 0 ? Infinity : -Infinity
      for (let b = from; b < b1; b++) origin = s < 0 ? Math.min(origin, candles[b].low) : Math.max(origin, candles[b].high)
      prior = Math.abs(p1 - origin)
      if (s < 0 ? origin >= p1 : origin <= p1) continue
      if (prior < P.trendMinMove * height) continue
    }
    return { dir, b1, p1, b2, p2, nb, neck, extreme, height, prior, detectBar: i, atrAtDetect: a, state: `developing`, retested: false }
  }
  return null
}
