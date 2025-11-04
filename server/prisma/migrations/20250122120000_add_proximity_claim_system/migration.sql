-- AlterTable
ALTER TABLE "Hotspot" ADD COLUMN "claimType" TEXT NOT NULL DEFAULT 'nfc',
ADD COLUMN "proximityRadius" DOUBLE PRECISION,
ADD COLUMN "proximityCheckHistory" JSONB;

