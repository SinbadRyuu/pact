// Supabase Edge Function that serves /api/automation/* (deploy: supabase functions deploy automation --no-verify-jwt).
// --no-verify-jwt matters: Stripe's webhook calls carry no Supabase JWT. Every other route checks the user itself.
//
// Secrets: supabase secrets set STRIPE_SECRET_KEY=… STRIPE_WEBHOOK_SECRET=… (see automation/.env.example for the full list).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_DB_URL are provided by Supabase automatically.
import postgres from "npm:postgres@3.4.5";
import { createAutomationApiFromEnv, supabaseGetUser } from "./automation-api.js";

const env = Deno.env.toObject();
const db = postgres(env.SUPABASE_DB_URL, { prepare: false });
const api = createAutomationApiFromEnv(
  env,
  { query: (text: string, params: unknown[] = []) => db.unsafe(text, params as never[]) as never },
  supabaseGetUser({ supabaseUrl: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY }),
);

// Supabase serves functions at /functions/v1/automation/…; rewrite to the router's /api/automation/… paths.
Deno.serve(async (req) => {
  const url = new URL(req.url);
  url.pathname = url.pathname.replace(/^(\/functions\/v1)?\/automation/, "/api/automation");
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
