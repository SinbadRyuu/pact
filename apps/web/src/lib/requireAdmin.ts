import { NextResponse } from "next/server";
import { getCurrentAdmin, type CurrentAdmin } from "./admin";

interface RequireAdminResult {
  admin: CurrentAdmin | null;
  response: NextResponse | null;
}

/**
 * Call at the top of every admin API route. Returns the admin on success, or
 * a ready-to-return 401 response if the caller isn't an allowlisted admin.
 * Never leaks *why* (no logged in vs not on allowlist distinction) to avoid
 * giving a normal user a hint about who the admins are.
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return { admin: null, response: NextResponse.json({ error: "Not authorized." }, { status: 401 }) };
  }
  return { admin, response: null };
}
