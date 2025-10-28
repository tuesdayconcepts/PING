#!/bin/bash
# Direct migration script - connects to Railway database directly
# You'll need to paste your DATABASE_URL from Railway

echo "🗄️ Railway Database Migration Script"
echo ""
echo "📋 Step 1: Get your DATABASE_URL from Railway"
echo "   1. Go to Railway dashboard"
echo "   2. Click on PING service"
echo "   3. Click 'Variables' tab"
echo "   4. Find DATABASE_URL and copy its value"
echo ""
read -p "Paste your DATABASE_URL here: " DATABASE_URL

if [ -z "$DATABASE_URL" ]; then
    echo "❌ No DATABASE_URL provided. Exiting."
    exit 1
fi

echo ""
echo "✅ DATABASE_URL received"
echo ""

# Export DATABASE_URL for Prisma to use
export DATABASE_URL="$DATABASE_URL"

echo "🔨 Running migrations..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully!"
    echo ""
    echo "🌱 Seeding database..."
    npx tsx prisma/seed.ts
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Database setup complete!"
        echo ""
        echo "📋 Next steps:"
        echo "   - Create your first admin user through the admin panel"
        echo "   - Or use the API to create admin users"
        echo ""
        echo "🌐 Access admin panel at: https://solping.netlify.app/admin"
    else
        echo "❌ Seeding failed. Check the errors above."
    fi
else
    echo "❌ Migration failed. Check the errors above."
fi

