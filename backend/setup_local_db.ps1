# Setup Local PostgreSQL Database for BizPilot Development
# Run this script to create and initialize your local database

Write-Host "🚀 Setting up local PostgreSQL database for BizPilot..." -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL is installed
Write-Host "1️⃣ Checking PostgreSQL installation..." -ForegroundColor Yellow
$pgVersion = psql --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ PostgreSQL is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PostgreSQL:" -ForegroundColor Yellow
    Write-Host "  - Download from: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "  - Or use Chocolatey: choco install postgresql" -ForegroundColor White
    Write-Host "  - Or use Scoop: scoop install postgresql" -ForegroundColor White
    exit 1
}
Write-Host "✅ PostgreSQL is installed: $pgVersion" -ForegroundColor Green
Write-Host ""

# Create database
Write-Host "2️⃣ Creating database 'bizpilot_dev'..." -ForegroundColor Yellow
$createDb = createdb -U postgres bizpilot_dev 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database created successfully" -ForegroundColor Green
} elseif ($createDb -like "*already exists*") {
    Write-Host "ℹ️  Database already exists, skipping..." -ForegroundColor Cyan
} else {
    Write-Host "❌ Failed to create database: $createDb" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Try running: createdb -U postgres bizpilot_dev" -ForegroundColor Yellow
    Write-Host "   If prompted for password, use your PostgreSQL password" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Run migrations
Write-Host "3️⃣ Running database migrations..." -ForegroundColor Yellow
python -m alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migrations failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Migrations completed" -ForegroundColor Green
Write-Host ""

# Ask about seeding
Write-Host "4️⃣ Would you like to seed the database with test data? (y/n)" -ForegroundColor Yellow
$seed = Read-Host
if ($seed -eq "y" -or $seed -eq "Y") {
    Write-Host "   Seeding database..." -ForegroundColor Cyan
    python scripts/direct_seed.py
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database seeded successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Seeding failed, but you can continue" -ForegroundColor Yellow
    }
} else {
    Write-Host "⏭️  Skipping database seeding" -ForegroundColor Cyan
}
Write-Host ""

# Summary
Write-Host "=" -NoNewline -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Green
Write-Host "✅ Local database setup complete!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Green
Write-Host ""
Write-Host "📝 Database Details:" -ForegroundColor Cyan
Write-Host "   Host: localhost" -ForegroundColor White
Write-Host "   Port: 5432" -ForegroundColor White
Write-Host "   Database: bizpilot_dev" -ForegroundColor White
Write-Host "   User: postgres" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Start the backend: pnpm run dev:backend" -ForegroundColor White
Write-Host "   2. Start the frontend: pnpm run dev:frontend" -ForegroundColor White
Write-Host "   3. Or start both: pnpm run dev:all" -ForegroundColor White
Write-Host ""
Write-Host "🔐 Default Superadmin (if seeded):" -ForegroundColor Cyan
Write-Host "   Email: admin@bizpilot.com" -ForegroundColor White
Write-Host "   Password: Check your seed script" -ForegroundColor White
Write-Host ""
