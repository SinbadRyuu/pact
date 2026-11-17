// The Indicators API as one Fetch-style handler, mounted at /api/indicators/*.
//
//   GET  /api/indicators?platform=mt5&q=gold    cards (no file links), with `locked` worked out for the caller
//   GET  /api/indicators/:slug                  detail page data
//   POST /api/indicators/:slug/download         checks access, counts the download, returns { url } to open
//
// Download/TradingView links are only handed out by the POST, after the access check, so a members-only file
// is never in the page source for someone who isn't allowed it.
import type { SignFile } from "./files";
import type { IndicatorStore } from "./store";
import type { AuthUser, GetUser, IndicatorRecord, Platform } from "./types";

export interface IndicatorsApiDeps {
  store: IndicatorStore;
  getUser: GetUser;
  signFile: SignFile;
  /** members = signed in (default), or signed in AND subscribed when this is set (see INDICATORS_MEMBERS_REQUIRE_SUBSCRIPTION). */
  isSubscriber?: (user: AuthUser) => Promise<boolean>;
  basePath?: string;
  log?: (msg: string, extra?: unknown) => void;
}

export type LockReason = "sign_in" | "subscribe" | null;

export interface IndicatorSummary {
  slug: string;
  name: string;
  description: string;
  platform: Platform;
  version: string;
  image: string | null;
  accessLevel: IndicatorRecord["accessLevel"];
  updatedAt: string;
  downloadCount: number;
  /** What the button does: download a file, or open the TradingView script page. */
  action: "download" | "tradingview";
  locked: boolean;
  lockReason: LockReason;
}

export interface IndicatorDetail extends IndicatorSummary {
  longDescription: string | null;
  screenshots: string[];
  installSteps: string[];
  changelog: IndicatorRecord["changelog"];
}

export const PLATFORMS: Platform[] = ["tradingview", "mt4", "mt5"];

/** Install steps used when an indicator doesn't have its own. */
export function defaultInstallSteps(p: Platform): string[] {
  if (p === "tradingview") {
    return [
      "Tap Get on TradingView and sign in to your TradingView account.",
      "On the script page, tap Add to favorites (the star).",
      "Open any chart, tap Indicators, then Favorites, and pick the indicator.",
      "Open its settings (the cog) to change colours or inputs.",
    ];
  }
  const v = p === "mt4" ? "4" : "5";
  return [
    `Download the file on a computer. Custom indicators need MetaTrader ${v} desktop; the phone app can't load them.`,
    `In MetaTrader ${v}, go to File → Open Data Folder → MQL${v} → Indicators and copy the file in.`,
    "Back in MetaTrader, right-click Indicators in the Navigator and choose Refresh (or restart MetaTrader).",
    "Drag the indicator onto a chart and press OK. Change its inputs any time from the chart's Indicators list.",
  ];
}

const json = (body: unknown, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache } });

export function createIndicatorsApi(deps: IndicatorsApiDeps) {
  const base = (deps.basePath ?? "/api/indicators").replace(/\/+$/, "");

  async function lockFor(rec: IndicatorRecord, user: AuthUser | null, sub: () => Promise<boolean>): Promise<LockReason> {
    if (rec.accessLevel === "free") return null;
    if (!user) return "sign_in";
    if (deps.isSubscriber && !(await sub())) return "subscribe";
    return null;
  }

  /** Memoised per request so a list of 30 cards makes one subscription lookup, not 30. */
  const subscriberCheck = (user: AuthUser | null) => {
    let p: Promise<boolean> | null = null;
    return () => (p ??= user && deps.isSubscriber ? deps.isSubscriber(user) : Promise.resolve(false));
  };

  async function summary(rec: IndicatorRecord, user: AuthUser | null, sub: () => Promise<boolean>): Promise<IndicatorSummary> {
    const lockReason = await lockFor(rec, user, sub);
    return {
      slug: rec.slug,
      name: rec.name,
      description: rec.description,
      platform: rec.platform,
      version: rec.version,
      image: rec.image,
      accessLevel: rec.accessLevel,
      updatedAt: rec.updatedAt,
      downloadCount: rec.downloadCount,
      action: rec.platform === "tradingview" && rec.tradingviewUrl ? "tradingview" : "download",
      locked: lockReason !== null,
      lockReason,
    };
  }

  return async function handle(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith(base)) return null;
    const parts = url.pathname.slice(base.length).split("/").filter(Boolean).map(decodeURIComponent);
    const method = req.method.toUpperCase();

    try {
      const user = await deps.getUser(req);
      const sub = subscriberCheck(user);

      if (method === "GET" && parts.length === 0) {
        const platform = url.searchParams.get("platform");
        const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
        let list = await deps.store.list();
        if (platform && (PLATFORMS as string[]).includes(platform)) list = list.filter((x) => x.platform === platform);
        if (q) list = list.filter((x) => `${x.name} ${x.description} ${x.platform}`.toLowerCase().includes(q));
        return json({ indicators: await Promise.all(list.map((r) => summary(r, user, sub))) }, 200, "private, max-age=30");
      }

      if (method === "GET" && parts.length === 1) {
        const rec = await deps.store.bySlug(parts[0]);
        if (!rec) return json({ error: "not_found" }, 404);
        const detail: IndicatorDetail = {
          ...(await summary(rec, user, sub)),
          longDescription: rec.longDescription,
          screenshots: rec.screenshots,
          installSteps: rec.installSteps.length ? rec.installSteps : defaultInstallSteps(rec.platform),
          changelog: rec.changelog,
        };
        return json(detail, 200, "private, max-age=30");
      }

      if (method === "POST" && parts.length === 2 && parts[1] === "download") {
        const rec = await deps.store.bySlug(parts[0]);
        if (!rec) return json({ error: "not_found" }, 404);
        const lock = await lockFor(rec, user, sub);
        if (lock === "sign_in") return json({ error: "sign_in_required" }, 401);
        if (lock === "subscribe") return json({ error: "subscription_required" }, 403);

        const target = rec.platform === "tradingview" && rec.tradingviewUrl ? rec.tradingviewUrl : rec.fileUrl ?? rec.tradingviewUrl;
        if (!target) return json({ error: "no_file" }, 404);
        const link = await deps.signFile(target);
        const downloadCount = await deps.store.recordDownload(rec.id, user?.id ?? null);
        return json({ url: link, downloadCount });
      }

      return json({ error: "not_found" }, 404);
    } catch (err) {
      deps.log?.(`indicators api error ${method} ${url.pathname}`, err);
      return json({ error: "server_error" }, 500);
    }
  };
}
