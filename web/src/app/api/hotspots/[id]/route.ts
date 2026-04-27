import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { query } from "@/lib/db";
import { decrypt } from "@/lib/crypto-ping";
import { base58Encode } from "@/lib/base58";
import { hotspotFromRow } from "@/lib/hotspot-map";
import { serializeBigInts } from "@/lib/serialize";
import {
  roundCoordinate,
  sanitizeString,
  validateCoordinates,
  validateDates,
} from "@/lib/validation";
import { getLocationName } from "@/lib/geocoding";
import { solToLamports } from "@/lib/solana";
import { logAdminAction } from "@/lib/admin-log";
import { getClientIp } from "@/lib/request-ip";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const r = await query(`select * from hotspots where id = $1`, [id]);
    if (r.rows.length === 0) {
      return NextResponse.json({ error: "Hotspot not found" }, { status: 404 });
    }
    const row = r.rows[0]!;
    const requesterIp = getClientIp(req);
    const claimedBy = row.claimed_by as string | null;
    const isClaimer =
      Boolean(claimedBy && requesterIp && claimedBy === requesterIp);
    const base: Record<string, unknown> = hotspotFromRow(
      row
    ) as Record<string, unknown>;

    if (row.claim_status === "claimed" && isClaimer) {
      let revealedKey: string | null = null;
      try {
        if (row.prize_private_key_enc) {
          const b64 = decrypt(String(row.prize_private_key_enc));
          revealedKey = base58Encode(new Uint8Array(Buffer.from(b64, "base64")));
        } else if (row.private_key) {
          const b64 = decrypt(String(row.private_key));
          revealedKey = base58Encode(new Uint8Array(Buffer.from(b64, "base64")));
        }
      } catch (e) {
        console.error("Decrypt key for claimer:", (e as Error).message);
      }
      base.privateKey = revealedKey;
    } else {
      base.privateKey = null;
    }

    return NextResponse.json(serializeBigInts(base));
  } catch (e) {
    console.error("Get hotspot error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const authRes = requireAdmin(req);
  if (authRes instanceof NextResponse) return authRes;
  const { adminId } = authRes;
  const { id } = await ctx.params;

  try {
    const existingR = await query(`select * from hotspots where id = $1`, [id]);
    if (existingR.rows.length === 0) {
      return NextResponse.json({ error: "Hotspot not found" }, { status: 404 });
    }
    const existing = existingR.rows[0]!;
    const isLocked =
      existing.claim_status === "pending" || existing.claim_status === "claimed";

    const body = (await req.json()) as Record<string, unknown>;
    const {
      title,
      lat,
      lng,
      prize,
      startDate: startDateRaw,
      endDate: endDateRaw,
      active,
      imageUrl,
      hint1,
      hint2,
      hint3,
      hint1PriceUsd,
      hint2PriceUsd,
      hint3PriceUsd,
      firstHintFree,
      proximityRadius,
    } = body;

    if (lat !== undefined && lng !== undefined) {
      if (!validateCoordinates(Number(lat), Number(lng))) {
        return NextResponse.json(
          { error: "Invalid coordinates (lat: -90 to 90, lng: -180 to 180)" },
          { status: 400 }
        );
      }
    }
    if (startDateRaw && endDateRaw) {
      if (!validateDates(String(startDateRaw), String(endDateRaw))) {
        return NextResponse.json(
          { error: "Start date must be before end date" },
          { status: 400 }
        );
      }
    }

    const roundedLat =
      lat !== undefined ? roundCoordinate(parseFloat(String(lat))) : undefined;
    const roundedLng =
      lng !== undefined ? roundCoordinate(parseFloat(String(lng))) : undefined;

    let locationName: string | null | undefined;
    if (roundedLat !== undefined && roundedLng !== undefined) {
      locationName = await getLocationName(roundedLat, roundedLng);
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    let n = 1;
    const push = (col: string, val: unknown) => {
      sets.push(`${col} = $${n++}`);
      vals.push(val);
    };

    if (title) push("title", sanitizeString(String(title)));
    if (!isLocked) {
      if (roundedLat !== undefined) push("lat", roundedLat);
      if (roundedLng !== undefined) push("lng", roundedLng);
      if (prize !== undefined) {
        const prizeNum = prize ? parseFloat(String(prize)) : 0;
        push("prize", prize ? parseFloat(String(prize)) : null);
        push(
          "prize_amount_lamports",
          solToLamports(Number.isFinite(prizeNum) ? prizeNum : 0)
        );
        if (existing.claim_status === "unclaimed") {
          push("fund_status", "pending");
          push("fund_tx_sig", null);
          push("funded_at", null);
        }
      }
      if (startDateRaw) push("start_date", new Date(String(startDateRaw)));
      if (endDateRaw) push("end_date", new Date(String(endDateRaw)));
      if (locationName !== undefined) push("location_name", locationName);
    }
    if (active !== undefined) push("active", Boolean(active));
    if (imageUrl !== undefined)
      push("image_url", imageUrl ? sanitizeString(String(imageUrl)) : null);
    if (hint1 !== undefined)
      push("hint1", hint1 ? sanitizeString(String(hint1)) : null);
    if (hint2 !== undefined)
      push("hint2", hint2 ? sanitizeString(String(hint2)) : null);
    if (hint3 !== undefined)
      push("hint3", hint3 ? sanitizeString(String(hint3)) : null);
    if (hint1PriceUsd !== undefined)
      push(
        "hint1_price_usd",
        hint1PriceUsd ? parseFloat(String(hint1PriceUsd)) : null
      );
    if (hint2PriceUsd !== undefined)
      push(
        "hint2_price_usd",
        hint2PriceUsd ? parseFloat(String(hint2PriceUsd)) : null
      );
    if (hint3PriceUsd !== undefined)
      push(
        "hint3_price_usd",
        hint3PriceUsd ? parseFloat(String(hint3PriceUsd)) : null
      );
    if (firstHintFree !== undefined)
      push("first_hint_free", Boolean(firstHintFree));
    if (
      proximityRadius !== undefined &&
      existing.claim_type === "proximity"
    ) {
      push("proximity_radius", parseFloat(String(proximityRadius)));
    }

    if (sets.length === 0) {
      return NextResponse.json(
        hotspotFromRow(existing),
        { status: 200 }
      );
    }

    vals.push(id);
    const sql = `update hotspots set ${sets.join(", ")} where id = $${n} returning *`;
    const up = await query(sql, vals);
    const row = up.rows[0]!;
    const hotspot = hotspotFromRow(row);
    await logAdminAction(
      adminId,
      "UPDATE",
      "Hotspot",
      id,
      `Updated hotspot: ${(hotspot as { title: string }).title}`
    );
    return NextResponse.json(serializeBigInts(hotspot));
  } catch (e) {
    console.error("Update hotspot error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const authRes = requireAdmin(req);
  if (authRes instanceof NextResponse) return authRes;
  const { adminId } = authRes;
  const { id } = await ctx.params;

  try {
    const ex = await query(`select title from hotspots where id = $1`, [id]);
    if (ex.rows.length === 0) {
      return NextResponse.json({ error: "Hotspot not found" }, { status: 404 });
    }
    const title = ex.rows[0]!.title as string;
    await query(`delete from hotspots where id = $1`, [id]);
    await logAdminAction(
      adminId,
      "DELETE",
      "Hotspot",
      id,
      `Deleted hotspot: ${title}`
    );
    return NextResponse.json({ message: "Hotspot deleted successfully" });
  } catch (e) {
    console.error("Delete hotspot error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
