# PACT

## Investment tab

A ready-to-paste Investment section for the website: disclaimer gate, Get Started modules, a compound interest calculator with a live graph, an income calculator, a paid "Book a Call" page, topic pages and a taxes/accountant section.

➡️ See [`investment-tab/README.md`](investment-tab/README.md) for 2-minute install steps.

## Investment portal

VT Investment as its own portal on vtimpact.com, next to Impact Travel and Impact Affiliates.

➡️ See [`investment-portal/README.md`](investment-portal/README.md) for install steps.

## Live calls page

The weekly lineup for `/investment/calls` on vtimpact.com: week switching, a Monday to Sunday day strip, up next, this week's counts, the week agenda and Add call for staff.

➡️ See [`investment-live-calls/README.md`](investment-live-calls/README.md) for install steps.

## Trade Room signals

The rebuilt New Signal form (channel, direction, pair, entry or zone, TP1 to TP6, stop loss, notes, chart, auto-manage) and signal cards for the Trade Room on the VT Impact gateway.

➡️ See [`trade-room-signals/README.md`](trade-room-signals/README.md) for install steps, or paste [`trade-room-signals/LOVABLE_PROMPT.md`](trade-room-signals/LOVABLE_PROMPT.md) into Lovable.

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

