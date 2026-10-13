import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/onboardingSession";

/**
 * Convenience endpoint for manual testing: clears the caller's own onboarding
 * cookie so the next page load starts a brand new session, without having to
 * dig through browser devtools. Only ever touches the requester's own
 * cookie — can't affect any other user's data — so it's safe to leave in.
 */
export async function POST() {
  cookies().delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
