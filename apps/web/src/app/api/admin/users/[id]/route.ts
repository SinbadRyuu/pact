import { NextResponse } from "next/server";
import { applyTransition, IllegalTransitionError } from "@pact/core";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { recordTransition } from "@/lib/onboardingSession";
import { getSessionDetailForAdmin } from "@/lib/adminQueries";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { response } = await requireAdmin();
  if (response) return response;

  const detail = await getSessionDetailForAdmin(params.id);
  if (!detail) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json(detail);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { admin, response } = await requireAdmin();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const action = (body as { action?: string })?.action;
  const reason = (body as { reason?: string })?.reason?.trim();

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'." }, { status: 400 });
  }
  if (action === "reject" && !reason) {
    return NextResponse.json({ error: "A reason is required when rejecting." }, { status: 400 });
  }

  const session = await prisma.onboardingSession.findUnique({ where: { id: params.id } });
  if (!session) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let nextStatus;
  try {
    nextStatus = applyTransition(
      session.status,
      action === "approve" ? { type: "ADMIN_APPROVE" } : { type: "ADMIN_REJECT", reason: reason! }
    );
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      return NextResponse.json(
        { error: `Can't ${action} a session that isn't awaiting review.` },
        { status: 409 }
      );
    }
    throw err;
  }

  const updated = await prisma.onboardingSession.update({
    where: { id: session.id },
    data: {
      status: nextStatus,
      rejectionReason: action === "reject" ? reason : null,
    },
  });

  await recordTransition(session.id, session.status, nextStatus, `admin:${admin!.email}`);

  return NextResponse.json({ id: updated.id, status: updated.status });
}
