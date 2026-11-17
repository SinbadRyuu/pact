// Supabase Edge Function that serves /api/rankings/* (deploy: supabase functions deploy rankings --no-verify-jwt).
// Rankings are public, so the gateway JWT check is off. SUPABASE_DB_URL is provided by Supabase.
// Optional secrets: RANKINGS_MIN_TRADES (10), RANKINGS_BREAKEVEN_PIPS (0), RANKINGS_TIMEZONE (Europe/London),
// RANKINGS_CACHE_SECONDS (60).
import postgres from "npm:postgres@3.4.5";
import { createRankingsApiFromEnv } from "./rankings-api.js";

const env = Deno.env.toObject();
const db = postgres(env.SUPABASE_DB_URL, { prepare: false });
const api = createRankingsApiFromEnv(env, { query: (text: string, params: unknown[] = []) => db.unsafe(text, params as never[]) as never });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  url.pathname = url.pathname.replace(/^(\/functions\/v1)?\/rankings/, "/api/rankings");
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, apikey, x-client-info" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const res = (await api(new Request(url, req))) ?? new Response("Not found", { status: 404 });
  const out = new Response(res.body, res);
  Object.entries(cors).forEach(([k, v]) => out.headers.set(k, v));
  return out;
});
