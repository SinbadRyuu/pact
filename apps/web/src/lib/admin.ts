import { createServerSupabaseClient } from "./supabase/server";

/**
 * Invite-only admin allowlist. Anyone can create a Supabase Auth account in
 * theory, but only emails listed in ADMIN_EMAILS are treated as admins.
 * Add/remove an admin by editing the env var — no code change, no redeploy
 * of the auth logic itself.
 *
 * NOTE for whoever integrates this into the main site later: this is the one
 * function (getCurrentAdmin) every admin page/route depends on. Replace its
 * implementation with the main site's own auth and nothing else here needs
 * to change.
 */
function getAdminAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export interface CurrentAdmin {
  email: string;
}

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const allowlist = getAdminAllowlist();
  if (!allowlist.includes(user.email.toLowerCase())) return null;

  return { email: user.email };
}
