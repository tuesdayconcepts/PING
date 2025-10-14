-- AlterTable
-- Add role column to Admin table with default value 'editor'
ALTER TABLE "Admin" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'editor';

-- Update existing admin users to have 'admin' role
-- This ensures the first/existing admin(s) have full access
UPDATE "Admin" SET "role" = 'admin';

