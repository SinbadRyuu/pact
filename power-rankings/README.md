# Power Rankings

`vtimpact.com/signals/rankings` ranks every signal provider using the trade history the site already logs. It's also a **Power Rankings** tab next to **Signals** on the signals page. Every number is calculated on the server from closed trades. Nothing is typed in.

- **Top 3 podium.** #1 sits in the middle, raised, with a gold glow, border and crown. #2 is on the left in silver and #3 on the right in bronze. Each card shows the avatar, name, net pips, a mini equity curve, win rate and trades. On phones the cards stack with #1 first.
- **Leaderboard** for everyone else. Every column sorts. On phones the table scrolls sideways with the provider column pinned.
- **Time filters** apply to every stat, the podium and the table: This week, Last week, This month, Last month, This year, Last year, All time, Custom (date range), and **Jump to…** any of the last 26 weeks, the last 24 months, or any year since the first trade. The period is kept in the address (`?period=month:2026-10`), so every view is a shareable link.
- **Live now:** running trades, shown separately and never counted until they close.
- **Provider profile** at `/signals/providers/<slug>`. It shows:
  - all the stats
  - a cumulative pips chart with a crosshair readout (pointer, tap or arrow keys)
  - a month-by-month chart: net pips as columns, with win rate in its own row underneath, plus "Show as a table"
  - live trades
  - the full trade history: paginated on the server, filterable by date range and pair, sortable, and exportable to CSV
- The risk warning on both pages.

## The stats

All calculated from **closed** trades, with `closed_at` inside the period:

| Stat | How |
| --- | --- |
| Rank | Position by **net pips** among providers with at least `RANKINGS_MIN_TRADES` closed trades (default 10). Ties go to win rate, then more trades. Providers under the minimum are listed after the ranked ones as "Needs 10 trades", so one lucky trade can't take #1 or reach the podium. |
| Rank change | Previous period's rank − this period's rank (▲ up, ▼ down, "New" if they weren't ranked before). The previous period is the one just before: last week for this week, last month for this month, and so on. For a custom range it's the same number of days just before. For All time it's the standings as of a week ago. |
| Win rate | wins ÷ total trades. Breakevens count as trades. |
| Wins / losses / breakevens | pips > 0 / < 0 / = 0. Set `RANKINGS_BREAKEVEN_PIPS` (e.g. `0.5`) to count small results as breakeven. |
| Net pips, average pips | sum of `result_pips`; sum ÷ trades |
| Best / worst trade | max / min `result_pips` |
| Max drawdown | largest fall from a peak in cumulative pips, starting from 0 |
| Profit factor | gross pips won ÷ gross pips lost (∞ with wins and no losses) |
| Current streak | from the latest trade back, breakevens skipped: `W4`, `L2` |
| Most traded pairs | top 3 by number of trades |
| Last active | latest `closed_at` in the period |

Weeks run Monday to Sunday, and every boundary is midnight in `RANKINGS_TIMEZONE` (default `Europe/London`), including across the clock changes.

## Data: one mapping file

`migrations/001_rankings_views.sql` creates two views, `ranking_providers` and `ranking_trades`, over your tables. **They're the only place that knows your column names.** The defaults follow the Trade Room `signals` and `channels` tables, with the provider being the channel. Two columns are **assumed**, because the site logs them but this repo doesn't show their names:

- `signals.result_pips`: the result in pips (negative for a loss)
- `signals.closed_at`: when the trade closed

**Before running it, open the file and check those two names and the provider column** against the real schema. If providers are their own table (e.g. `providers` with a `provider_id` on each signal), change the marked lines. Running trades are `status = 'active'`.

**Speed.** The migration adds indexes on the base table: `closed_at` (covering, closed trades only), `(provider, closed_at)`, and open trades. Queries read only four narrow columns, and results are cached for `RANKINGS_CACHE_SECONDS` (default 60). Tested with 200,000 trades: this week's leaderboard took 4ms; all time took 0.6 seconds cold and is then cached. If the history grows into the millions, the next step is a nightly per-provider-per-day summary table. The stats are written so that's a drop-in change.

## Files

| Path | What it is |
| --- | --- |
| `src/RankingsPage.tsx` | `/signals/rankings` |
| `src/ProviderPage.tsx` | `/signals/providers/:slug` |
| `src/Podium.tsx`, `src/Leaderboard.tsx`, `src/TradeHistory.tsx` | The pieces |
| `src/charts.tsx` | Sparkline, cumulative pips and monthly charts (SVG, no library) |
| `src/parts.tsx` | Avatar, rank change, period picker, **`SignalsTabs`** (also for the signals page) |
| `src/rankings.css` | Styles, all `pr-` classes on the site's tokens |
| `shared/periods.ts` | Period keys → exact instants (time zones, ISO weeks, DST) |
| `shared/types.ts` | API shapes |
| `server/stats.ts` | Every stat, as pure functions |
| `server/router.ts` | The API, `(Request) => Response`, at `/api/rankings/*`, with cache and CSV |
| `server/store.ts` | Postgres store (via the views) and an in-memory store |
| `migrations/001_rankings_views.sql` | Views and indexes |
| `supabase/functions/rankings/` | Ready Supabase Edge Function |

## Setup

1. **Database:** check the column names in `migrations/001_rankings_views.sql`, then run it in the Supabase SQL editor. It's safe to run twice.
2. **API (Supabase):**
   ```bash
   cd power-rankings && npm install && npm run build:edge
   cp -r supabase/functions/rankings <your-supabase-project>/supabase/functions/
   supabase functions deploy rankings --no-verify-jwt
   ```
   On another host, `createRankingsApiFromEnv(process.env, sql)` gives a `(Request) => Response` handler. Mount it at `/api/rankings`.
3. **Pages:** copy `src/` and `shared/` into the app (e.g. `src/rankings/` and `src/rankings/shared/`, and fix the `../shared` imports if you move them). Then:
   ```ts
   import { configureRankings } from "./rankings";
   configureRankings({ apiBase: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rankings` });
   ```
   Routes: `/signals/rankings` → `RankingsPage`, and `/signals/providers/:slug` → `ProviderPage` (pass `slug`).
4. **Add the tab to the Signals page.** The Signals page already has pill tabs: Signals, Traders, Record, Rule Health. Add a fifth and render the rankings as its content:
   ```tsx
   import { RANKINGS_TAB, RankingsSection, configureRankings } from "@/rankings";

   const TABS = [...existingTabs, RANKINGS_TAB];                 // { label: "Power Rankings", href: "/signals/rankings" }
   // when the Power Rankings tab is selected (route /signals/rankings):
   <RankingsSection />
   ```
   Also pass the existing tabs once, so the provider profile shows the same tab row:
   ```ts
   configureRankings({ apiBase, signalsTabs: existingTabs });
   ```
   `RankingsSection` lays out its content in panels (POWER RANKINGS, LEADERBOARD, LIVE NOW), styled like GOLD SIGNALS. See `integration-preview/examples/4-power-rankings.png`.

   **Traders and Record:** these existing tabs may already list providers or results. Power Rankings is calculated from the same trades, so check that the numbers agree. If Traders becomes redundant, you could replace it with Power Rankings.

## Env vars (all optional)

| Var | Default | What it does |
| --- | --- | --- |
| `RANKINGS_MIN_TRADES` | `10` | closed trades needed in the period to be ranked or reach the podium |
| `RANKINGS_BREAKEVEN_PIPS` | `0` | results within ± this count as breakeven |
| `RANKINGS_TIMEZONE` | `Europe/London` | where weeks, months and years start |
| `RANKINGS_CACHE_SECONDS` | `60` | how long results are cached |
| `SUPABASE_DB_URL` | provided | database connection (provided on Supabase Edge Functions) |

## Tests: the numbers match a manual calculation

`test/fixtures.ts` has one provider's week (Gold Sniper, week 46 of 2026) laid out trade by trade with the cumulative total, peak and drawdown worked out by hand:

> 10 trades · 5 W · 4 L · 1 BE · win rate 50% · net +135 · avg 13.5 · best +80 · worst −40 · profit factor 240 ÷ 105 = 2.29 · max drawdown 75 · streak W3 · XAUUSD 6, GBPJPY 2, EURUSD 1

The tests check that the stats engine, the leaderboard API (`?period=week:2026-W46` and `?period=last-week`) and the profile API all return exactly those numbers. Trades one second either side of the week, and the running trade, are excluded. The Postgres test runs the real migration and gets the same numbers through the views. It also matches the in-memory results across six periods, and checks the indexes are used with 200,000 trades.

```bash
cd power-rankings && npm install
npm test                                        # 16 tests: manual calculation, ranking rules, periods (DST, week 53), history, CSV
TEST_DATABASE_URL=postgres://… npm test         # + migration, views, index plans, 200k-trade timing (21 tests)
npm run preview                                 # http://localhost:4330/signals/rankings with two years of made-up trades
```
