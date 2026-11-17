// Server types for the Indicators page. Framework-free: runs on Supabase Edge Functions, Vercel, Next.js or Node.

export interface AuthUser {
  id: string;
  email?: string | null;
}
export type GetUser = (req: Request) => Promise<AuthUser | null>;

/** Run a parameterised SQL query, get rows back (pg Pool, postgres.js, Prisma $queryRawUnsafe… see README). */
export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export type Platform = "tradingview" | "mt4" | "mt5";
export type AccessLevel = "free" | "members";

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

/** A row of `public.indicators`. `fileUrl` and `tradingviewUrl` never leave the server directly. */
export interface IndicatorRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string | null;
  platform: Platform;
  version: string;
  image: string | null;
  screenshots: string[];
  installSteps: string[];
  changelog: ChangelogEntry[];
  fileUrl: string | null;
  tradingviewUrl: string | null;
  accessLevel: AccessLevel;
  sortOrder: number;
  downloadCount: number;
  updatedAt: string;
}
