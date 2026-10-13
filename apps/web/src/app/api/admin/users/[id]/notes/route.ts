import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { admin, response } = await requireAdmin();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const noteBody = (body as { body?: string })?.body?.trim();
  if (!noteBody) {
    return NextResponse.json({ error: "Note body is required." }, { status: 400 });
  }

  const session = await prisma.onboardingSession.findUnique({ where: { id: params.id } });
  if (!session) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const note = await prisma.adminNote.create({
    data: { sessionId: session.id, authorEmail: admin!.email, body: noteBody },
  });

  return NextResponse.json({ id: note.id, authorEmail: note.authorEmail, body: note.body, createdAt: note.createdAt.toISOString() });
}
