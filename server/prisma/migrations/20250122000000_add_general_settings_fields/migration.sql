-- AlterTable
ALTER TABLE "HintSettings" ADD COLUMN "buyButtonUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "HintSettings" ADD COLUMN "pumpFunUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "HintSettings" ADD COLUMN "pumpFunEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HintSettings" ADD COLUMN "xUsername" TEXT NOT NULL DEFAULT '';
ALTER TABLE "HintSettings" ADD COLUMN "xEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HintSettings" ADD COLUMN "instagramUsername" TEXT NOT NULL DEFAULT '';
ALTER TABLE "HintSettings" ADD COLUMN "instagramEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HintSettings" ADD COLUMN "tiktokUsername" TEXT NOT NULL DEFAULT '';
ALTER TABLE "HintSettings" ADD COLUMN "tiktokEnabled" BOOLEAN NOT NULL DEFAULT false;

