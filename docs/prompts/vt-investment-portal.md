# Prompt: VT Investment as its own portal on vtimpact.com

Paste everything below the line into a new Claude session, and attach the files listed under "What I'm attaching".

---

Turn the VT Investment section into its own portal on https://www.vtimpact.com/, styled exactly like the existing portals on the landing page. Write the code; don't just describe it.

## What I'm attaching
- `investment.tsx`, `investment.index.tsx`, `investment.schedule.tsx`, `investment.module.$slug.tsx`, `investment.explore.$slug.tsx`: the current Investment routes.
- Screenshots of the vtimpact.com landing page (the portal cards).
- Two images: the night-time desk with tablet chart and coins (hero / cover), and the purple-blue candlestick wave (banner).
- If I have them, also: the landing route (`src/routes/index.tsx`), the Impact Affiliates portal route(s), `src/styles.css` (or the Tailwind config), `src/routes/__root.tsx`, `src/routes/_authenticated.tsx`, the login/signup route, and `src/components/InvestmentPortal.tsx`.

## Step 1: get the real codebase before writing anything
The vtimpact.com app is not in `SinbadRyuu/pact`. First run `list_repos` and look for the vtimpact / Lovable repo. If it's there, `add_repo` it and work in it directly on a branch. If it isn't, use the attached files. If the landing route, the Affiliates portal route or the theme file (`styles.css` / Tailwind config) is missing, ask me for exactly those files before writing code, because the job is to match them exactly. Never guess at theme tokens, fonts or the portal card markup.

## What the app is (from the attached files)
- TanStack Start with file routes in `src/routes`. Signed-in pages live under `_authenticated/`, and `Route.useRouteContext()` gives `{ user }`.
- TanStack Query, Supabase (`@/integrations/supabase/client`), shadcn/ui (`@/components/ui/*`), lucide-react, sonner, date-fns.
- Theme tokens already in use: `bg-background`, `bg-card`, `border-border`, `bg-secondary`, `text-primary`, `text-muted-foreground`, `bg-brand`, `shadow-brand`, `text-gold`, `font-display`. Use these tokens, not hard-coded hex values.
- Components Investment already uses: `InvestmentPortal` (the splash, takes `email` and `onEnter`), `Calculators`, `EnquiryForm`, `InvestmentMedia`, `MemberSchedule`, `ContentPage`, and `@/lib/schedule` (`callOccurrence`, `callState`, `weekStart`, `Occurrence`). Assets: `@/assets/investment-cover.jpg`, `@/assets/schedule-banner.jpg`.
- Supabase tables: `disclaimer_acknowledgements (user_id, version)`, `content_pages (slug, kind: site|module|category, title, summary, image_url, video_url, sort)`, `schedule_events (audience = 'client', starts_at, …)`.
- Today `/investment` sits inside the main member area: splash, then the disclaimer gate (`DISCLAIMER_VERSION = "v1"`), then a sidebar layout. "Main menu" goes to `/home`.

## The landing-page look to copy (from the screenshots)
- Dark navy page with a faint cyan candlestick / line-chart graphic behind the cards.
- IMPACT logo at the top (a purple-to-pink-to-blue "V" chevron and a widely letter-spaced "IMPACT" wordmark), with the tagline under it.
- Portal cards stacked vertically, mobile-first. Each card is very rounded, has a thin low-opacity cyan border and a dark translucent fill, and contains (centred):
  - a cyan lucide icon (Travel uses `Plane`, Affiliates uses a users/check icon),
  - the title in the display font ("Impact Travel", "Impact Affiliates"),
  - one muted line of copy,
  - a pill button. The main portal's button is solid cyan with a glow and the text "Enter portal →", plus "New here? Create an account" under it. Live secondary portals use an outlined cyan pill "Enter portal →". Coming-soon portals use a dimmed, disabled outlined pill with no arrow.

## What to build
1. **Landing card.** Add an "Impact Investment" card to the landing page. Copy the Affiliates card's markup and classes exactly. Use the `TrendingUp` (or `LineChart`) icon, the copy "Learn, plan and grow your wealth, all in one place.", and the button "Enter portal →" linking to `/investment`. Put it after Impact Affiliates unless the existing order suggests somewhere else.
2. **Its own portal entry.** Make `/investment` work the way the Affiliates portal does:
   - signed out: go to the existing login or sign-up flow with a redirect back to `/investment`,
   - signed in: show the `InvestmentPortal` splash, restyled to match the landing (IMPACT logo, "VT Investment" in the display font, a solid cyan glowing "Enter portal →" pill, and the night-desk image behind a navy gradient).
   Remember that the user has entered for the rest of the session (`sessionStorage`), so the splash doesn't come back every time they navigate inside the portal.
3. **Its own shell.** Investment gets its own layout instead of nesting inside the main `/home` chrome. That means the sidebar (Overview, Schedule, Education modules, Explore categories, Tax & Accounting), a mobile top bar with a sheet menu, and a "← All portals" link back to the landing page in place of "Main menu → /home". Keep the disclaimer gate exactly as it is (same table, same version) and restyle the card to match the portal look.
4. **Keep everything else.** Keep every existing page and feature: the dashboard (hero, next live call, quick nav, journey with progress, calculators, markets grid, support/enquiry), the schedule, module pages and explore pages. Keep the same Supabase queries and query keys. Keep the URLs `/investment`, `/investment/schedule`, `/investment/module/$slug` and `/investment/explore/$slug`. If moving the routes out of `_authenticated/` would change these URLs, keep the URLs and do the auth check in the new layout's `beforeLoad` instead.
5. **Images.** Save the uploaded images as `src/assets/investment-cover.jpg` (the desk) and `src/assets/schedule-banner.jpg` (the wave). Replace the existing files only if I say so; otherwise use new names like `investment-portal-hero.jpg`.
6. **Head meta.** Keep the existing title and OG meta pattern ("… — VT Impact").

## Rules
- Mobile first. The screenshots are from an iPhone, so check at 390px wide with no horizontal scroll, and the cards and pills should match the landing's spacing.
- Don't add libraries or new database tables unless they're truly needed. If a migration is needed, write it as a separate SQL file and tell me.
- Don't touch other portals except to add the landing card.
- If you have repo access: build, typecheck and lint, then commit on a branch and push.
- If you don't: give me complete files to paste (full file contents, each with its path), plus a short list of which files are new and which are replaced.
- Finish with a short list of what changed, and anything I need to do by hand (for example uploading images or running SQL).
