import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { query } from "@/lib/db";
import { hotspotFromRow } from "@/lib/hotspot-map";
import { serializeBigInts } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  const authRes = requireAdmin(req);
  if (authRes instanceof NextResponse) return authRes;

  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10) || 10;
    const offset = parseInt(searchParams.get("offset") || "0", 10) || 0;
    const [hsR, countR] = await Promise.all([
      query(
        `select * from hotspots where claim_status = 'claimed' order by claimed_at desc nulls last limit $1 offset $2`,
        [limit, offset]
      ),
      query(
        `select count(*)::int as c from hotspots where claim_status = 'claimed'`
      ),
    ]);
    const total = countR.rows[0]!.c as number;
    return NextResponse.json(
      serializeBigInts({
        hotspots: hsR.rows.map((row) => hotspotFromRow(row)),
        total,
        hasMore: offset + limit < total,
        limit,
        offset,
      })
    );
  } catch (e) {
    console.error("Get claimed hotspots error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
