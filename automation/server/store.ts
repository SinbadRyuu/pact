// Reads and writes subscription state. `createPgBillingStore` is the production store (Postgres / Supabase);
// `createMemoryBillingStore` is for tests and the preview.
import type { FeedSignal, Sql, SubscriptionRecord } from "./types";

export interface BillingStore {
  getByUser(userId: string): Promise<SubscriptionRecord | null>;
  getByCustomer(customerId: string): Promise<SubscriptionRecord | null>;
  /** Links a Stripe customer to a user before they reach Checkout. */
  setCustomer(userId: string, customerId: string): Promise<void>;
  /** Writes the latest subscription state (always the full, current state from Stripe). */
  saveSubscription(rec: Omit<SubscriptionRecord, "updatedAt">): Promise<void>;
  /** True if this webhook event was already handled. */
  wasProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string, type: string): Promise<void>;
}

interface Row {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  status: SubscriptionRecord["status"];
  price_id: string | null;
  current_period_end: Date | string | null;
  cancel_at_period_end: boolean;
  updated_at: Date | string;
}

const toRecord = (r: Row): SubscriptionRecord => ({
  userId: r.user_id,
  stripeCustomerId: r.stripe_customer_id,
  stripeSubscriptionId: r.stripe_subscription_id,
  status: r.status,
  priceId: r.price_id,
  currentPeriodEnd: r.current_period_end ? new Date(r.current_period_end) : null,
  cancelAtPeriodEnd: r.cancel_at_period_end,
  updatedAt: new Date(r.updated_at),
});

const T = "public.instant_impact_subscriptions";

export function createPgBillingStore(sql: Sql): BillingStore {
  return {
    async getByUser(userId) {
      const rows = await sql.query<Row>(`select * from ${T} where user_id = $1`, [userId]);
      return rows[0] ? toRecord(rows[0]) : null;
    },
    async getByCustomer(customerId) {
      const rows = await sql.query<Row>(`select * from ${T} where stripe_customer_id = $1`, [customerId]);
      return rows[0] ? toRecord(rows[0]) : null;
    },
    async setCustomer(userId, customerId) {
      await sql.query(
        `insert into ${T} (user_id, stripe_customer_id) values ($1, $2)
         on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id, updated_at = now()`,
        [userId, customerId],
      );
    },
    async saveSubscription(rec) {
      await sql.query(
        `insert into ${T} (user_id, stripe_customer_id, stripe_subscription_id, status, price_id, current_period_end, cancel_at_period_end)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (user_id) do update set
           stripe_customer_id = excluded.stripe_customer_id,
           stripe_subscription_id = excluded.stripe_subscription_id,
           status = excluded.status,
           price_id = excluded.price_id,
           current_period_end = excluded.current_period_end,
           cancel_at_period_end = excluded.cancel_at_period_end,
           updated_at = now()`,
        [
          rec.userId,
          rec.stripeCustomerId,
          rec.stripeSubscriptionId,
          rec.status,
          rec.priceId,
          rec.currentPeriodEnd,
          rec.cancelAtPeriodEnd,
        ],
      );
    },
    async wasProcessed(eventId) {
      const rows = await sql.query(`select 1 from public.stripe_webhook_events where id = $1`, [eventId]);
      return rows.length > 0;
    },
    async markProcessed(eventId, type) {
      await sql.query(`insert into public.stripe_webhook_events (id, type) values ($1, $2) on conflict (id) do nothing`, [
        eventId,
        type,
      ]);
    },
  };
}

export function createMemoryBillingStore(seed: SubscriptionRecord[] = []): BillingStore & { all(): SubscriptionRecord[] } {
  const byUser = new Map(seed.map((r) => [r.userId, r]));
  const events = new Set<string>();
  return {
    all: () => [...byUser.values()],
    async getByUser(userId) {
      return byUser.get(userId) ?? null;
    },
    async getByCustomer(customerId) {
      return [...byUser.values()].find((r) => r.stripeCustomerId === customerId) ?? null;
    },
    async setCustomer(userId, customerId) {
      const cur = byUser.get(userId);
      byUser.set(userId, {
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: cur?.stripeSubscriptionId ?? null,
        status: cur?.status ?? null,
        priceId: cur?.priceId ?? null,
        currentPeriodEnd: cur?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: cur?.cancelAtPeriodEnd ?? false,
        updatedAt: new Date(),
      });
    },
    async saveSubscription(rec) {
      byUser.set(rec.userId, { ...rec, updatedAt: new Date() });
    },
    async wasProcessed(id) {
      return events.has(id);
    },
    async markProcessed(id) {
      events.add(id);
    },
  };
}

/**
 * Default loader for the paid feed: the latest signals from the Trade Room `signals` table
 * (columns as in trade-room-signals/README.md). Pass your own `loadSignals` if your table differs.
 */
export function createPgSignalsLoader(sql: Sql, channelId: string | null) {
  return async (limit: number): Promise<FeedSignal[]> => {
    const rows = await sql.query<{
      id: string;
      instrument: string;
      direction: string;
      entry_from: string | number;
      entry_to: string | number | null;
      take_profits: (string | number)[] | null;
      stop_loss: string | number;
      status: string;
      targets_hit: number | null;
      notes: string | null;
      created_at: Date | string;
    }>(
      `select id::text, instrument, direction, entry_from, entry_to, take_profits, stop_loss, status, targets_hit, notes, created_at
         from public.signals
        where ($1::text is null or channel_id::text = $1)
        order by created_at desc
        limit $2`,
      [channelId, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      pair: r.instrument,
      direction: String(r.direction).toUpperCase() === "SELL" ? "SELL" : "BUY",
      entryFrom: Number(r.entry_from),
      entryTo: r.entry_to === null ? null : Number(r.entry_to),
      takeProfits: (r.take_profits ?? []).map(Number),
      stopLoss: Number(r.stop_loss),
      status: r.status,
      targetsHit: r.targets_hit ?? 0,
      notes: r.notes,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  };
}
