-- CreateIndex for hotspot query performance
-- Index for admin list ordering (active first, then by createdAt desc)
CREATE INDEX "Hotspot_active_createdAt_idx" ON "Hotspot"("active", "createdAt" DESC);

-- Index for filtering by claim status
CREATE INDEX "Hotspot_claimStatus_idx" ON "Hotspot"("claimStatus");

-- Compound index for public list filtering (active + claimStatus)
CREATE INDEX "Hotspot_active_claimStatus_idx" ON "Hotspot"("active", "claimStatus");

