# Investment portal

VT Investment as its own portal on [vtimpact.com](https://www.vtimpact.com/), next to Impact Travel and Impact Affiliates. It has its own entry screen, header and navigation, and it no longer sits inside the main `/home` member area. The URLs don't change.

The `src/` folder mirrors the vtimpact.com project, so each file goes into the same path there.

## What's inside

| File | What it is |
| --- | --- |
| `src/routes/investment.tsx` | Portal layout: sign-in check, entry splash, disclaimer gate, header with "← All portals", sidebar and mobile menu |
| `src/routes/investment.index.tsx` | Dashboard: hero, next live call, roadmap, calculators, markets, support |
| `src/routes/investment.schedule.tsx` | Live call schedule |
| `src/routes/investment.module.$slug.tsx` | Lesson pages |
| `src/routes/investment.explore.$slug.tsx` | Market and category pages |
| `src/components/investment/InvestmentSplash.tsx` | Entry screen with the IMPACT logo and the glowing cyan "Enter portal →" button |
| `src/components/investment/InvestmentPortalCard.tsx` | The "Impact Investment" card for the landing page |
| `src/components/investment/ImpactMark.tsx` | The IMPACT "V" logo and wordmark |
| `src/components/investment/user.ts` | Gives the portal's pages the signed-in user |
| `src/assets/investment-portal-hero.jpg` | Night-time desk image (splash and dashboard hero) |
| `src/assets/investment-portal-banner.jpg` | Purple and blue candlestick wave (header glow and next-call card) |

## Install (in the vtimpact.com project)

1. **Delete the old investment routes** in `src/routes/_authenticated/`: `investment.tsx`, `investment.index.tsx`, `investment.schedule.tsx`, `investment.module.$slug.tsx` and `investment.explore.$slug.tsx`. They use the same URLs as the new ones, so both sets can't exist together.
2. **Copy everything in `src/` from this folder** into the project's `src/`.
3. **Add the card to the landing page** (the file that has the Impact Travel and Impact Affiliates cards):
   ```tsx
   import { InvestmentPortalCard } from "@/components/investment/InvestmentPortalCard";
   // …under the Impact Affiliates card:
   <InvestmentPortalCard />
   ```
   For a pixel-exact match, you can instead duplicate the Affiliates card and change it to the `TrendingUp` icon, the title "Impact Investment", the copy "Learn, plan and grow your wealth, all in one place." and a link to `/investment`.
4. **Check imports of `DISCLAIMER_VERSION`.** If any file imports it from `@/routes/_authenticated/investment`, change the path to `@/routes/investment`.
5. Run the app. The route tree regenerates itself.

In Lovable, you can paste this README and the files into the chat and ask it to apply them.

## How it behaves

- **Signed out:** going to `/investment` sends the visitor to `/home`, where the existing guard takes them to sign in.
- **Signed in:** the entry splash shows once per browser session. After that comes the disclaimer (same table, same `v1` version, so anyone who already agreed isn't asked again), then the portal.
- **"← All portals"** goes back to the landing page.
- **Data is unchanged:** it uses the same Supabase tables, queries and query keys as before. No migrations are needed.

## Things to check after installing

- **Login redirect.** If your login page reads a `?redirect=` parameter, you can change the `navigate({ to: "/home" })` line in `investment.tsx` so people come back to `/investment` after signing in.
- **Logo.** If the landing page uses a logo image, swap it into `ImpactMark.tsx` so both match exactly.
- **Shared components.** If `MemberSchedule`, `ContentPage`, `Calculators` or `EnquiryForm` read the `_authenticated` route context internally, they'll error here. If that happens, send me that component and I'll switch it to `useInvestmentUser()`.
