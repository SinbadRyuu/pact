import { cookies } from "next/headers";
import type { OnboardingStatus } from "@pact/core";
import { prisma } from "./db";

export const SESSION_COOKIE_NAME = "pact_onboarding_sid";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 days — long enough that "leave and come back" actually works

/**
 * Identifies an anonymous onboarding visitor via an httpOnly cookie holding
 * their OnboardingSession id. No login required to use the widget — this is
 * the entire mechanism behind "users can leave and come back without
 * starting again".
 */
export async function getOrCreateSession() {
  const cookieStore = cookies();
  const existingId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (existingId) {
    const existing = await prisma.onboardingSession.findUnique({
      where: { id: existingId },
      include: { broker: true },
    });
    if (existing) return existing;
    // Cookie points at a session that no longer exists (e.g. DB was reset) — fall through and create a fresh one.
  }

  const defaultBroker = await prisma.broker.findFirst({
    where: { isActive: true, isDefault: true },
  });

  const created = await prisma.onboardingSession.create({
    data: {
      status: "STARTED",
      brokerId: defaultBroker?.id ?? null,
    },
    include: { broker: true },
  });

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: created.id,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });

  await recordTransition(created.id, null, "STARTED", "system");

  return created;
}

export async function recordTransition(
  sessionId: string,
  fromStatus: OnboardingStatus | null,
  toStatus: OnboardingStatus,
  actor: string
) {
  await prisma.statusHistoryEntry.create({
    data: { sessionId, fromStatus, toStatus, actor },
  });
}
