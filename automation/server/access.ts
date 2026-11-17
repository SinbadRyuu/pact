// The one rule that decides who sees the paid Instant Impact signals. Used by every gated endpoint.
import type { SubscriptionRecord, SubscriptionStatus } from "./types";

const DAY = 86_400_000;

/**
 * Access is granted while the subscription is active or trialing and the paid period hasn't ended.
 * - Cancelled "at period end": Stripe keeps the status active until the period ends, so access runs to the end of what they paid for.
 * - Payment failed (past_due / unpaid): no access, unless INSTANT_IMPACT_GRACE_DAYS gives a few days to fix the card.
 * - Cancelled outright / incomplete / paused: no access.
 */
export function hasInstantImpactAccess(rec: SubscriptionRecord | null, now: Date, graceDays = 0): boolean {
  if (!rec?.status) return false;
  const end = rec.currentPeriodEnd?.getTime() ?? null;

  if (rec.status === "active" || rec.status === "trialing") {
    // A small allowance for clock skew / the renewal webhook arriving a little after the period ends.
    return end === null || end + 6 * 3600_000 > now.getTime();
  }
  if (graceDays > 0 && rec.status === "past_due" && end !== null) {
    return end + graceDays * DAY > now.getTime();
  }
  return false;
}

/** Maps Stripe's subscription status onto ours ("canceled" → "cancelled"). */
export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "canceled":
      return "cancelled";
    case "active":
    case "trialing":
    case "past_due":
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
    case "paused":
      return status;
    default:
      return "incomplete";
  }
}
