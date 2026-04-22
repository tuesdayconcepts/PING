-- Migration: Add prize wallet & funding fields; add TreasuryTransferLog

-- Enum for funding status
DO $$ BEGIN
  CREATE TYPE "FundStatus" AS ENUM ('pending', 'success', 'failed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Extend Hotspot with automated funding fields
ALTER TABLE "Hotspot"
  ADD COLUMN IF NOT EXISTS "prizePrivateKeyEnc" TEXT,
  ADD COLUMN IF NOT EXISTS "prizePublicKey" TEXT,
  ADD COLUMN IF NOT EXISTS "prizeAmountLamports" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fundStatus" "FundStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "fundTxSig" TEXT,
  ADD COLUMN IF NOT EXISTS "fundedAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "walletCreatedAt" TIMESTAMP;

-- TreasuryTransferLog table
CREATE TABLE IF NOT EXISTS "TreasuryTransferLog" (
  "id" TEXT PRIMARY KEY,
  "hotspotId" TEXT NOT NULL,
  "lamports" BIGINT NOT NULL,
  "type" TEXT NOT NULL,
  "txSig" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "TreasuryTransferLog_hotspot_fkey"
    FOREIGN KEY ("hotspotId") REFERENCES "Hotspot"("id") ON DELETE CASCADE
);

-- Indexes and idempotency constraint
CREATE INDEX IF NOT EXISTS "TreasuryTransferLog_hotspot_idx"
  ON "TreasuryTransferLog" ("hotspotId");

DO $$ BEGIN
  ALTER TABLE "TreasuryTransferLog"
    ADD CONSTRAINT "TreasuryTransferLog_hotspot_type_unique" UNIQUE ("hotspotId", "type");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


