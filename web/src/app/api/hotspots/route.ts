import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getBearerToken, verifyAdminToken } from "@/lib/auth-jwt";
import { query } from "@/lib/db";
import { encrypt } from "@/lib/crypto-ping";
import { getLocationName } from "@/lib/geocoding";
import { generatePrizeWallet, solToLamports } from "@/lib/solana";
import { requireAdmin } from "@/lib/api-auth";
import { hotspotFromRow } from "@/lib/hotspot-map";
import { serializeBigInts } from "@/lib/serialize";
import {
  roundCoordinate,
  sanitizeString,
  validateCoordinates,
} from "@/lib/validation";
import { logAdminAction } from "@/lib/admin-log";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const isAdmin = searchParams.get("admin") === "true";
    const token = getBearerToken(req.headers.get("authorization"));
    let includeInactive = false;
    if (isAdmin && token) {
      try {
        verifyAdminToken(token);
        includeInactive = true;
      } catch {
        // invalid token: public only
      }
    }

    const where = includeInactive
      ? `claim_status <> 'claimed'`
      : `active = true and claim_status <> 'claimed'`;

    const r = await query(
      `select * from hotspots where ${where}
       order by active desc, created_at desc`
    );
    return NextResponse.json(serializeBigInts(r.rows.map((row) => hotspotFromRow(row))));
  } catch (e) {
    console.error("Get hotspots error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authRes = requireAdmin(req);
  if (authRes instanceof NextResponse) return authRes;
  const { adminId } = authRes;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const {
      title,
      lat,
      lng,
      prize,
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
      claimType,
      proximityRadius,
    } = body;

    if (title == null || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: "Title, latitude, and longitude are required" },
        { status: 400 }
      );
    }
    if (!validateCoordinates(Number(lat), Number(lng))) {
      return NextResponse.json(
        { error: "Invalid coordinates (lat: -90 to 90, lng: -180 to 180)" },
        { status: 400 }
      );
    }

    const startDate = new Date();
    const finalEndDate = endDateRaw
      ? new Date(String(endDateRaw))
      : new Date(startDate.getTime() + 100 * 365 * 24 * 60 * 60 * 1000);

    const validClaimType =
      claimType === "proximity" || claimType === "nfc" ? claimType : "nfc";
    let finalProximity: number | null = null;
    if (validClaimType === "proximity") {
      if (proximityRadius !== undefined && proximityRadius !== null) {
        const r = parseFloat(String(proximityRadius));
        if (Number.isFinite(r) && r > 0 && r <= 100) finalProximity = r;
        else
          return NextResponse.json(
            { error: "Proximity radius must be between 0 and 100 meters" },
            { status: 400 }
          );
      } else {
        finalProximity = 5;
      }
    }

    const roundedLat = roundCoordinate(parseFloat(String(lat)));
    const roundedLng = roundCoordinate(parseFloat(String(lng)));
    const { publicKeyBase58, secretKeyBase64 } = generatePrizeWallet();
    const now = new Date();
    const prizeSol = prize ? parseFloat(String(prize)) : 0;
    const prizeAmountLamports = solToLamports(
      Number.isFinite(prizeSol) ? prizeSol : 0
    );
    const encryptedPrizeSecret = encrypt(secretKeyBase64);
    const locationName = await getLocationName(roundedLat, roundedLng);
    const shareToken = crypto.randomUUID();
    const id = crypto.randomUUID();

    const ins = await query(
      `insert into hotspots (
        id, title, description, lat, lng, prize, start_date, end_date, active, image_url,
        private_key, claim_status, queue_position, location_name, share_token,
        prize_private_key_enc, prize_public_key, prize_amount_lamports, fund_status, wallet_created_at,
        hint1, hint2, hint3, hint1_price_usd, hint2_price_usd, hint3_price_usd, first_hint_free,
        claim_type, proximity_radius
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        null, 'unclaimed', 0, $11, $12,
        $13, $14, $15, 'pending', $16,
        $17, $18, $19, $20, $21, $22, $23,
        $24, $25
      ) returning *`,
      [
        id,
        sanitizeString(String(title)),
        "",
        roundedLat,
        roundedLng,
        prize ? parseFloat(String(prize)) : null,
        startDate,
        finalEndDate,
        active !== undefined ? Boolean(active) : true,
        imageUrl ? sanitizeString(String(imageUrl)) : null,
        locationName,
        shareToken,
        encryptedPrizeSecret,
        publicKeyBase58,
        prizeAmountLamports,
        now,
        hint1 ? sanitizeString(String(hint1)) : null,
        hint2 ? sanitizeString(String(hint2)) : null,
        hint3 ? sanitizeString(String(hint3)) : null,
        hint1PriceUsd ? parseFloat(String(hint1PriceUsd)) : null,
        hint2PriceUsd ? parseFloat(String(hint2PriceUsd)) : null,
        hint3PriceUsd ? parseFloat(String(hint3PriceUsd)) : null,
        firstHintFree === true,
        validClaimType,
        finalProximity,
      ]
    );
    const row = ins.rows[0]!;
    const hotspot = hotspotFromRow(row);
    await logAdminAction(
      adminId,
      "CREATE",
      "Hotspot",
      String((hotspot as { id: string }).id),
      `Created hotspot: ${(hotspot as { title: string }).title}`
    );
    return NextResponse.json(serializeBigInts(hotspot), { status: 201 });
  } catch (e) {
    console.error("Create hotspot error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
