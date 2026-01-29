#!/bin/bash
# Setup Local PostgreSQL Database for BizPilot Development

echo "🚀 Setting up local PostgreSQL database for BizPilot..."
echo ""

# Check if PostgreSQL is installed
echo "1️⃣ Checking PostgreSQL installation..."
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed or not in PATH"
    echo ""
    echo "Please install PostgreSQL:"
    echo "  - macOS: brew install postgresql"
    echo "  - Ubuntu/Debian: sudo apt-get install postgresql"
    echo "  - Windows: Download from https://www.postgresql.org/download/windows/"
    exit 1
fi
echo "✅ PostgreSQL is installed: $(psql --version)"
echo ""

# Create database
echo "2️⃣ Creating database 'bizpilot_dev'..."
createdb -U postgres bizpilot_dev 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Database created successfully"
elif [[ $(createdb -U postgres bizpilot_dev 2>&1) == *"already exists"* ]]; then
    echo "ℹ️  Database already exists, skipping..."
else
    echo "❌ Failed to create database"
    echo "💡 Try running: createdb -U postgres bizpilot_dev"
    exit 1
fi
echo ""

# Run migrations
echo "3️⃣ Running database migrations..."
python -m alembic upgrade head
if [ $? -ne 0 ]; then
    echo "❌ Migrations failed"
    exit 1
fi
echo "✅ Migrations completed"
echo ""

# Ask about seeding
echo "4️⃣ Would you like to seed the database with test data? (y/n)"
read -r seed
if [[ $seed == "y" || $seed == "Y" ]]; then
    echo "   Seeding database..."
    python scripts/direct_seed.py
    if [ $? -eq 0 ]; then
        echo "✅ Database seeded successfully"
    else
        echo "⚠️  Seeding failed, but you can continue"
    fi
else
    echo "⏭️  Skipping database seeding"
fi
echo ""

# Summary
echo "============================================================"
echo "✅ Local database setup complete!"
echo "============================================================"
echo ""
echo "📝 Database Details:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Database: bizpilot_dev"
echo "   User: postgres"
echo ""
echo "🚀 Next Steps:"
echo "   1. Start the backend: pnpm run dev:backend"
echo "   2. Start the frontend: pnpm run dev:frontend"
echo "   3. Or start both: pnpm run dev:all"
echo ""
echo "🔐 Default Superadmin (if seeded):"
echo "   Email: admin@bizpilot.com"
echo "   Password: Check your seed script"
echo ""
