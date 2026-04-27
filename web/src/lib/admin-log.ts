import { query } from "./db";

export async function logAdminAction(
  adminId: string,
  action: string,
  entity: string,
  entityId: string,
  details?: string
) {
  const a = await query<{ username: string }>(
    `select username from admins where id = $1`,
    [adminId]
  );
  const username = a.rows[0]?.username ?? null;
  await query(
    `insert into admin_logs (admin_id, username, action, entity, entity_id, details)
     values ($1, $2, $3, $4, $5, $6)`,
    [adminId, username, action, entity, entityId, details ?? null]
  );
}
