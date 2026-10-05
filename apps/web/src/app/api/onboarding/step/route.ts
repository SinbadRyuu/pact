import { NextResponse } from "next/server";
import { applyTransition, IllegalTransitionError } from "@pact/core";
import { prisma } from "@/lib/db";
import { getOrCreateSession, recordTransition } from "@/lib/onboardingSession";
import { serializeOnboardingState } from "@/lib/serializeOnboardingState";

const ALLOWED_ACTIONS = new Set(["NEXT", "BACK", "RESTART"]);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const action = (body as { action?: string })?.action;
  if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  try {
    const session = await getOrCreateSession();
    const nextStatus = applyTransition(session.status, { type: action as "NEXT" | "BACK" | "RESTART" });

    const updated = await prisma.onboardingSession.update({
      where: { id: session.id },
      data: {
        status: nextStatus,
        // Restarting clears any stale rejection/deposit info from a previous attempt.
        ...(action === "RESTART"
          ? { rejectionReason: null, depositAmountClaimed: null, depositScreenshotRef: null }
          : {}),
      },
      include: { broker: true },
    });

    await recordTransition(session.id, session.status, nextStatus, "user");

    return NextResponse.json(serializeOnboardingState(updated));
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      return NextResponse.json(
        { error: "That button isn't available right now — try refreshing the page." },
        { status: 409 }
      );
    }
    console.error("[onboarding/step] failed to apply action", action, err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again in a moment." },
      { status: 500 }
    );
  }
}
