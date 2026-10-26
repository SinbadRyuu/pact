# Schedule button: the weekly lineup, one tap from the landing page

Puts the live call schedule on the main vtimpact.com site, so people don't have to go into the Impact Investment portal and then Live calls to find it.

- **A "This week's schedule" card on the landing page**, between the Impact Enterprise card and the portal tiles, with a cyan **View schedule →** button. It's above the fold on a phone.
- **A stand-alone page at `vtimpact.com/schedule`**: the same weekly lineup as `/investment/calls` (week switching, day strip, up next, agenda, Add to calendar, and Add call for staff), with a slim header (logo, **← All portals**, **Impact Investment**) instead of the investment sidebar.
- **Short addresses** `vtimpact.com/calls`, `/live-calls` and `/lineup` open it too, so it's easy to put in a bio or a message.

`/investment/calls` stays exactly as it is. Both pages read the same calls, so a call added on one shows on the other.

## Files

| File | What it is |
| --- | --- |
| `src/ScheduleButton.tsx` | The landing page card and button |
| `src/SchedulePage.tsx` | The `/schedule` page: sign-in check, header, the weekly lineup, footer |
| `src/schedule.css` | Styles for both, all `ss-` classes on the site's own tokens |
| `src/adapters.ts` | The one place the page connects to the app (session hook, logo, risk line) |
| `src/live-calls.ts` | Points at the Live calls module (`investment-live-calls/`) |
| `src/paths.ts` | `/schedule` and the short addresses |
| `setup.example.ts` | The start-up lines for the main entry file |
| `preview/` | A working copy of the landing page and `/schedule` over a mock server |

## Install in the vtimpact.com app

This needs the Live calls module from [`investment-live-calls/`](../investment-live-calls/README.md) in the app. If `/investment/calls` already shows the weekly lineup, it's there.

1. **Copy `src/`** into the app as `src/schedule/`.

2. **Point the bridge at the Live calls module.** In `src/schedule/live-calls.ts`, change the three paths to where that module lives in the app, for example:

   ```ts
   export { LiveCallsPage } from "../investment/live-calls/LiveCallsPage";
   export { configureLiveCalls } from "../investment/live-calls/adapters";
   export { Icon } from "../investment/live-calls/icons";
   ```

3. **Connect it at start-up.** In the main site's entry file (the one with the landing page, `/app` and sign-in routes), add the lines from `setup.example.ts` before `createRoot(...)`. They're the same hookups the investment entry already passes: the API client, the `admin.investment.manage` permission hook, the session hook, the logo and the risk line.

4. **Add the route and short addresses.** In the same file's route list, at the top level (next to the existing short addresses like `login` and `faq`):

   ```ts
   import { redirect } from "react-router-dom";
   import { SCHEDULE_ALIASES } from "./schedule/paths";

   { path: "schedule", lazy: () => import("./schedule/SchedulePage") },
   ...SCHEDULE_ALIASES.map((path) => ({
     path,
     loader: ({ request }: { request: Request }) => redirect(`/schedule${new URL(request.url).search}`),
   })),
   ```

   Put it at the top level, not inside the landing page's layout, so it gets its own page without the candle backdrop. If the app wraps `lazy` in a helper, use that the same way as the other pages. Or simply add `calls`, `live-calls` and `lineup` to the existing short-address list with `/schedule` as the target.

5. **Add the button to the landing page.** In the landing page component (`PortalPage`):

   ```tsx
   import { ScheduleButton } from "../schedule/ScheduleButton";

   // …right after the Impact Enterprise </section>, before <div className="portal__more">:
   <ScheduleButton />
   ```

6. **Build and check** the landing page at phone width (390px) and on desktop.

No new packages, no server changes and no database changes. Everything is in files, so the current Content Security Policy is fine.

## How it behaves

- **Everyone sees the button**, signed in or not.
- **Signed out:** `/schedule` sends people to sign-in with `?next=/schedule`, so they land back on the schedule afterwards. Two-step sign-in goes to `/sign-in/verify` the same way.
- **Members** see the schedule. **Staff** with `admin.investment.manage` also see **+ Add call**.
- **Times** are in the viewer's time zone, with UK time alongside for members abroad, the same as `/investment/calls`.
- **Accessibility:** the button is a real link announced as "View schedule, this week's live calls", the page has a skip link and a labelled nav, and the card's entrance animation is off under reduced motion.

## Preview

```bash
cd site-schedule/preview
npm i --no-save esbuild react react-dom react-router-dom @tanstack/react-query
node build-preview.mjs   # writes dist/index.html, open it in a browser
```

The bar at the bottom switches between the landing page and `/schedule`, signed in and signed out (signed out shows a stand-in sign-in page that sends you back), and staff and member views. The calls are sample data placed in the current week.
