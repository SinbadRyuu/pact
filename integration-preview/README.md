# Integration preview

Examples of every new page **inside a copy of the vtimpact.com app frame**: the header, the grid background and the bottom bar Home · Chart · Signals · News · Portals · More. Your existing sections (the Automation strategy builder, My indicators, Saved settings, the Momentum list) are copied from the app, so you can see exactly where each new piece goes. Nothing in this folder ships.

## Look at it

- **Pictures:** [`examples/`](examples)
  - `1-automation.png`: /automation with the new tabs: Instant Impact, Sniper Bot, and your Strategies
  - `2-automation-states.png`: subscribed, and payment failed
  - `3-indicators.png`: the new VT IMPACT INDICATORS panel above your existing sections, plus the detail page
  - `4-power-rankings.png`: the 5th tab on Signals: podium, leaderboard, live now
  - `5-provider-profile.png`: one provider's stats, charts and trade history
  - `6-home.png`: Home's GO TO section with the Automation and Power Rankings cards, on desktop and phone
- **Click around:** download [`preview.html`](preview.html) and open it in any browser, on a phone or a computer. It's one self-contained file and works offline. The bar at the top switches pages and who you're viewing as (visitor, member, subscribed, payment failed, cancelled). **Outline new parts** marks what's new with a dashed gold line.

The Indicators and Power Rankings examples run the **real** server code (stats, periods, access rules) in the browser over sample data. Automation uses a stand-in for Stripe. Subscribe → sign in → checkout → success works end to end in the preview.

## How each piece slots into the app

| Existing page | What to add | Where |
| --- | --- | --- |
| `/automation` (strategy builder) | `<AutomationSections strategies={…existing body…} hasStrategies={…} />` | under the page header, in place of the body. Tabs: Instant Impact, Sniper Bot, Strategies. |
| Indicators page | `<IndicatorsSection />` | above **MY INDICATORS** |
| Signals page tabs | `{ label: "Power Rankings", href: "/signals/rankings" }`, and `<RankingsSection />` as that tab's content | at the end of Signals, Traders, Record, Rule Health |
| Home page, GO TO section | two cards: Automation and Power Rankings (`site-navigation/src/goTo.ts`) | before Everything Else |

The new routes are `/automation/subscribe`, `/automation/success`, `/indicators/:slug` and `/signals/providers/:slug`. Each feature's README has the exact code.

## Rebuild

```bash
cd integration-preview && npm install && npm run build    # writes preview.html
```
