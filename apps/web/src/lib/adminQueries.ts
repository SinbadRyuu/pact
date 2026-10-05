import { prisma } from "./db";
import { createAdminSupabaseClient, DEPOSIT_SCREENSHOTS_BUCKET } from "./supabase/admin";

const SIGNED_URL_TTL_SECONDS = 60 * 10;

/** Review queue first, then everything else, in a sensible operational order. */
const STATUS_ORDER = [
  "DEPOSIT_SUBMITTED",
  "REJECTED",
  "KYC_COMPLETE",
  "DEPOSIT_PENDING",
  "KYC_PENDING",
  "ACCOUNT_CREATED",
  "AWAITING_BROKER_SIGNUP",
  "STARTED",
  "APPROVED",
  "COMPLETED",
] as const;

export async function listSessionsForAdmin() {
  const sessions = await prisma.onboardingSession.findMany({
    include: { broker: true },
    orderBy: { updatedAt: "desc" },
  });

  return [...sessions]
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.status as (typeof STATUS_ORDER)[number]) -
        STATUS_ORDER.indexOf(b.status as (typeof STATUS_ORDER)[number])
    )
    .map((s) => ({
      id: s.id,
      status: s.status,
      displayName: s.displayName,
      contactHandle: s.contactHandle,
      brokerName: s.broker?.name ?? null,
      depositAmountClaimed: s.depositAmountClaimed ? Number(s.depositAmountClaimed) : null,
      hasScreenshot: Boolean(s.depositScreenshotRef),
      referralCode: s.referralCode,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
}

export async function getSessionDetailForAdmin(id: string) {
  const session = await prisma.onboardingSession.findUnique({
    where: { id },
    include: {
      broker: true,
      notes: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session) return null;

  let screenshotUrl: string | null = null;
  if (session.depositScreenshotRef) {
    const supabaseAdmin = createAdminSupabaseClient();
    const { data, error } = await supabaseAdmin.storage
      .from(DEPOSIT_SCREENSHOTS_BUCKET)
      .createSignedUrl(session.depositScreenshotRef, SIGNED_URL_TTL_SECONDS);
    if (error) console.error("[adminQueries] failed to sign screenshot url", error);
    screenshotUrl = data?.signedUrl ?? null;
  }

  return {
    id: session.id,
    status: session.status,
    displayName: session.displayName,
    contactHandle: session.contactHandle,
    referralCode: session.referralCode,
    broker: session.broker
      ? {
          id: session.broker.id,
          name: session.broker.name,
          minDepositAmount: session.broker.minDepositAmount,
          minDepositCurrency: session.broker.minDepositCurrency,
        }
      : null,
    depositAmountClaimed: session.depositAmountClaimed ? Number(session.depositAmountClaimed) : null,
    screenshotUrl,
    rejectionReason: session.rejectionReason,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    notes: session.notes.map((n) => ({
      id: n.id,
      authorEmail: n.authorEmail,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    })),
    history: session.statusHistory.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      actor: h.actor,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

export type AdminSessionSummary = Awaited<ReturnType<typeof listSessionsForAdmin>>[number];
export type AdminSessionDetail = NonNullable<Awaited<ReturnType<typeof getSessionDetailForAdmin>>>;
