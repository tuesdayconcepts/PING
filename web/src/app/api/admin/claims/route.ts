import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { query } from "@/lib/db";
import { hotspotFromRow } from "@/lib/hotspot-map";
import { serializeBigInts } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  const authRes = requireAdmin(req);
  if (authRes instanceof NextResponse) return authRes;

  try {
    const r = await query(
      `select * from hotspots where claim_status = 'pending' order by claimed_at asc nulls last`
    );
    return NextResponse.json(serializeBigInts(r.rows.map((row) => hotspotFromRow(row))));
  } catch (e) {
    console.error("Get pending claims error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
