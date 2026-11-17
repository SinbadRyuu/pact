-- Indicators page: the indicators themselves (add a row to publish one, no code change needed) and a download log.
-- Run once in the Supabase SQL editor. Safe to run twice.

create table if not exists public.indicators (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),   -- used in /indicators/<slug>
  name             text not null,
  description      text not null,                       -- short line for the card
  long_description text,                                -- detail page; blank lines start new paragraphs
  platform         text not null check (platform in ('tradingview', 'mt4', 'mt5')),
  version          text not null default '1.0',
  image            text,                                -- preview image or GIF URL (16:9 looks best)
  screenshots      text[] not null default '{}',        -- detail page gallery
  install_steps    text[] not null default '{}',        -- detail page "How to install"; empty = sensible defaults per platform
  changelog        jsonb not null default '[]',         -- [{"version":"1.1","date":"2026-11-01","changes":["…"]}], newest first
  file_url         text,                                -- download (MT4/MT5). "storage:<bucket>/<path>" = private Supabase Storage, signed per download
  tradingview_url  text,                                -- "Get on TradingView" (TradingView)
  access_level     text not null default 'free' check (access_level in ('free', 'members')),
  published        boolean not null default true,      -- untick to hide without deleting
  sort_order       int not null default 0,              -- lower shows first; ties go to most recently updated
  download_count   bigint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),  -- shown as "Last updated": set it when you ship a new version
  constraint indicators_has_link check (file_url is not null or tradingview_url is not null)
);

create index if not exists indicators_listing_idx on public.indicators (published, sort_order, updated_at desc);

-- One row per download, for "downloads this week" style reporting later. The total lives on indicators.download_count.
create table if not exists public.indicator_downloads (
  id           bigserial primary key,
  indicator_id uuid not null references public.indicators(id) on delete cascade,
  user_id      text,
  created_at   timestamptz not null default now()
);
create index if not exists indicator_downloads_indicator_idx on public.indicator_downloads (indicator_id, created_at);

-- Only the server reads these tables, so members-only file links are never visible to the browser.
alter table public.indicators enable row level security;
alter table public.indicator_downloads enable row level security;
