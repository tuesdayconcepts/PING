import jwt from "jsonwebtoken";
import { query } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

export function signAdminToken(adminId: string): string {
  return jwt.sign({ adminId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAdminToken(token: string | undefined): { adminId: string } {
  if (!token) throw new Error("UNAUTHORIZED");
  return jwt.verify(token, JWT_SECRET) as { adminId: string };
}

export function getBearerToken(
  header: string | null | undefined
): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice(7);
}

export type AdminRow = { id: string; username: string; role: string; password: string };

export async function getAdminById(
  id: string
): Promise<AdminRow | null> {
  const r = await query<AdminRow>(
    `select id, username, role, password from admins where id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function getAdminByUsername(
  username: string
): Promise<AdminRow | null> {
  const r = await query<AdminRow>(
    `select id, username, role, password from admins where username = $1`,
    [username]
  );
  return r.rows[0] ?? null;
}
