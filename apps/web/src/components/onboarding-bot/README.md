# OnboardingBot

Self-contained onboarding widget for PACT. Built to be dropped into another
website with minimal changes — this doc is for whoever does that.

## What it is

A single React component, `<OnboardingBot />`, that walks a visitor through
PACT's onboarding steps (broker signup → KYC → deposit → proof upload →
admin review) one step at a time. It owns its own state (fetched from the
onboarding API) and renders one step's heading, body text, and action
buttons at a time.

It does **not** know or care what page it's placed on. It has no routing, no
assumptions about page layout, and no global styles — see "Isolation" below.

## Installing it in another Next.js app

1. Copy this folder (`src/components/onboarding-bot/`) into the target
   project, or — if the target project shares this repo — just import it
   from `@pact/core`'s sibling app via a workspace package (ask whoever set
   up this repo about promoting this folder into its own package if that's
   the direction you want to go).
2. Copy the three onboarding API routes this component calls:
   `src/app/api/onboarding/state/route.ts`, `.../step/route.ts`,
   `.../upload/route.ts` — along with their dependencies in `src/lib/`
   (`db.ts`, `onboardingSession.ts`, `serializeOnboardingState.ts`,
   `supabase/admin.ts`) and the Prisma schema (`prisma/schema.prisma`).
3. Set the environment variables listed below.
4. Render it:

   ```tsx
   import { OnboardingBot } from "@/components/onboarding-bot";

   export default function SignupPage() {
     return <OnboardingBot />;
   }
   ```

## Dependencies

- React 18+, Next.js 14+ (App Router — it uses Route Handlers and
  `next/headers` cookies)
- `@prisma/client` + a Postgres database (Supabase or otherwise)
- `@supabase/supabase-js` (only for Storage — uploading deposit
  screenshots; not required if you swap in a different file storage)

## Environment variables required

| Variable | Used for |
|---|---|
| `DATABASE_URL` | Prisma, pooled connection |
| `DIRECT_URL` | Prisma, migrations only |
| `NEXT_PUBLIC_SUPABASE_URL` | Storage client |
| `SUPABASE_SECRET_KEY` | Storage client (server-only — never expose this) |

(Admin-dashboard-only variables — `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`ADMIN_EMAILS` — aren't needed just to embed the widget itself.)

## Configuration options

The component currently accepts:

```ts
interface OnboardingBotProps {
  apiBaseUrl?: string;   // "" for same-origin; set this if the API lives on a different domain
  theme?: Partial<OnboardingBotTheme>;  // accentColor, backgroundColor, textColor, borderRadius, fontFamily
  className?: string;   // for the host page to position/size the widget
}
```

Deeper content — step wording, which broker is shown, the minimum deposit
amount — is **not** passed as props. It's server/data-driven instead:

- Step copy lives in `packages/core/src/onboarding/steps.ts` — one file,
  edit the strings there.
- Which broker(s) are offered, their signup link, and minimum deposit are
  rows in the `Broker` database table (admin-editable data, not code).

This was a deliberate choice: a business-config value (a broker link, a
minimum deposit) changing shouldn't require a code change or a redeploy of
the component, and copy changes are rare enough that one shared file beats
prop-drilling every string through every embed site.

If the target site genuinely needs different wording per-embed (e.g. two
different brands reusing the same component), that's the one case where
`steps.ts`'s `STEP_CONTENT` would need to become an injectable prop instead
of a static import — flag that requirement before assuming the current
shape covers it.

## Branding

Pass a `theme` prop, or just wrap the component in a container with your own
CSS variables scoped to it — the component reads `--pact-accent`,
`--pact-bg`, `--pact-text`, `--pact-radius`, `--pact-font` from its own root
element's computed style via inline `style`, so overriding them from outside
works too.

## Isolation

- All component styling is in `OnboardingBot.module.css`, compiled by
  Next.js into hashed class names — nothing here can collide with or be
  overridden by the host page's global CSS, and nothing here leaks out.
- No global `window`/`document` state is read or written beyond the
  standard `fetch`/cookie APIs needed to talk to the onboarding API.
- No fixed viewport assumptions — the root element is `max-width: 480px;
  width: 100%`, so it fills whatever container it's placed in up to that
  cap, and reflows naturally on mobile.

## Data flow

- **In**: nothing — the component calls `GET /api/onboarding/state` itself
  on mount, identified by an httpOnly cookie (`pact_onboarding_sid`) that's
  set automatically on first visit. The host page doesn't need to pass any
  user identity in.
- **Out**: nothing is emitted back to the host page directly (no `onComplete`
  callback exists yet). If the host site needs to react to onboarding
  completion (e.g. redirect, fire an analytics event), that's a small
  addition to `useOnboardingState.ts` — say so if you need it, rather than
  polling the API yourself from outside the component.

## Deploying

This repo's `apps/web` deploys as an ordinary Next.js app (currently hosted
on Vercel for development/testing). Production hosting is expected to be
wherever the main PACT website already lives — this component has no
dependency on Vercel specifically; any Node.js host that runs Next.js's App
Router (including a custom server) works.

## What integrators will likely need to change

- `apiBaseUrl` if the API ends up on a different subdomain/origin than the
  page the widget is embedded on (and then add CORS handling to the three
  API routes, which currently assume same-origin).
- The `theme` prop, to match the host site's brand colors/fonts.
- Possibly promoting this folder into its own `@pact/onboarding-widget`
  workspace package if it needs to be shared across multiple Next.js apps
  rather than copy-pasted.
