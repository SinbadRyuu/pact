// Runs a Fetch-style handler on plain Node (node:http / Express). Not needed on Vercel, Next.js, Deno or Supabase.
//   import { toNodeHandler } from "./server/node";
//   app.use(toNodeHandler(automationApi));   // Express: mount BEFORE express.json(), the webhook needs the raw body
import type { IncomingMessage, ServerResponse } from "node:http";

type FetchHandler = (req: Request) => Promise<Response | null>;

export function toNodeHandler(handler: FetchHandler) {
  return async (req: IncomingMessage, res: ServerResponse, next?: () => void) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const proto = (req.headers["x-forwarded-proto"] as string) ?? "http";
    const url = `${proto}://${req.headers.host ?? "localhost"}${req.url ?? "/"}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
      else if (v !== undefined) headers.set(k, v);
    }
    const request = new Request(url, {
      method: req.method,
      headers,
      body: body && req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
    });
    const response = await handler(request);
    if (!response) {
      if (next) return next();
      res.statusCode = 404;
      return res.end();
    }
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await response.arrayBuffer()));
  };
}
