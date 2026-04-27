import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { query } from "@/lib/db";
import { decrypt } from "@/lib/crypto-ping";
import { base58Encode } from "@/lib/base58";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const authRes = requireAdmin(req);
  if (authRes instanceof NextResponse) return authRes;
  const { id } = await ctx.params;

  try {
    const r = await query(`select * from hotspots where id = $1`, [id]);
    if (r.rows.length === 0) {
      return NextResponse.json({ error: "Hotspot not found" }, { status: 404 });
    }
    const h = r.rows[0]!;
    if (h.claim_status !== "claimed") {
      return NextResponse.json(
        { error: "Hotspot not claimed yet" },
        { status: 400 }
      );
    }
    if (h.prize_private_key_enc) {
      const b64 = decrypt(String(h.prize_private_key_enc));
      const base58Key = base58Encode(new Uint8Array(Buffer.from(b64, "base64")));
      return NextResponse.json({ privateKey: base58Key, privateKeyBase64: b64 });
    }
    if (h.private_key) {
      const b64 = decrypt(String(h.private_key));
      const base58Key = base58Encode(new Uint8Array(Buffer.from(b64, "base64")));
      return NextResponse.json({ privateKey: base58Key, privateKeyBase64: b64 });
    }
    return NextResponse.json({ error: "Key unavailable" }, { status: 500 });
  } catch (e) {
    console.error("Admin get key error:", (e as Error).message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
