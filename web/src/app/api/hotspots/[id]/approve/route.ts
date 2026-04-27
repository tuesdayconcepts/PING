import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getPool } from "@/lib/db";
import { decrypt } from "@/lib/crypto-ping";
import { base58Encode } from "@/lib/base58";
import { transferFromTreasury } from "@/lib/solana";
import type { QueryResultRow } from "pg";

type Ctx = { params: Promise<{ id: string }> };

function extractKey(locked: QueryResultRow): string | null {
  try {
    if (locked.prize_private_key_enc) {
      const b64 = decrypt(String(locked.prize_private_key_enc));
      return base58Encode(new Uint8Array(Buffer.from(b64, "base64")));
    }
    if (locked.private_key) {
      const b64 = decrypt(String(locked.private_key));
      return base58Encode(new Uint8Array(Buffer.from(b64, "base64")));
    }
  } catch (e) {
    console.error("reveal key after approve", (e as Error).message);
  }
  return null;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const authRes = requireAdmin(req);
  if (authRes instanceof NextResponse) return authRes;
  const { id } = await ctx.params;

  const client = await getPool().connect();
  let row: QueryResultRow;
  let alreadyFunded = false;
  let alreadySkipped = false;
  let alreadyProcessing = false;

  try {
    await client.query("begin");

    const hsR = await client.query(`select * from hotspots where id = $1 for update`, [id]);
    if (hsR.rows.length === 0) {
      await client.query("rollback");
      return NextResponse.json({ error: "Hotspot not found" }, { status: 404 });
    }
    const hs = hsR.rows[0]!;

    if (hs.fund_status === "success" && hs.fund_tx_sig) {
      alreadyFunded = true;
      row = hs;
      await client.query("commit");
    } else if (hs.fund_status === "skipped" && hs.claim_status === "claimed") {
      alreadySkipped = true;
      row = hs;
      await client.query("commit");
    } else {
      if (hs.claim_status !== "pending") {
        await client.query("rollback");
        return NextResponse.json(
          { error: "Hotspot is not pending approval" },
          { status: 400 }
        );
      }

      const logR = await client.query(
        `select * from treasury_transfer_logs
         where hotspot_id = $1 and type = 'funding' for update`,
        [id]
      );

      let log = logR.rows[0] as
        | { status: string; tx_sig: string | null; lamports: string | bigint }
        | undefined;

      if (!log) {
        const ins = await client.query(
          `insert into treasury_transfer_logs (hotspot_id, lamports, type, status, tx_sig)
           values ($1, $2, 'funding', 'pending', null)
           on conflict (hotspot_id, type) do nothing
           returning *`,
          [id, hs.prize_amount_lamports]
        );
        if (ins.rows[0]) {
          log = ins.rows[0] as typeof log;
        } else {
          const r2 = await client.query(
            `select * from treasury_transfer_logs where hotspot_id = $1 and type = 'funding'`,
            [id]
          );
          log = r2.rows[0] as typeof log;
        }
      }

      if (log && log.status === "success" && log.tx_sig) {
        alreadyFunded = true;
        row = hs;
        await client.query("commit");
      } else if (log && log.status === "processing") {
        alreadyProcessing = true;
        row = hs;
        await client.query("rollback");
      } else {
        await client.query(
          `update treasury_transfer_logs
           set status = 'processing' where hotspot_id = $1 and type = 'funding'`,
          [id]
        );
        row = hs;
        await client.query("commit");
      }
    }
  } catch (e) {
    try {
      await client.query("rollback");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }

  if (alreadyProcessing) {
    return NextResponse.json(
      { error: "Funding already in progress for this hotspot. Please wait." },
      { status: 409 }
    );
  }

  if (alreadyFunded) {
    return NextResponse.json({
      success: true,
      message: "Claim approved!",
      privateKey: extractKey(row!),
      fundStatus: "success",
      fundingSignature: row!.fund_tx_sig,
    });
  }
  if (alreadySkipped) {
    return NextResponse.json({
      success: true,
      message: "Claim approved!",
      privateKey: extractKey(row!),
      fundStatus: "skipped",
      fundingSignature: null,
    });
  }

  const locked = row!;
  const lamports = BigInt(String(locked.prize_amount_lamports || 0));
  let fundingSignature: string | null = null;
  let fundStatus: "success" | "skipped" | "failed" = "skipped";

  if (lamports > BigInt(0)) {
    const maxPerHotspotSol = parseFloat(
      process.env.MAX_PRIZE_PER_HOTSPOT_SOL || "1000"
    );
    const maxDailyOutSol = parseFloat(
      process.env.MAX_DAILY_TREASURY_OUT_SOL || "10000"
    );
    const prize = locked.prize as number | null;
    if (prize && prize > maxPerHotspotSol) {
      await getPool().query(
        `update treasury_transfer_logs set status = 'failed' where hotspot_id = $1 and type = 'funding'`,
        [id]
      );
      return NextResponse.json(
        {
          error: `Prize exceeds MAX_PRIZE_PER_HOTSPOT_SOL (${maxPerHotspotSol})`,
        },
        { status: 400 }
      );
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const logsR = await getPool().query(
      `select lamports from treasury_transfer_logs
       where created_at >= $1 and created_at <= $2 and status = 'success'`,
      [startOfDay, endOfDay]
    );
    let dailyOutLamports = BigInt(0);
    for (const l of logsR.rows) {
      dailyOutLamports += BigInt(String(l.lamports));
    }
    const outAfter = dailyOutLamports + lamports;
    const maxDailyLamports = BigInt(Math.round(maxDailyOutSol * 1_000_000_000));
    if (outAfter > maxDailyLamports) {
      await getPool().query(
        `update treasury_transfer_logs set status = 'failed' where hotspot_id = $1 and type = 'funding'`,
        [id]
      );
      return NextResponse.json(
        { error: "Daily treasury cap reached. Try again later." },
        { status: 429 }
      );
    }

    const toPk = String(locked.prize_public_key || "");
    if (!toPk) {
      return NextResponse.json({ error: "Prize public key missing" }, { status: 500 });
    }
    try {
      const { signature } = await transferFromTreasury({
        toPublicKey: toPk,
        lamports,
        timeoutMs: 20000,
      });
      fundingSignature = signature;
      fundStatus = "success";
      await getPool().query(
        `update treasury_transfer_logs set status = 'success', tx_sig = $2
         where hotspot_id = $1 and type = 'funding'`,
        [id, signature]
      );
      await getPool().query(
        `update hotspots set fund_status = 'success', fund_tx_sig = $2, funded_at = $3 where id = $1`,
        [id, signature, new Date()]
      );
    } catch (e) {
      console.error("[APPROVE] Funding failed", (e as Error).message);
      fundStatus = "failed";
      await getPool().query(
        `update treasury_transfer_logs set status = 'failed' where hotspot_id = $1 and type = 'funding'`,
        [id]
      );
      await getPool().query(
        `update hotspots set fund_status = 'failed' where id = $1`,
        [id]
      );
      return NextResponse.json(
        { error: "Funding failed", details: (e as Error).message },
        { status: 502 }
      );
    }
  } else {
    await getPool().query(
      `update treasury_transfer_logs set status = 'success', tx_sig = null
       where hotspot_id = $1 and type = 'funding'`,
      [id]
    );
    await getPool().query(
      `update hotspots set fund_status = 'skipped' where id = $1`,
      [id]
    );
  }

  await getPool().query(
    `update hotspots set claim_status = 'claimed' where id = $1`,
    [id]
  );

  if (locked.claimed_at) {
    const ms = Date.now() - new Date(locked.claimed_at as string).getTime();
    console.log(`[APPROVE] hotspot=${id} approvalDurationMs=${ms}`);
  }

  return NextResponse.json({
    success: true,
    message: "Claim approved!",
    privateKey: extractKey(locked),
    fundStatus,
    fundingSignature,
  });
}
