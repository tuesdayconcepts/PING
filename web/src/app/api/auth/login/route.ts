import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { getAdminByUsername, signAdminToken } from "@/lib/auth-jwt";
import { sanitizeString } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { username?: string; password?: string };
    const { username, password } = body;
    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password required" },
        { status: 400 }
      );
    }
    const admin = await getAdminByUsername(sanitizeString(username));
    if (!admin) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const token = signAdminToken(admin.id);
    return NextResponse.json({
      token,
      role: admin.role || "editor",
      username: admin.username,
    });
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
