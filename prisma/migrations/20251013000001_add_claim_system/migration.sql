-- AlterTable
ALTER TABLE "Hotspot" ADD COLUMN "privateKey" TEXT,
ADD COLUMN "claimStatus" TEXT NOT NULL DEFAULT 'unclaimed',
ADD COLUMN "claimedBy" TEXT,
ADD COLUMN "claimedAt" TIMESTAMP(3),
ADD COLUMN "tweetUrl" TEXT,
ADD COLUMN "queuePosition" INTEGER NOT NULL DEFAULT 0;

