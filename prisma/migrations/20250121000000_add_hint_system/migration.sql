-- AlterTable
ALTER TABLE "Hotspot" ADD COLUMN "hint1" TEXT,
ADD COLUMN "hint2" TEXT,
ADD COLUMN "hint3" TEXT,
ADD COLUMN "hint1PriceUsd" DOUBLE PRECISION,
ADD COLUMN "hint2PriceUsd" DOUBLE PRECISION,
ADD COLUMN "hint3PriceUsd" DOUBLE PRECISION,
ADD COLUMN "firstHintFree" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "HintPurchase" (
    "id" TEXT NOT NULL,
    "hotspotId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "hintLevel" INTEGER NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL,
    "paidUsd" DOUBLE PRECISION NOT NULL,
    "txSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HintPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HintSettings" (
    "id" TEXT NOT NULL,
    "treasuryWallet" TEXT NOT NULL DEFAULT '',
    "burnWallet" TEXT NOT NULL DEFAULT '',
    "defaultHint1Usd" DOUBLE PRECISION NOT NULL DEFAULT 1.00,
    "defaultHint2Usd" DOUBLE PRECISION NOT NULL DEFAULT 5.00,
    "defaultHint3Usd" DOUBLE PRECISION NOT NULL DEFAULT 10.00,
    "pingTokenMint" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HintSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HintPurchase_walletAddress_hotspotId_idx" ON "HintPurchase"("walletAddress", "hotspotId");

-- CreateIndex
CREATE INDEX "HintPurchase_hotspotId_idx" ON "HintPurchase"("hotspotId");

-- CreateIndex
CREATE UNIQUE INDEX "HintPurchase_walletAddress_hotspotId_hintLevel_key" ON "HintPurchase"("walletAddress", "hotspotId", "hintLevel");

-- AddForeignKey
ALTER TABLE "HintPurchase" ADD CONSTRAINT "HintPurchase_hotspotId_fkey" FOREIGN KEY ("hotspotId") REFERENCES "Hotspot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

