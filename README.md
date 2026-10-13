# PACT

## Investment tab

A ready-to-paste Investment section for the website: disclaimer gate, Get Started modules, a compound interest calculator with a live graph, an income calculator, a paid "Book a Call" page, topic pages and a taxes/accountant section.

➡️ See [`investment-tab/README.md`](investment-tab/README.md) for 2-minute install steps.

## Onboarding app

The PACT web app (Next.js + Supabase) is in `apps/web`, with shared logic in `packages/core`.

- `/`: onboarding
- `/admin`: admin dashboard (login required)
- `/investment`: Investment tab

### Run locally
```bash
npm install
cp apps/web/.env.local.example apps/web/.env.local   # then fill in the real values
npm run db:migrate
npm run dev
```

### Vercel settings
- Root Directory: `apps/web`
- Environment Variables: everything listed in `apps/web/.env.local.example` (Settings → Environment Variables)

