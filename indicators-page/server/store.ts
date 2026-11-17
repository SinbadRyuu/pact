// Reads indicators and records downloads. Postgres for production, in-memory for tests and the preview.
import type { IndicatorRecord, Sql } from "./types";

export interface IndicatorStore {
  /** Published indicators, in display order. */
  list(): Promise<IndicatorRecord[]>;
  bySlug(slug: string): Promise<IndicatorRecord | null>;
  /** Adds one to the total and logs who downloaded. Returns the new total. */
  recordDownload(id: string, userId: string | null): Promise<number>;
}

interface Row {
  id: string;
  slug: string;
  name: string;
  description: string;
  long_description: string | null;
  platform: IndicatorRecord["platform"];
  version: string;
  image: string | null;
  screenshots: string[] | null;
  install_steps: string[] | null;
  changelog: unknown;
  file_url: string | null;
  tradingview_url: string | null;
  access_level: IndicatorRecord["accessLevel"];
  sort_order: number;
  download_count: string | number;
  updated_at: Date | string;
}

const toRecord = (r: Row): IndicatorRecord => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  description: r.description,
  longDescription: r.long_description,
  platform: r.platform,
  version: r.version,
  image: r.image,
  screenshots: r.screenshots ?? [],
  installSteps: r.install_steps ?? [],
  changelog: Array.isArray(r.changelog) ? (r.changelog as IndicatorRecord["changelog"]) : [],
  fileUrl: r.file_url,
  tradingviewUrl: r.tradingview_url,
  accessLevel: r.access_level,
  sortOrder: r.sort_order,
  downloadCount: Number(r.download_count),
  updatedAt: new Date(r.updated_at).toISOString(),
});

const COLS = `id::text, slug, name, description, long_description, platform, version, image, screenshots, install_steps,
  changelog, file_url, tradingview_url, access_level, sort_order, download_count, updated_at`;

export function createPgIndicatorStore(sql: Sql): IndicatorStore {
  return {
    async list() {
      const rows = await sql.query<Row>(
        `select ${COLS} from public.indicators where published order by sort_order, updated_at desc, name`,
      );
      return rows.map(toRecord);
    },
    async bySlug(slug) {
      const rows = await sql.query<Row>(`select ${COLS} from public.indicators where published and slug = $1`, [slug]);
      return rows[0] ? toRecord(rows[0]) : null;
    },
    async recordDownload(id, userId) {
      // One statement: the counter update and the log insert happen together and the increment is atomic.
      const rows = await sql.query<{ download_count: string }>(
        `with bump as (
           update public.indicators set download_count = download_count + 1 where id = $1::uuid returning id, download_count
         ), log as (
           insert into public.indicator_downloads (indicator_id, user_id) select id, $2 from bump
         )
         select download_count from bump`,
        [id, userId],
      );
      return Number(rows[0]?.download_count ?? 0);
    },
  };
}

export function createMemoryIndicatorStore(seed: IndicatorRecord[]): IndicatorStore & { log: { id: string; userId: string | null }[] } {
  const items = seed.map((x) => ({ ...x }));
  const log: { id: string; userId: string | null }[] = [];
  return {
    log,
    async list() {
      return [...items].sort((a, b) => a.sortOrder - b.sortOrder || b.updatedAt.localeCompare(a.updatedAt));
    },
    async bySlug(slug) {
      return items.find((x) => x.slug === slug) ?? null;
    },
    async recordDownload(id, userId) {
      const it = items.find((x) => x.id === id);
      if (!it) return 0;
      it.downloadCount++;
      log.push({ id, userId });
      return it.downloadCount;
    },
  };
}
