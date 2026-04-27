import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { validateProximityClaim } from "@/lib/proximityVerify";
import { getClientIp } from "@/lib/request-ip";
import { checkHotspotClaimRateLimit } from "@/lib/claim-rate-limit";
import type { QueryResultRow } from "pg";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      tweetUrl?: string;
      userLat?: number;
      userLng?: number;
    };
    const { tweetUrl, userLat, userLng } = body;

    const h = await query<QueryResultRow>(`select * from hotspots where id = $1`, [id]);
    if (h.rows.length === 0) {
      return NextResponse.json({ error: "Hotspot not found" }, { status: 404 });
    }
    const hotspot = h.rows[0]!;

    if (hotspot.claim_status !== "unclaimed") {
      return NextResponse.json(
        { error: `This hotspot is already ${hotspot.claim_status}` },
        { status: 400 }
      );
    }

    const userIp = getClientIp(req);
    const rateKey = `${userIp}:${id}`;
    const rl = await checkHotspotClaimRateLimit(rateKey);
    if (!rl.ok) {
      return NextResponse.json(
        {
          error:
            "You have already attempted to claim this ping. Please wait before trying again.",
        },
        { status: 429 }
      );
    }

    if (hotspot.claim_type === "proximity") {
      if (userLat === undefined || userLng === undefined) {
        return NextResponse.json(
          {
            error:
              "Location coordinates are required for proximity claims. Please enable GPS and try again.",
          },
          { status: 400 }
        );
      }
      const history = hotspot.proximity_check_history
        ? (hotspot.proximity_check_history as Array<{
            lat: number;
            lng: number;
            timestamp: number;
            ip?: string;
          }>)
        : [];
      const now = Date.now();
      const validation = validateProximityClaim(
        userLat,
        userLng,
        {
          lat: hotspot.lat as number,
          lng: hotspot.lng as number,
          proximityRadius: hotspot.proximity_radius as number | null,
          claimType: String(hotspot.claim_type),
        },
        history
      );
      if (!validation.valid) {
        const updatedHistory = [
          ...history.slice(-9),
          { lat: userLat, lng: userLng, timestamp: now, ip: userIp },
        ];
        await query(
          `update hotspots set proximity_check_history = $2::jsonb where id = $1`,
          [id, JSON.stringify(updatedHistory)]
        );
        return NextResponse.json(
          {
            error:
              validation.error || "You are too far from the ping location.",
            distance: validation.distance,
            suspicious: validation.suspicious,
          },
          { status: 400 }
        );
      }
      const updatedHistory = [
        ...history.slice(-9),
        { lat: userLat, lng: userLng, timestamp: now, ip: userIp },
      ];
      await query(
        `update hotspots set proximity_check_history = $2::jsonb where id = $1`,
        [id, JSON.stringify(updatedHistory)]
      );
    }

    const claimedBy = userIp;
    await query(
      `update hotspots set
         claim_status = 'pending',
         claimed_by = $2,
         claimed_at = $3,
         tweet_url = $4
       where id = $1`,
      [id, claimedBy, new Date(), tweetUrl || null]
    );

    // Push notifications: optional; omitted in v1 of Next port (enable later)

    return NextResponse.json({
      success: true,
      message: "Claim submitted! Waiting for admin approval.",
      status: "pending",
    });
  } catch (e) {
    console.error("Claim hotspot error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
