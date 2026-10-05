import { NextResponse } from "next/server";
import { applyTransition, IllegalTransitionError } from "@pact/core";
import { prisma } from "@/lib/db";
import { getOrCreateSession, recordTransition } from "@/lib/onboardingSession";
import { serializeOnboardingState } from "@/lib/serializeOnboardingState";
import { createAdminSupabaseClient, DEPOSIT_SCREENSHOTS_BUCKET } from "@/lib/supabase/admin";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/heic"]);

export async function POST(request: Request) {
  const session = await getOrCreateSession();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Malformed upload." }, { status: 400 });
  }

  const file = form.get("screenshot");
  const amountRaw = form.get("depositAmountClaimed");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please attach a screenshot image." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Image must be under 10MB." }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Please upload a PNG, JPEG, WEBP or HEIC image." }, { status: 400 });
  }

  const depositAmountClaimed = Number(amountRaw);
  if (!Number.isFinite(depositAmountClaimed) || depositAmountClaimed <= 0) {
    return NextResponse.json({ error: "Please enter the amount you deposited." }, { status: 400 });
  }

  let nextStatus;
  try {
    nextStatus = applyTransition(session.status, {
      type: "SUBMIT_DEPOSIT_PROOF",
      depositAmountClaimed,
      screenshotRef: "", // actual ref assigned below once uploaded
    });
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      return NextResponse.json(
        { error: "You can't submit a screenshot at this step — try refreshing the page." },
        { status: 409 }
      );
    }
    throw err;
  }

  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const storagePath = `${session.id}/${Date.now()}.${extension}`;

  const supabaseAdmin = createAdminSupabaseClient();
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(DEPOSIT_SCREENSHOTS_BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[onboarding/upload] storage upload failed", uploadError);
    return NextResponse.json(
      { error: "Couldn't save your screenshot just now. Please try again." },
      { status: 502 }
    );
  }

  try {
    const updated = await prisma.onboardingSession.update({
      where: { id: session.id },
      data: {
        status: nextStatus,
        depositAmountClaimed,
        depositScreenshotRef: storagePath,
        rejectionReason: null,
      },
      include: { broker: true },
    });

    await recordTransition(session.id, session.status, nextStatus, "user");

    return NextResponse.json(serializeOnboardingState(updated));
  } catch (err) {
    console.error("[onboarding/upload] failed to persist submission", err);
    return NextResponse.json(
      { error: "Your screenshot uploaded but we couldn't save your submission. Please try again." },
      { status: 500 }
    );
  }
}
