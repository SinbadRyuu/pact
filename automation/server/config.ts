// Reads every setting from environment variables. Nothing secret is hardcoded.
// Pass `process.env` on Node / Vercel, or `Deno.env.toObject()` in a Supabase Edge Function.

export interface AutomationConfig {
  /** sk_test_… while testing, sk_live_… in production. */
  stripeSecretKey: string;
  /** whsec_… from the webhook endpoint (or from `stripe listen` locally). */
  stripeWebhookSecret: string;
  /** price_… for Instant Impact ($9.99/month today). Change the env var to change the price. */
  priceInstantImpact: string;
  /** https://vtimpact.com in production. Used to build Checkout / Portal return addresses. */
  siteUrl: string;
  /** Telegram invite for subscribers. Only ever sent to people with access. */
  telegramSignalsLink: string | null;
  /** Our VT Markets IB referral link (step 1 of The Sniper Bot). */
  vtMarketsSignupLink: string | null;
  /** Web share link to The Sniper Bot in VT Markets copy trading (fallback and desktop). */
  sniperBotCopyLink: string | null;
  /** App deep link to The Sniper Bot listing, tried first on phones. */
  sniperBotAppLink: string | null;
  /** Optional Android package name for the VT Markets app, used to build an intent:// link with a web fallback. */
  vtMarketsAndroidPackage: string | null;
  /** Where US clients go instead. */
  crucialMarketsLink: string | null;
  /** Optional: only show signals from this Trade Room channel in the paid feed. */
  instantImpactChannelId: string | null;
  /** Days of access kept after a failed payment. 0 means access stops as soon as a payment fails. */
  graceDays: number;
}

const REQUIRED = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_INSTANT_IMPACT", "SITE_URL"] as const;

export function readAutomationConfig(env: Record<string, string | undefined>): AutomationConfig {
  const missing = REQUIRED.filter((k) => !env[k]?.trim());
  if (missing.length) throw new Error(`Automation page is missing env vars: ${missing.join(", ")}`);

  const opt = (k: string) => env[k]?.trim() || null;
  return {
    stripeSecretKey: env.STRIPE_SECRET_KEY!.trim(),
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET!.trim(),
    priceInstantImpact: env.STRIPE_PRICE_INSTANT_IMPACT!.trim(),
    siteUrl: env.SITE_URL!.trim().replace(/\/+$/, ""),
    telegramSignalsLink: opt("TELEGRAM_SIGNALS_LINK"),
    vtMarketsSignupLink: opt("VT_MARKETS_SIGNUP_LINK"),
    sniperBotCopyLink: opt("SNIPER_BOT_COPY_LINK"),
    sniperBotAppLink: opt("SNIPER_BOT_APP_LINK"),
    vtMarketsAndroidPackage: opt("VT_MARKETS_ANDROID_PACKAGE"),
    crucialMarketsLink: opt("CRUCIAL_MARKETS_LINK"),
    instantImpactChannelId: opt("INSTANT_IMPACT_CHANNEL_ID"),
    graceDays: Math.max(0, Number(env.INSTANT_IMPACT_GRACE_DAYS ?? 0) || 0),
  };
}

/** Warns (once, at start-up) when the live/test key and the price don't belong together. */
export function stripeModeWarnings(cfg: AutomationConfig): string[] {
  const out: string[] = [];
  if (!/^sk_(test|live)_|^rk_(test|live)_/.test(cfg.stripeSecretKey)) out.push("STRIPE_SECRET_KEY doesn't look like a Stripe secret key.");
  if (!cfg.priceInstantImpact.startsWith("price_")) out.push("STRIPE_PRICE_INSTANT_IMPACT should be a price ID (price_…), not a product ID.");
  if (!cfg.stripeWebhookSecret.startsWith("whsec_")) out.push("STRIPE_WEBHOOK_SECRET should start with whsec_.");
  if (!cfg.siteUrl.startsWith("https://") && !cfg.siteUrl.startsWith("http://localhost")) out.push("SITE_URL should be https in production.");
  return out;
}
