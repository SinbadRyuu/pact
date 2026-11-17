// The old chart page now lives at /indicators. These paths get a permanent (301) redirect.
// Confirm the old address and add it here and in redirects/ if it isn't one of these.
export const LEGACY_CHART_PATHS = ["/chart", "/charts", "/app/chart", "/app/charts"] as const;

/**
 * 301 for the old chart URL(s), keeping any query string. Returns null for every other path.
 * Use it in edge middleware (Vercel / Next.js middleware) or any server in front of the SPA.
 */
export function legacyChartRedirect(req: Request, paths: readonly string[] = LEGACY_CHART_PATHS): Response | null {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (!paths.includes(path) && !paths.some((p) => path.startsWith(`${p}/`))) return null;
  return new Response(null, { status: 301, headers: { location: `/indicators${url.search}`, "cache-control": "public, max-age=86400" } });
}
