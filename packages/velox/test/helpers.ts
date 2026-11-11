import type { Candle, Instrument } from '../src/index.ts'

export const T0 = Date.UTC(2026, 9, 12, 8, 0) / 1000 // a Monday, 08:00 UTC
export const STEP = 900

export const instrument = (over: Partial<Instrument> = {}): Instrument => ({
  symbol: `XAUUSD`,
  provider: `test`,
  timeframe: `15m`,
  pricePrecision: 2,
  ...over,
})

/** 15m candles from [open, high, low, close] rows, starting at T0. */
export function bars(rows: readonly (readonly [number, number, number, number])[], start = T0): Candle[] {
  return rows.map(([open, high, low, close], i) => ({ time: start + i * STEP, open, high, low, close }))
}

/** The same market upside down around `pivot`: every demand zone becomes a supply zone and vice versa. */
export function mirror(candles: readonly Candle[], pivot = 200): Candle[] {
  return candles.map((k) => ({ time: k.time, open: pivot - k.open, high: pivot - k.low, low: pivot - k.high, close: pivot - k.close }))
}

/** A deterministic gold-like random walk with occasional impulses, so zones form. */
export function walk(n: number, seed = 7, start = 2400): Candle[] {
  let s = seed >>> 0
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const r2 = (v: number) => Math.round(v * 100) / 100
  const out: Candle[] = []
  let price = start
  for (let i = 0; i < n; i++) {
    const noise = (rand() + rand() + rand() - 1.5) * 2.4
    const impulse = rand() < 0.04 ? (rand() < 0.5 ? -1 : 1) * (6 + rand() * 6) : 0
    const open = r2(price)
    const close = r2(Math.max(1, open + noise + impulse))
    const high = r2(Math.max(open, close) + rand() * 1.5)
    const low = r2(Math.min(open, close) - rand() * 1.5)
    out.push({ time: T0 + i * STEP, open, high, low, close, volume: Math.round(rand() * 1000) })
    price = close
  }
  return out
}

/**
 * Demand scenario: a decline, a one-candle base with its low at 92 and body top at 94, a sharp rally,
 * then returns to the zone that touch it, touch it again, mitigate it and finally invalidate it.
 */
export const DEMAND_ROWS = [
  // warm-up
  [100, 101, 99, 100.2],
  [100.2, 101.1, 99.1, 100],
  [100, 101, 99, 100.3],
  [100.3, 101.2, 99.2, 100.1],
  [100.1, 101, 99, 100],
  [100, 101.1, 99.1, 100.2],
  // decline
  [100.2, 100.5, 97.5, 98],
  [98, 98.5, 95.5, 96],
  [96, 96.5, 93.5, 94],
  // base: the swing low (index 9)
  [94, 94.5, 92, 93],
  // rally
  [93, 96.5, 92.8, 96],
  [96, 99.5, 95.8, 99], // index 11: swing confirmed (2 candles later) and displacement reached
  [99, 101, 98.8, 100.5],
  [100.5, 103.5, 100.2, 103],
  // first return: touches 94 (index 14..16)
  [103, 103.5, 100, 100.5],
  [100.5, 101, 97, 97.5],
  [97.5, 98, 93.8, 95], // index 16: first touch
  [95, 95.5, 93.6, 94.2], // still inside: not another touch
  [94.2, 97, 94, 96.8],
  [96.8, 99, 96.5, 98.5], // left the zone
  [98.5, 98.8, 93.9, 94.5], // index 20: second touch
  [94.5, 94.8, 92.9, 93.2], // index 21: reaches halfway into the zone: mitigated
  [93.2, 93.4, 91, 91.5], // index 22: closes below 92: invalid
] as const

/**
 * Break-of-structure scenario (use with swingLength 2, atrPeriod 5):
 *  - swing high 104.5 at index 6 (confirmed at index 8)
 *  - decline to the low 94 at index 11, a DOWN-close candle (open 96, close 95.2)
 *  - three strong up candles; index 14 closes 105.2, above 104.5: the break
 *  - then: back to the zone (index 19), five candles of one visit, leaves (23), returns (24),
 *    wicks below the low but closes above it (25), closes below it (26), closes back above the
 *    order block (27)
 */
export const BOS_ROWS = [
  [100, 101, 99, 100.2],
  [100.2, 101.1, 99.1, 100],
  [100, 101, 99, 100.3],
  [100.3, 101.2, 99.2, 100.1],
  [100.1, 101, 99, 100],
  [100, 102, 99.8, 101.8],
  [101.8, 104.5, 101.5, 104], // 6: swing high
  [104, 104.2, 102, 102.4],
  [102.4, 102.8, 100, 100.5], // 8: swing high confirmed
  [100.5, 100.8, 97.5, 98],
  [98, 98.5, 95.6, 96],
  [96, 96.4, 94, 95.2], // 11: the low, a down-close candle
  [95.2, 98, 95, 97.8],
  [97.8, 101, 97.6, 100.8],
  [100.8, 105.5, 100.6, 105.2], // 14: closes above 104.5
  [105.2, 106, 104.8, 105.6],
  [105.6, 106.2, 103, 103.4],
  [103.4, 103.8, 100, 100.4],
  [100.4, 100.8, 97.5, 98],
  [98, 98.4, 95, 95.6], // 19: first visit (low 95 reaches the zone's top, 95.2)
  [95.6, 95.9, 94.9, 95.5], // 20–22: still the same visit
  [95.5, 96, 95.1, 95.8],
  [95.8, 97.5, 95.7, 97.2],
  [97.2, 98.5, 97, 98.2], // 23: leaves
  [98.2, 98.4, 95.1, 95.4], // 24: second visit
  [95.4, 95.6, 93.6, 94.3], // 25: wick below 94, close above it
  [94.3, 94.5, 92, 92.5], // 26: closes below 94
  [92.5, 97, 92.3, 96.8], // 27: closes back above the order block's high (96.4)
] as const
