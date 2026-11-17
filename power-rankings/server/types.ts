// Server-only types. Framework-free: the same code runs on Supabase Edge Functions, Vercel, Next.js or Node.
export interface AuthUser {
  id: string;
  email?: string | null;
}
export type GetUser = (req: Request) => Promise<AuthUser | null>;

/** Run a parameterised SQL query, get rows back (pg Pool, postgres.js, Prisma $queryRawUnsafe…). */
export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}
