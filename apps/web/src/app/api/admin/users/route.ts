import { NextResponse } from "next/server";
import { listSessionsForAdmin } from "@/lib/adminQueries";
import { requireAdmin } from "@/lib/requireAdmin";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  return NextResponse.json(await listSessionsForAdmin());
}
