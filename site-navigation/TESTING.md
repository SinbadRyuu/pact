# Test report

Run on 17 Nov 2026 with Node 22, PostgreSQL 16 and Deno 2.5 (to run the Supabase Edge Functions locally).

## Summary

| Area | Result |
| --- | --- |
| Stripe flow, webhooks, gating (`automation/`) | ✅ 25 tests + 1 Postgres test pass |
| Indicators (`indicators-page/`) | ✅ 11 tests + 2 Postgres tests pass |
| Power Rankings (`power-rankings/`) | ✅ 16 tests + 5 Postgres tests pass |
| Navigation, Home GO TO cards and SEO (`site-navigation/`) | ✅ 10 tests pass |
| Edge Functions under Deno, against Postgres | ✅ all three serve requests; a signed webhook is stored and a tampered one is rejected |
| Phone (390px) and desktop (1280px) screenshots | ✅ no sideways scrolling on any page; layout issues found during the review were fixed |
| **Stripe end-to-end against real Stripe test mode** | ⚠️ **Not run here.** The script is ready (`npm run stripe:e2e`), but this environment has no Stripe keys. It takes about 2 minutes with your `sk_test_` key; see below. |

## Stripe flow and gating

`automation/test/billing.test.ts` runs the real API code against an in-memory Stripe stand-in. Webhook signatures are generated and checked with the **real Stripe SDK**. It covers:

- **Signed out:** subscribe returns "sign in first" and comes back to `/automation/subscribe`. **Signed in:** a subscription-mode Checkout Session with the price from `STRIPE_PRICE_INSTANT_IMPACT` and the user id attached. The Stripe customer is reused, and a second subscription is refused.
- **Webhooks:** a bad or missing signature returns 400 and changes nothing. A duplicate delivery is ignored. A late `customer.subscription.updated` can't overwrite a newer state.
- **Gating (server side):**
  - Signed-out and unsubscribed people get no signal data and no Telegram link.
  - **A failed payment locks the feed immediately; a successful retry unlocks it.** Both the old and new Stripe invoice formats are covered.
  - **Cancelling at period end keeps access until that date, then locks.**
  - **`customer.subscription.deleted` locks immediately.**
  - The grace-days option works.
- **Success page:** confirms the payment straight from Stripe, so access is instant. Someone else's checkout session can't be claimed.

**To run the real test-mode check:**
```bash
cd automation && npm install
STRIPE_SECRET_KEY=sk_test_… STRIPE_PRICE_INSTANT_IMPACT=price_… npm run stripe:e2e
```
It creates a Checkout Session and subscribes a test customer with Stripe's test card. Then it uses a Stripe test clock to make a real renewal fail, and cancels. Stripe's real events go to the webhook handler, and the feed lock is checked at every step. Expected ending: `E2E PASSED`. For a manual click-through, follow "Manual click-through in test mode" in `automation/README.md`.

## Ranking numbers vs a manual calculation

`power-rankings/test/fixtures.ts` lays out one provider's week (Gold Sniper, Mon 9 – Sun 15 Nov 2026) trade by trade, with the running total, peak and drawdown worked out by hand:

| | Manual | API |
| --- | --- | --- |
| Trades / W / L / BE | 10 / 5 / 4 / 1 | 10 / 5 / 4 / 1 |
| Win rate | 5 ÷ 10 = 50% | 50% |
| Net pips | 45 − 30 + 60 + 0 − 25 − 40 − 10 + 80 + 35 + 20 = **+135** | +135 |
| Average | 135 ÷ 10 = 13.5 | 13.5 |
| Best / worst | +80 / −40 | +80 / −40 |
| Profit factor | 240 ÷ 105 = 2.29 | 2.29 |
| Max drawdown | peak 75 → low 0 = **75** | 75 |
| Streak | +20, +35, +80, then −10 → **W3** | W3 |
| Top pairs | XAUUSD 6, GBPJPY 2, EURUSD 1 | same |

The API matches for `?period=week:2026-W46`, `?period=last-week` and the provider profile. It also matches on Postgres through the migration's views. A trade one second before Monday, one at exactly Monday 00:00 of the next week, and a running trade are all correctly left out.

Also covered:
- **Ranking rules:** a 1-trade provider with the most pips stays unranked and off the podium. Rank changes come out as ▲1, ▼1 and "New".
- **Periods:** London midnight across the October clock change, ISO week 53, reversed and invalid custom dates.
- **Trade history:** pagination, pair and date filters, sorting with running trades last, and CSV escaping.
- **Speed:** with 200,000 trades the queries use the indexes. This week's leaderboard took 4ms; all time took 0.6s on first load, then comes from the cache.

## Checked in a real browser (Playwright, phone size)

- **Cumulative pips chart:** the readout works with the mouse, the arrow keys and a tap, and shows the real trade number ("Trade 254 of 571").
- **Monthly chart:** opens on the latest months and has a hover readout.
- **Trade history:** CSV export downloads; the pair filter and sorting work.
- **Rankings page:** "Jump to → 2025" and a custom range work; table columns sort.

## Not tested here (needs your accounts or the app itself)

- Real Stripe test mode: run `npm run stripe:e2e` with your key.
- The VT Markets deep link on a real phone: needs `SNIPER_BOT_APP_LINK` / `SNIPER_BOT_COPY_LINK`. The app-first, web-fallback logic is unit tested.
- Inside the vtimpact.com app itself: its source isn't in this repo. Each feature's README lists the exact install steps. After installing, check `/automation`, `/indicators`, `/signals/rankings` and one provider page at phone width.
- The mapping in `power-rankings/migrations/001_rankings_views.sql` against the real `signals` columns (`result_pips`, `closed_at`).

## Run everything

```bash
export TEST_DATABASE_URL=postgres://postgres@localhost:5432/scratch   # optional: a THROWAWAY Postgres for the database tests
for d in automation indicators-page power-rankings site-navigation; do (cd $d && npm install --silent && npm test); done
```
