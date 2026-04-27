import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;

/** Connection pool (service role) — server-side only. */
export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (use Supabase connection string, pooler 6543 for serverless)");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      ssl: process.env.DATABASE_URL.includes("supabase")
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
) {
  const p = getPool();
  return p.query<T>(text, values);
}
