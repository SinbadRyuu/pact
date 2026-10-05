import { NextResponse } from "next/server";
import { getOrCreateSession } from "@/lib/onboardingSession";
import { serializeOnboardingState } from "@/lib/serializeOnboardingState";

export async function GET() {
  try {
    const session = await getOrCreateSession();
    return NextResponse.json(serializeOnboardingState(session));
  } catch (err) {
    console.error("[onboarding/state] failed to load session", err);
    return NextResponse.json(
      { error: "Something went wrong loading your progress. Please refresh and try again." },
      { status: 500 }
    );
  }
}
