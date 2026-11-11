# Velox V1: plan

Decisions (16 October 2026):

1. **Name:** Velox V1.
2. **Data:** PAXG (Coinbase) for now. **TradingView charts are coming to VT Impact soon**, and Velox must work on them.
3. **Calculation:** on the server (approved).
4. **Keep the full feature set:** Fibonacci, dashboard and signals as well as supply and demand. Every **buy and sell signal carries a stop loss**, and **every take profit is 1:1** with it (entry 4000, SL 3990 → TP 4010).
5. **Include fair value gaps (FVGs). Exclude EMAs** (16 October 2026).
6. **Demand zones are the wick of the low that broke the high; order blocks are the last opposite-close candle, full wick range; swing length 10; buy/sell signals and Fibonacci removed** (19 October 2026). This replaces decision 4's signals and Fibonacci. See `zones-and-order-blocks.md`.
7. **Entries return with one take profit of 100 pips ($10 on gold) at 1:1**, tuned for XAUUSD on 15m, with an on-chart backtest table (19 October 2026). In the TradingView script; not yet in the engine.

## Architecture

```
candles (PAXG today, TradingView's feed later)
   ↓  normalise()                      @pact/velox: deterministic, versioned, tested
engine: swings → breaks (BOS/CHoCH) → demand/supply zones + order blocks → lifecycle/breakers → score; FVGs alongside
   ↓  VeloxState (JSON)
server: GET /api/v1/markets/instruments/{symbol}/velox?timeframe=15m&htf=1h,4h   (signed in, cached per closed candle)
   ↓
renderer adapter ─┬─ Lightweight Charts primitive   (today's VT Impact chart)
                  └─ TradingView Charting Library    (when VT Impact moves to TradingView)
```

The engine never knows which chart draws it. Moving to TradingView means adding a second **adapter**. The engine and the API stay the same.

### Getting Velox onto TradingView inside VT Impact

What VT Impact embeds today is TradingView's **widget** (an iframe of TradingView's own page). **Nothing of ours can be drawn on a widget.** There are two ways onto TradingView charts:

| Route | How Velox is drawn | Algorithm stays private? | Notes |
|---|---|---|---|
| **TradingView Advanced Charts / Trading Platform library** (self-hosted in VT Impact) | The adapter draws each zone as a rectangle and each signal's entry, SL and TP lines through the chart's drawing API, from the server's `VeloxState` | **Yes**, calculated on our server | Licence from TradingView (free for public-facing sites, on application). Needs a datafeed, which our candle API can serve. **Recommended.** |
| **Pine Script** on tradingview.com | A Pine port of the engine | Only if published as **protected / invite-only** | Results would differ slightly from the website, because it runs on TradingView's feed with a separate implementation |

Before choosing TradingView's feed, note that **zones depend on the feed**. Changing provider (PAXG → OANDA:XAUUSD, for example) changes swings, zones and signals. Every result records its `provider` for this reason.

## Build order and status

| Phase | What | Status |
|---|---|---|
| 0 | Audit | Done: `docs/supply-demand/phase-0-audit.md` |
| 1 | XAUUSD candles on the site | Already on the site (PAXG) |
| 2 | Confirmed swings | **Done in the engine** |
| 3 | One trustworthy supply zone and one demand zone | **Done in the engine**, proven not to repaint |
| 4 | Lifecycle: fresh / tested / mitigated / invalid, touch events | **Done in the engine** |
| 5 | Explainable 0–100 score | **Done** (weights not yet calibrated) |
| + | Signals with SL and 1:1 TP | Built, then **removed** (decision 6) |
| + | Fair value gaps: detection, fill tracking, zone confluence | **Done in the engine** (v0.2.0) |
| 6 | Market structure: BOS, CHoCH | **Done in the engine** (v0.3.0): zones come from breaks |
| 7 | Order blocks, breaker blocks, zone confluence | **Done in the engine** (v0.3.0) |
| 8 | Multi-timeframe 15m / 1h / 4h, confluence in the score | Aggregation done and tested; shown in the TradingView script; scoring to do |
| 9 | Rendering and chart controls | **Needs the website source** |
| 10 | Historical replay / anti-repaint | Harness done; extend with every phase |
| 11 | Live updates | Needs the website source |
| 12 | Claude explanations | Last |
| + | Sessions, zone-entry alerts | In the TradingView script. **No EMAs, no Fibonacci.** Dashboard not planned. |

## Blocked on

**The VT Impact website source.** It is not in `SinbadRyuu/pact` or `SinbadRyuu/Pact-Onboarding`. Phases 9 and 11 (drawing on the chart and live updates) need the repository that deploys vtimpact.com, on Railway.
