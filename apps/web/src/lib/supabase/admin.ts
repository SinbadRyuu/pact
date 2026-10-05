import { createClient } from "@supabase/supabase-js";

/**
 * Secret-key Supabase client. SERVER-SIDE ONLY — never import this from a
 * Client Component or anything that ships to the browser, since the secret
 * key bypasses all access rules.
 *
 * Used only for Storage (deposit screenshots). All onboarding/admin *data*
 * goes through Prisma (src/lib/db.ts), not this client.
 */
export function createAdminSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } }
  );
}

export const DEPOSIT_SCREENSHOTS_BUCKET = "deposit-screenshots";
