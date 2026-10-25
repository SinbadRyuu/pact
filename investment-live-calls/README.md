# Live calls: the weekly lineup

The new `/investment/calls` page for Impact Investment on vtimpact.com, built to the "weekly lineup" design:

- **Banner** with "Impact Investment / Live sessions", "The weekly lineup.", the month and date range, week switching (‹ This week ›) and **+ Add call**.
- **Monday to Sunday day strip.** Today is outlined, days with calls get a pink dot, and tapping a day opens it in the agenda.
- **Up next** card: the live or next call this week with its time, host, countdown and join button, or "A quiet week." when there's nothing coming up.
- **Calls this week** and **Live now** counts, and the viewer's **time zone** (Europe/London for UK members).
- **Week agenda:** one expandable row per day with its call count. Each call shows time (plus UK time for members abroad), status, host, description, the join link from 15 minutes before, and Add to calendar / Add every week.
- **Add call** (staff only): the same fields, rules and endpoint as Enterprise › Admin › Investment › Live calls. A "+ Add a call on Tuesday" link sits inside each open day as well.

It uses the existing endpoints, so nothing on the server has to change:

| What | Endpoint |
| --- | --- |
| Load calls | `GET /api/v1/investment/calls` (sends `from`/`to` for the week; see "Server" below) |
| Add call | `POST /api/v1/admin/investment/calls`, needs `admin.investment.manage` |

## Files

| File | What it is |
| --- | --- |
| `src/LiveCallsPage.tsx` | The page |
| `src/AddCallDialog.tsx` | The Add call dialog and its validation |
| `src/week.ts` | Week and time-zone maths (Monday starts, clock changes, labels, weekly projection) |
| `src/ics.ts` | Add to calendar files, single calls and weekly series |
| `src/icons.tsx` | The page's line icons |
| `src/adapters.ts` | The one place the page connects to the app (API client, permission, clock, title, toast) |
| `src/live-calls.css` | Styles, all scoped under `lc-`, built on the site's tokens |
| `src/assets/` | The purple candlestick banner and the desk image behind Up next |
| `src/week.test.ts` | Tests for the date maths and calendar files |
| `preview/` | A working preview inside a copy of the portal shell, with a mock server |

## Install in the vtimpact.com app

1. **Copy `src/`** into the app, for example to `src/investment/live-calls/`.

2. **Connect it once at start-up**, in the investment entry file (the one that calls `createRoot` and holds the `/investment` routes), before rendering:

   ```ts
   import { configureLiveCalls } from "./live-calls/adapters";

   configureLiveCalls({
     get: (path, opts) => api.get(path, opts),               // the shared API client every page uses
     post: (path, body, opts) => api.post(path, body, opts),
     useCanManage: () => useCan("admin.investment.manage"),  // the hook the admin menu uses for this permission
     useNow,                                                 // the shared 1-second clock hook (optional)
     usePageTitle,                                           // the hook pages call with their title (optional)
     notify: (message) => toast.success(message),            // optional
   });
   ```

   The names on the right are whatever those modules are called in the source. The API client must throw errors with `message` and `fields`, which the existing one already does.

3. **Swap the route.** In the `/investment` route table, change the `calls` entry to the new page:

   ```ts
   import { LiveCallsPage } from "./live-calls/LiveCallsPage";
   // …
   { path: "calls", Component: LiveCallsPage },
   ```

   The old calls page component, and its `.inv-call` / `.inv-days` styles, can then be removed if nothing else uses them. The overview's "Next live call" card keeps working, and it refreshes when a call is added because both share the `["investment", "calls"]` query key.

4. **Run the tests:** `npx tsx --test src/investment/live-calls/week.test.ts`

No new packages are needed: it uses React and TanStack Query, which the app already has. There are no inline scripts or inline styles, so the current Content Security Policy is fine.

## Server

The page asks for one week at a time with `?from=…&to=…` (ISO instants, Monday 00:00 to the next Monday 00:00 in the viewer's zone).

- **If the endpoint uses `from`/`to`**, every week is exact, including one-off calls months ahead.
- **If it ignores them** (it currently returns a fixed window), the page still works: it shows what's in the window, and for weeks after it, carries weekly calls forward at their usual UK time with a note that the team confirms them nearer the day. One-off calls beyond the window appear once they come into it.

Supporting `from`/`to` is a small change on the server and is the better long-term setup.

## Behaviour notes

- **Who sees Add call:** only people with `admin.investment.manage`. Members see the same page without the button, since they can't create calls.
- **Time zones:** weeks run Monday to Sunday in the viewer's zone. Calls are entered in UK time, as in the admin form. Weekly calls keep their UK time across the clock changes (tested on the 25 October change).
- **Live updates:** the page refetches every minute, and the Live now count, countdowns and states follow the shared clock.
- **Accessibility:** real buttons throughout, the selected day and today are announced, rows are proper disclosure buttons, week changes are read out, the dialog traps focus and closes on Escape, and motion is off under reduced-motion settings.

## Preview

```bash
cd investment-live-calls
npm i -D esbuild react react-dom @tanstack/react-query
npx esbuild preview/main.tsx --bundle --format=esm --jsx=automatic --loader:.jpg=file \
  --asset-names=[name] --public-path=dist --outdir=preview/dist
npx serve preview   # then open the address it prints
```

URL options: `?staff=0` shows the member view, `?now=2026-10-24T10:30:00Z` sets the clock (that one shows a call live), and `?window=1` mimics a server that ignores `from`/`to`.
