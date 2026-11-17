-- First indicator: VT Structure (source in /indicators/vt-structure). Edit the URLs, then run. Safe to run twice.
insert into public.indicators
  (slug, name, description, long_description, platform, version, image, screenshots, install_steps, changelog,
   tradingview_url, access_level, sort_order, updated_at)
values (
  'vt-structure',
  'VT Structure',
  'Market structure with BOS/CHoCH, swing labels, a Fibonacci zone and rule-based entry, SL and TP levels.',
  E'VT Structure maps market structure for you. It labels every confirmed swing as HH, LH, HL or LL, draws BOS lines when price breaks with the trend and CHoCH lines when it breaks against it, and marks reversals with a triangle.\n\nIt adds 21 and 50 EMAs, a Fibonacci retracement of the current leg with the 0.618 to 0.786 zone shaded, and buy and sell signals with entry, stop loss and three targets (1R, 2R and 3R). The stop sits beyond the start of the leg plus an ATR buffer.\n\nA dashboard shows trend, strength (ADX), volume against its 20-bar average, the session, and the structure trend on 5m, 15m and H1. Nothing repaints: every value uses only that bar and earlier ones.\n\nSignals are rules applied to past candles, not forecasts, and nothing here is financial advice.',
  'tradingview',
  '1.0',
  null,
  '{}',
  '{}',
  '[{"version":"1.0","date":"2026-10-13","changes":["First release: swings, BOS/CHoCH, EMAs, Fibonacci zone, signals and dashboard"]}]',
  'https://www.tradingview.com/',   -- replace with the published script's TradingView link
  'members',
  0,
  '2026-10-13'
)
on conflict (slug) do nothing;
