-- Run this SQL in your Railway PostgreSQL database
-- This adds the 'username' column to the AdminLog table for better activity tracking

-- Add username column (nullable since existing logs won't have it)
ALTER TABLE "AdminLog" ADD COLUMN "username" TEXT;

-- Done! Login/logout activities will now show usernames in Recent Activity tab.

