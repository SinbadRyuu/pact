// Supabase Edge Function that serves /api/indicators/* (deploy: supabase functions deploy indicators --no-verify-jwt).
// Visitors who aren't signed in must be able to browse, so the gateway JWT check is off; members-only downloads are
// checked here per request. SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_URL are
// provided by Supabase. Optional secret: INDICATORS_MEMBERS_REQUIRE_SUBSCRIPTION=true.
import postgres from "npm:postgres@3.4.5";
import { createIndicatorsApiFromEnv, supabaseGetUser } from "./indicators-api.js";

const env = Deno.env.toObject();
const db = postgres(env.SUPABASE_DB_URL, { prepare: false });
const api = createIndicatorsApiFromEnv(
  env,
  { query: (text: string, params: unknown[] = []) => db.unsafe(text, params as never[]) as never },
  supabaseGetUser({ supabaseUrl: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY }),
);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  url.pathname = url.pathname.replace(/^(\/functions\/v1)?\/indicators/, "/api/indicators");
  const cors = {
    "access-control-allow-origin": env.SITE_URL ?? "*",
    "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const res = (await api(new Request(url, req))) ?? new Response("Not found", { status: 404 });
  const out = new Response(res.body, res);
  Object.entries(cors).forEach(([k, v]) => out.headers.set(k, v));
  return out;
});
