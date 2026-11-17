// Shared server types for the Automation page. No framework imports here, so the same code runs on
// Vercel / Next.js route handlers, Supabase Edge Functions (Deno), Cloudflare Workers or plain Node.

/** The signed-in person, as your auth layer resolves them from the request. */
export interface AuthUser {
  id: string;
  email?: string | null;
}

/** Resolves the signed-in user from a request (cookie or `Authorization: Bearer` token). Null when signed out. */
export type GetUser = (req: Request) => Promise<AuthUser | null>;

/**
 * The smallest database surface the module needs: run a parameterised SQL query and get rows back.
 * `pg` Pool, postgres.js, Supabase's `postgres` driver and Prisma's `$queryRawUnsafe` all fit with a one-line wrapper
 * (see README, "Database").
 */
export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

/** Subscription states we store. Stripe's "canceled" is stored as "cancelled" (the spelling the brief asked for). */
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

/** One row per user in `instant_impact_subscriptions`. */
export interface SubscriptionRecord {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus | null;
  priceId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: Date;
}

/** A signal as the paid feed shows it. Mirrors the Trade Room `signals` table. */
export interface FeedSignal {
  id: string;
  pair: string;
  direction: "BUY" | "SELL";
  entryFrom: number;
  entryTo: number | null;
  takeProfits: number[];
  stopLoss: number;
  status: string;
  targetsHit: number;
  notes: string | null;
  createdAt: string;
}
