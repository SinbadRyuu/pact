-- Power Rankings reads the existing trade history through two views. This is the ONLY place that knows your
-- table and column names. Everything else (stats, podium, profiles) reads these views.
--
-- ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
-- │ CHECK THESE AGAINST YOUR SCHEMA BEFORE RUNNING. Defaults follow the Trade Room `signals` / `channels`      │
-- │ tables (trade-room-signals/README.md). Two columns there are assumed, because the site logs them but this  │
-- │ repo doesn't show their names:                                                                            │
-- │   signals.result_pips  numeric      result of the trade in pips (negative for a loss)                      │
-- │   signals.closed_at    timestamptz  when the trade closed (null while it's running)                       │
-- │ If the provider is not the channel (e.g. a provider_id / posted_by column), change provider_id below and    │
-- │ point ranking_providers at that table instead.                                                            │
-- └──────────────────────────────────────────────────────────────────────────────────────────────────────────┘

-- Providers: one row per signal provider. slug is used in /signals/providers/<slug>.
create or replace view public.ranking_providers as
select
  c.id::text                                                                  as id,
  lower(trim(both '-' from regexp_replace(c.name, '[^a-zA-Z0-9]+', '-', 'g'))) as slug,
  c.name                                                                      as name,
  c.icon_url                                                                  as avatar_url
from public.channels c;

-- Trades: one row per signal. Keep provider_id and closed_at as plain columns (no casts or functions), so the
-- indexes below are used when the API filters on them.
create or replace view public.ranking_trades as
select
  s.id                            as id,
  s.channel_id                    as provider_id,     -- ← the provider column
  s.instrument                    as pair,
  upper(s.direction)              as direction,
  s.entry_from                    as entry,
  s.entry_to                      as entry_to,
  s.stop_loss                     as stop_loss,
  coalesce(s.targets_hit, 0)      as tp_hit,
  s.result_pips                   as result_pips,     -- ← assumed column
  s.status                        as status,
  (s.status = 'active')           as is_open,         -- running trades: shown as "live", never in the stats
  s.created_at                    as opened_at,
  s.closed_at                     as closed_at        -- ← assumed column
from public.signals s;

-- Indexes on the base table so the queries stay fast as history grows:
--   period queries filter closed trades by closed_at; profile queries filter by provider then closed_at.
create index if not exists signals_closed_at_idx
  on public.signals (closed_at) include (channel_id, instrument, result_pips)
  where status <> 'active';
create index if not exists signals_provider_closed_idx on public.signals (channel_id, closed_at);
create index if not exists signals_open_idx on public.signals (channel_id, created_at) where status = 'active';
