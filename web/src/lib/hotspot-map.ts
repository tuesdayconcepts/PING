import type { QueryResultRow } from "pg";
import { serializeBigInts } from "./serialize";

/** DB row (snake_case) → API object (camelCase) like legacy Prisma. */
export function hotspotFromRow(row: QueryResultRow) {
  const o = {
    id: row.id,
    title: row.title,
    description: row.description,
    lat: row.lat,
    lng: row.lng,
    prize: row.prize,
    startDate: row.start_date,
    endDate: row.end_date,
    active: row.active,
    imageUrl: row.image_url,
    privateKey: row.private_key,
    claimStatus: row.claim_status,
    claimedBy: row.claimed_by,
    claimedAt: row.claimed_at,
    tweetUrl: row.tweet_url,
    queuePosition: row.queue_position,
    locationName: row.location_name,
    shareToken: row.share_token,
    prizePrivateKeyEnc: row.prize_private_key_enc,
    prizePublicKey: row.prize_public_key,
    prizeAmountLamports: row.prize_amount_lamports,
    fundStatus: row.fund_status,
    fundTxSig: row.fund_tx_sig,
    fundedAt: row.funded_at,
    walletCreatedAt: row.wallet_created_at,
    hint1: row.hint1,
    hint2: row.hint2,
    hint3: row.hint3,
    hint1PriceUsd: row.hint1_price_usd,
    hint2PriceUsd: row.hint2_price_usd,
    hint3PriceUsd: row.hint3_price_usd,
    firstHintFree: row.first_hint_free,
    claimType: row.claim_type,
    proximityRadius: row.proximity_radius,
    proximityCheckHistory: row.proximity_check_history,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return serializeBigInts(o) as Record<string, unknown>;
}
