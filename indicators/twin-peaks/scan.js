// Runs the reference model over recent public candles and prints what it found per market and
// timeframe. A sanity check that the defaults find patterns at a sensible rate. It is not a
// backtest: there are no costs, no spread, and one short recent window.
//
//   node scan.js                      # default symbols and timeframes
//   node scan.js BTCUSDT 4h 1000      # one market
//
// Candles come from Binance's public market-data mirror (no key needed).
import { analyse } from './twin-peaks.js'

const [sym, tf, lim] = process.argv.slice(2)
const symbols = sym ? [sym] : [`BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `PAXGUSDT`, `EURUSDT`]
const frames = tf ? [tf] : [`15m`, `1h`, `4h`, `1d`]
const limit = Number(lim ?? 1000)

const total = {}
for (const s of symbols) {
  for (const f of frames) {
    const url = `https://data-api.binance.vision/api/v3/klines?symbol=${s}&interval=${f}&limit=${limit}`
    const res = await fetch(url)
    if (!res.ok) {
      console.log(`${s} ${f}: HTTP ${res.status}`)
      continue
    }
    const candles = (await res.json()).map((k) => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }))
    const { events } = analyse(candles)
    const count = {}
    for (const e of events) {
      count[e.type] = (count[e.type] ?? 0) + 1
      total[e.type] = (total[e.type] ?? 0) + 1
    }
    const tops = events.filter((e) => e.type === `confirmed` && e.dir === -1).length
    const bottoms = events.filter((e) => e.type === `confirmed` && e.dir === 1).length
    console.log(`${s.padEnd(9)} ${f.padEnd(4)} ${candles.length} bars  developing ${count.potential ?? 0}  confirmed ${count.confirmed ?? 0} (${tops} tops, ${bottoms} bottoms)  retests ${count.retest ?? 0}  invalidated ${count.invalidated ?? 0}  expired ${count.expired ?? 0}`)
  }
}
console.log(`\nAll: ${JSON.stringify(total)}`)
