# PACT Supply & Demand — Phase 0 audit

Date: 16 October 2026. Status: **audit only. No indicator code has been written.**

## How this audit was done, and its main limit

The source code of the trading website (vtimpact.com) is **not in any repository this session can reach**:

| Repository | What it contains |
|---|---|
| `SinbadRyuu/pact` | A Next.js 14 onboarding and admin app (`apps/web`, Supabase + Prisma, Vercel), an Investment tab page and the VT Structure indicator. **This is not the trading site.** |
| `SinbadRyuu/Pact-Onboarding` | Empty (one initial commit). |

So everything below about the website comes from the **production build that vtimpact.com serves publicly**, plus unauthenticated requests to its API. That is enough to identify the libraries, chart, API shape and data providers. It is **not** enough to give exact file paths, versions from `package.json`, the backend language, the database or the test setup. Each finding is marked:

- **Confirmed**: seen directly in the deployed code or API responses
- **Inferred**: a strong signal, but not proven without source
- **Unknown**: needs the repository

---

## A. Existing stack

| Item | Finding | Confidence |
|---|---|---|
| Framework | React single-page app, built with **Vite** (hashed `assets/*.js` chunks, `__vite__mapDeps`, `modulepreload`) | Confirmed |
| Version | React 19.x (`19.3.0` appears in the bundle) | Inferred: the string could belong to another library |
| TypeScript | You say the site is mostly TypeScript; the build output can't show `tsconfig` settings | Unknown |
| Package manager | Not visible in a build | Unknown |
| Routing | **React Router** (`RouterProvider`, lazy-loaded route chunks per page) | Confirmed |
| State management | **TanStack Query** for server data (`useQuery`, `useMutation`, `refetchInterval`). `localStorage` for small preferences. No Redux or Zustand | Confirmed |
| Validation | **zod**, in a shared `schemas` chunk (probably shared with the server) | Confirmed / shared is inferred |
| Styling | Hand-written CSS with BEM-style classes (`chart__canvas`, `indicator-card__title`) and theme attributes (`data-theme`, `data-scheme`). No Tailwind | Confirmed |
| Testing | Not visible | Unknown |
| Hosting | **Railway** (`server: railway-hikari`). The API is on the same domain at **`/api/v1`** | Confirmed |
| Security headers | Strict CSP: `script-src 'self'`, `connect-src 'self'`, Trusted Types required, the only frame allowed is `tradingview-widget.com` | Confirmed |

## B. Chart

The site has **two different charts**:

1. **TradingView Lightweight Charts** (open source, canvas), bundled into the app. Used on the Markets, Dashboard and Signals pages. **Confirmed.**
   - It already uses Lightweight Charts' **series primitives** (`attachPrimitive`, `paneViews`, `zOrder`, `autoscaleInfo`). These are custom canvas drawings layered on the chart.
   - One existing primitive already draws **zones**: rectangles from a start bar to an end bar with entry, stop and target prices, drawn behind the candles. Others draw markers and labelled events.
   - **Custom supply/demand boxes are technically straightforward**: a new primitive built the same way as the existing zones one.
2. **The TradingView Advanced Chart widget**, an iframe of `OANDA:XAUUSD` at 15m, 1h, 4h or 1D, behind the **"Show live chart"** button. **Confirmed.**
   - We **cannot draw our zones in this iframe.** It is TradingView's page, not ours. Overlaying it would need TradingView's licensed Advanced Charts library (a different product), or a Pine script the user adds themselves.

A small SVG chart is also used for the indicator examples on the Learn pages.

**Recommendation:** keep Lightweight Charts and build the zones as a new primitive. Don't replace the chart, and don't try to put zones in the widget for V1.

## C. Market data

| Item | Finding | Confidence |
|---|---|---|
| Endpoints | `GET /api/v1/markets/instruments`, `/markets/instruments/{symbol}`, `/{symbol}/candles?timeframe=&limit=&end=&currency=`, `/{symbol}/bias`, `/candle-context`. All require sign-in | Confirmed |
| Provider | Two named in the site's own text: **`coinbase-paxg`**, "PAX Gold (PAXG) traded against the US dollar on Coinbase Exchange", used as a **proxy for gold**; and **`synthetic`**, generated demo prices | Confirmed |
| Spot XAUUSD? | **No.** Calculations use PAXG-USD. The live widget shows OANDA:XAUUSD | Confirmed |
| Timeframes in the UI | `15m`, `1h`, `4h`, `1d`. The research data also has `1m` | Confirmed |
| Requested history | The chart asks for `limit: 160` candles | Confirmed |
| Live updates | **Polling** through TanStack Query (every 15s and 60s). No WebSocket or server-sent events found | Confirmed |
| Credentials | The browser only calls its own `/api/v1`. No provider keys in the bundle. Coinbase market data is public anyway | Confirmed for the browser; how the server stores keys is unknown |

## D. Backend

| Item | Finding | Confidence |
|---|---|---|
| API | JSON over HTTPS on the same domain, `/api/v1/...`, structured errors (`{"error":{"code","message","requestId"}}`) | Confirmed |
| Server language and framework | Not visible. Shared zod schemas suggest a TypeScript (Node) server | Inferred |
| Authentication | Cookie sessions (`credentials: same-origin`), CSRF token header, MFA, email verification, device and session management, admin and moderator roles | Confirmed |
| Database | There must be one (accounts, saved indicator settings, Pine scripts, journals, alerts). Which one is unknown | Inferred / unknown |
| Server-side calculation today | The **signals** are computed on the server, with SHA-256 hashes of the candle datasets they were tested on. That is the reproducibility pattern this project needs | Confirmed |
| Client-side calculation today | The **built-in indicators** (SMA, RSI, Price pressure and so on) are computed **in the browser**. Their maths ships in the public bundle | Confirmed |

**Where proprietary calculations should live:** on the server, next to the candle endpoints. The API already serves candles and server-computed signals behind sign-in, so a supply/demand endpoint fits the existing pattern. **Server-side calculation is practical.**

## E. Integration plan

*File paths are provisional until we see the repository. The structure is what matters.*

### New: the engine, a pure TypeScript package (no React, no DOM, no network)

```
sd-engine/
  src/
    types.ts          Candle, SupplyDemandZone, StructureEvent, EngineSettings, EngineState
    version.ts        ENGINE_VERSION = "0.1.0"
    candles.ts        normalise(): sort, drop duplicates, check OHLC, UTC, flag gaps
    aggregate.ts      15m → 1h → 4h using closed candles only, plus a separate "forming" candle
    swings.ts         confirmed swing highs/lows with originTime + confirmedAt
    displacement.ts   ATR-relative departure measurement
    zones.ts          zone creation (base selection, configurable width)
    lifecycle.ts      fresh → tested → mitigated → invalid, touch events
    score.ts          explainable 0–100 score, each factor listed
    structure.ts      HH/HL/LH/LL, BOS, CHoCH (Phase 6)
    engine.ts         incremental: createEngine(settings).push(closedCandle) → state
  test/
    replay.test.ts    bar-by-bar replay versus full-history run (anti-repaint)
    htf-lookahead.test.ts
    …
```

The site already uses zod schemas shared between browser and server, so the **response types** (not the algorithm) go into those shared schemas.

### New: server

- `GET /api/v1/markets/instruments/{symbol}/supply-demand?timeframe=15m&htf=1h,4h` (signed in)
- Reads closed candles from the same candle store the chart uses. Runs the engine. Returns **only the drawable state** (zones, statuses, scores, the score breakdown, `engineVersion`, provider, `asOf`).
- Cache key: `provider : symbol : timeframe : settingsHash : engineVersion`. Recalculate only when a new candle **closes**.

### New: browser

- `SupplyDemandPrimitive`: a Lightweight Charts series primitive, modelled on the existing zones primitive. It draws boxes, the label ("1H DEMAND · 89") and opacity by score, behind the candles.
- `useSupplyDemand(symbol, timeframe)`: a TanStack Query hook, polling on the same schedule as the candles.
- A small controls panel: supply/demand, timeframes, minimum score, status filter, "nearest N above/below".

### To modify (once we can see them)

- The price chart component that attaches the existing zones primitive
- The markets (gold) page, for the toggle and controls
- The API router, for the new endpoint
- The shared schemas, for the response type
- The indicator catalog and Learn page, for a "PACT Supply & Demand" entry with an explanation in the site's usual cautious wording

### V1: server-side or client-side?

**Server-side.** It keeps the algorithm out of the browser bundle. Unlike the current indicators, it computes once per closed candle for all users (better on mobile), and ties every result to one canonical feed and `engineVersion`. The engine stays a pure package, so tests and replay run in Node without the server.

## F. Risks and unknowns

1. **No access to the website source.** This is the blocker. Everything in E is provisional until the repository is added to this session.
2. **The data feed is PAXG on Coinbase, not spot XAUUSD.**
   - PAXG **trades through the weekend**. Spot gold doesn't. Weekend candles will create swings and zones that don't exist on an XAUUSD chart.
   - PAXG carries a small, varying premium or discount to spot. Zone prices won't match OANDA's.
   - Its volume is crypto-exchange volume, not gold volume.
   - **A canonical feed must be chosen before Phase 3**, or zones will be recalculated (and change) later.
3. **Two charts, two feeds.** Members on the "live chart" see OANDA:XAUUSD in an iframe with **no zones**, while zones sit on the PAXG chart. Mixing them up will confuse people.
4. **The current indicator pattern is client-side.** Copying it would publish the algorithm.
5. **History depth.** The chart asks for 160 candles. Zone detection and higher-timeframe confirmation need more, for example 1,000+ × 15m and enough 4h bars. We need to check the candle store and its API limits.
6. **Candle alignment.** We need to know how the server builds 1h, 4h and 1D: UTC boundaries, or the broker's 17:00 New York close. 4H and daily zones depend on it.
7. **Polling, not push.** Fine for closed-candle zones in V1. Revisit in Phase 11.
8. **Wording and compliance.** The site is very careful ("describes, does not predict", "not financial advice", en-GB). "Strength" and "confidence" scores need the same care in how they are worded and explained.
9. **Branding.** The site is VT Impact. The product is "PACT Supply & Demand". Decide how the name appears.
10. **Unknowns:** backend framework, database, test runner, CI and deployment pipeline, and whether the candle store keeps history or fetches on demand.
11. **Repository confusion.** `SinbadRyuu/pact` holds a different app (onboarding/admin). The engine shouldn't go there unless you decide that repository is where shared PACT code lives.

## G. Smallest sensible first coding step

Phase 1 (showing XAUUSD candles) **already exists** on the Lightweight Charts gold page, although on PAXG data. Once the feed decision is made and we have repository access, the smallest first step is:

> **Create the pure engine package with `normalise()` and confirmed swing detection, plus the replay test harness, and no UI.**
>
> - Every swing records `originTime` and `confirmedAt` (the bar where it became known).
> - The replay test feeds candles one at a time, saves the state after each, and checks that nothing marked confirmed at step *n* changes at any later step, and that bar-by-bar results equal a full-history run.

Then Phase 3 adds one demand zone and one supply zone on top, and the same harness proves they don't repaint.

## Decisions needed before Phase 1/2

1. **Repository access** to the VT Impact website source (owner/name).
2. **Canonical feed:** keep PAXG/Coinbase, or buy a real XAUUSD feed (for example OANDA)? This decides how weekends are handled.
3. **Approve server-side calculation** for V1.
4. **Branding:** "PACT Supply & Demand" on VT Impact, or VT Impact branding?
