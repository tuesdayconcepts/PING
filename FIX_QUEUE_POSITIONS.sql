-- Fix queue positions for existing unclaimed hotspots
-- This reorders all unclaimed hotspots to have sequential positions starting from 1

WITH ranked_hotspots AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY "queuePosition" ASC, "createdAt" ASC) as new_position
  FROM "Hotspot"
  WHERE "claimStatus" = 'unclaimed'
)
UPDATE "Hotspot"
SET "queuePosition" = ranked_hotspots.new_position
FROM ranked_hotspots
WHERE "Hotspot".id = ranked_hotspots.id;

-- Verify the results
SELECT id, title, "queuePosition", active, "claimStatus"
FROM "Hotspot"
WHERE "claimStatus" = 'unclaimed'
ORDER BY "queuePosition" ASC;

