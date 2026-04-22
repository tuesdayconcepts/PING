-- Remove default hint price columns from HintSettings
-- Prices are now configured per-hotspot only

ALTER TABLE "HintSettings" DROP COLUMN IF EXISTS "defaultHint1Usd";
ALTER TABLE "HintSettings" DROP COLUMN IF EXISTS "defaultHint2Usd";
ALTER TABLE "HintSettings" DROP COLUMN IF EXISTS "defaultHint3Usd";

