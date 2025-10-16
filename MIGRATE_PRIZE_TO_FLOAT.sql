-- Migration: Convert prize column from TEXT to DOUBLE PRECISION (Float)
-- Run this SQL on your Railway PostgreSQL database

-- Step 1: Add new temporary column
ALTER TABLE "Hotspot" ADD COLUMN "prize_temp" DOUBLE PRECISION;

-- Step 2: Copy and convert existing prize values
-- Converts numeric strings to floats, sets non-numeric to NULL
UPDATE "Hotspot" 
SET "prize_temp" = CASE 
  WHEN "prize" ~ '^[0-9]+\.?[0-9]*$' THEN CAST("prize" AS DOUBLE PRECISION)
  ELSE NULL
END;

-- Step 3: Drop old prize column
ALTER TABLE "Hotspot" DROP COLUMN "prize";

-- Step 4: Rename temp column to prize
ALTER TABLE "Hotspot" RENAME COLUMN "prize_temp" TO "prize";

-- Migration complete! Prize is now a Float field.

