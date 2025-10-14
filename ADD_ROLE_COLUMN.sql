-- Run this SQL in your Railway PostgreSQL database
-- This adds the 'role' column to the Admin table for Access Control

-- Step 1: Add role column with default value 'editor'
ALTER TABLE "Admin" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'editor';

-- Step 2: Set existing admin users to 'admin' role (full access)
UPDATE "Admin" SET "role" = 'admin';

-- Done! Your existing admin user(s) now have full admin access.
-- The Access Control tab will appear in the admin panel.

