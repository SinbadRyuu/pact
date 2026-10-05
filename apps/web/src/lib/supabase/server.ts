import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use on the server (Server Components, Route Handlers,
 * middleware). Reads/writes the auth session via cookies.
 *
 * This is the ONLY place that should know Supabase is the auth provider —
 * everything else should call lib/admin.ts's getCurrentAdmin(), so swapping
 * Supabase Auth out later means changing this file and admin.ts, not every
 * admin page.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component render — safe to ignore because
            // middleware refreshes the session on every request anyway.
          }
        },
      },
    }
  );
}
