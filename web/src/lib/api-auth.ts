import { NextResponse } from "next/server";
import { getBearerToken, verifyAdminToken } from "./auth-jwt";

/** Resolves admin id from Authorization header, or 401 response. */
export function requireAdmin(req: Request) {
  try {
    const token = getBearerToken(req.headers.get("authorization"));
    const { adminId } = verifyAdminToken(token);
    return { adminId } as const;
  } catch {
    return NextResponse.json(
      { error: "Unauthorized: Invalid token" },
      { status: 401 }
    );
  }
}
