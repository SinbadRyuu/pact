// `getUser` for Supabase Auth: reads the `Authorization: Bearer <access token>` header the page sends and asks
// Supabase who it belongs to. No SDK needed, so it runs on Node, Deno and edge runtimes alike.
// If the site uses a different auth system, write your own `GetUser` with the same shape.
import type { AuthUser, GetUser } from "./types";

export function supabaseGetUser(opts: { supabaseUrl: string; anonKey: string }): GetUser {
  const endpoint = `${opts.supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`;
  return async (req: Request): Promise<AuthUser | null> => {
    const header = req.headers.get("authorization") ?? "";
    const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
    if (!token) return null;
    const res = await fetch(endpoint, { headers: { apikey: opts.anonKey, authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const u = (await res.json()) as { id?: string; email?: string | null };
    return u.id ? { id: u.id, email: u.email ?? null } : null;
  };
}
