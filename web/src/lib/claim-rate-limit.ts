import { query } from "./db";

/** Enforces at most one claim attempt per (ip, hotspot) per hour (legacy behavior). */
export async function checkHotspotClaimRateLimit(
  key: string
): Promise<{ ok: boolean }> {
  const r = await query<{ count: number; reset_at: Date }>(
    `select count, reset_at from claim_rate_limit where key = $1`,
    [key]
  );
  const now = new Date();
  if (r.rows.length === 0) {
    await query(
      `insert into claim_rate_limit (key, count, reset_at) values ($1, 1, $2)`,
      [key, new Date(now.getTime() + 60 * 60 * 1000)]
    );
    return { ok: true };
  }
  const row = r.rows[0]!;
  if (row.reset_at < now) {
    await query(
      `update claim_rate_limit set count = 1, reset_at = $2 where key = $1`,
      [key, new Date(now.getTime() + 60 * 60 * 1000)]
    );
    return { ok: true };
  }
  if (row.count >= 1) {
    return { ok: false };
  }
  await query(
    `update claim_rate_limit set count = count + 1 where key = $1`,
    [key]
  );
  return { ok: true };
}
