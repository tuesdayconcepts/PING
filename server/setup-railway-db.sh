#!/bin/bash
# Railway Database Setup Script
# Run this once to initialize your database on Railway

echo "🚂 Setting up Railway database..."
echo ""

# Check if railway CLI is installed
if ! command -v railway &> /dev/null
then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

echo "📝 Step 1: Login to Railway (browser will open)"
railway login

echo ""
echo "🔗 Step 2: Linking to PING project..."
railway link

echo ""
echo "🗄️ Step 3: Running database migrations..."
railway run npx prisma migrate deploy

echo ""
echo "🌱 Step 4: Seeding database with admin user and sample hotspots..."
railway run npx tsx prisma/seed.ts

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "You can now login at: https://solping.netlify.app/admin"

