-- Instant Impact: subscription status stored against the user account.
-- Run once (Supabase: SQL editor, or `supabase migration new` and paste). Safe to run twice.
--
-- user_id is text so it fits Supabase auth (uuid as text) or any other user id. If your users table is
-- auth.users you can add:  alter table instant_impact_subscriptions add foreign key (user_id) ... (cast as needed).

create table if not exists public.instant_impact_subscriptions (
  user_id                text primary key,
  stripe_customer_id     text not null unique,
  stripe_subscription_id text unique,
  -- active | trialing | past_due | cancelled | incomplete | incomplete_expired | unpaid | paused (null = never subscribed)
  status                 text,
  price_id               text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Every Stripe webhook we have handled. Stops a retried delivery being processed twice and gives an audit trail.
create table if not exists public.stripe_webhook_events (
  id           text primary key,          -- evt_…
  type         text not null,
  processed_at timestamptz not null default now()
);

-- Only the server (service role) touches these tables. With RLS on and no policies, the browser can't read or write them.
alter table public.instant_impact_subscriptions enable row level security;
alter table public.stripe_webhook_events enable row level security;
