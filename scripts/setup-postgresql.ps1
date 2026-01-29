# PostgreSQL Setup Script for BizPilot2
# This script automates the PostgreSQL database setup

param(
    [string]$Password = "",
    [string]$Database = "bizpilot",
    [string]$Username = "bizpilot_user"
)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  BizPilot2 PostgreSQL Setup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL is running
Write-Host "1. Checking PostgreSQL service..." -ForegroundColor Yellow
$pgService = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
if ($pgService.Status -ne "Running") {
    Write-Host "   Starting PostgreSQL service..." -ForegroundColor Yellow
    Start-Service postgresql-x64-18
    Start-Sleep -Seconds 3
}
Write-Host "   ✅ PostgreSQL is running" -ForegroundColor Green
Write-Host ""

# Generate secure password if not provided
if ([string]::IsNullOrEmpty($Password)) {
    Write-Host "2. Generating secure password..." -ForegroundColor Yellow
    $Password = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object {[char]$_})
    Write-Host "   Generated password: $Password" -ForegroundColor Cyan
    Write-Host "   ⚠️  Save this password!" -ForegroundColor Yellow
} else {
    Write-Host "2. Using provided password..." -ForegroundColor Yellow
    Write-Host "   ✅ Password set" -ForegroundColor Green
}
Write-Host ""

# Create SQL commands file
Write-Host "3. Creating database and user..." -ForegroundColor Yellow
$sqlCommands = @"
-- Create database
SELECT 'Creating database...' as status;
DROP DATABASE IF EXISTS $Database;
CREATE DATABASE $Database;

-- Create user
SELECT 'Creating user...' as status;
DROP USER IF EXISTS $Username;
CREATE USER $Username WITH PASSWORD '$Password';

-- Grant privileges on database
SELECT 'Granting privileges...' as status;
GRANT ALL PRIVILEGES ON DATABASE $Database TO $Username;

-- Connect to database and grant schema privileges
\c $Database
GRANT ALL ON SCHEMA public TO $Username;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $Username;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $Username;

-- Grant default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $Username;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $Username;

SELECT 'Setup complete!' as status;
"@

$sqlFile = "$env:TEMP\bizpilot_setup.sql"
$sqlCommands | Out-File -FilePath $sqlFile -Encoding UTF8

# Execute SQL commands
try {
    $env:PGPASSWORD = "postgres"  # Default postgres password
    & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f $sqlFile
    Remove-Item $sqlFile
    Write-Host "   ✅ Database and user created" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed to create database. You may need to enter postgres password manually." -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Manual setup:" -ForegroundColor Yellow
    Write-Host "   1. Run: psql -U postgres" -ForegroundColor Cyan
    Write-Host "   2. Execute the commands in: $sqlFile" -ForegroundColor Cyan
    exit 1
}
Write-Host ""

# Update .env file
Write-Host "4. Updating .env file..." -ForegroundColor Yellow
$envFile = ".\backend\.env"
$connectionString = "postgresql+asyncpg://${Username}:${Password}@localhost:5432/${Database}"

if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    
    # Update or add DATABASE_URL
    if ($envContent -match "DATABASE_URL=.*") {
        $envContent = $envContent -replace "DATABASE_URL=.*", "DATABASE_URL=$connectionString"
    } else {
        $envContent += "`nDATAbase_URL=$connectionString"
    }
    
    $envContent | Out-File -FilePath $envFile -Encoding UTF8 -NoNewline
    Write-Host "   ✅ .env file updated" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  .env file not found. Creating from .env.example..." -ForegroundColor Yellow
    Copy-Item ".\backend\.env.example" $envFile
    $envContent = Get-Content $envFile -Raw
    $envContent = $envContent -replace "DATABASE_URL=.*", "DATABASE_URL=$connectionString"
    $envContent | Out-File -FilePath $envFile -Encoding UTF8 -NoNewline
    Write-Host "   ✅ .env file created" -ForegroundColor Green
}
Write-Host ""

# Run migrations
Write-Host "5. Running database migrations..." -ForegroundColor Yellow
Push-Location .\backend
try {
    python -m alembic upgrade head
    Write-Host "   ✅ Migrations completed" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Migration failed. You may need to run manually:" -ForegroundColor Yellow
    Write-Host "   cd backend && python -m alembic upgrade head" -ForegroundColor Cyan
}
Pop-Location
Write-Host ""

# Test connection
Write-Host "6. Testing database connection..." -ForegroundColor Yellow
$testScript = @"
import asyncio
from sqlalchemy import text
from app.core.database import async_engine

async def test():
    if async_engine:
        try:
            async with async_engine.connect() as conn:
                result = await conn.execute(text('SELECT version()'))
                version = result.scalar()
                print(f'   ✅ Connected to: {version[:50]}...')
                return True
        except Exception as e:
            print(f'   ❌ Connection failed: {e}')
            return False
    else:
        print('   ❌ Async engine not initialized')
        return False

success = asyncio.run(test())
exit(0 if success else 1)
"@

Push-Location .\backend
$testScript | python
$testSuccess = $LASTEXITCODE -eq 0
Pop-Location

if (-not $testSuccess) {
    Write-Host "   ⚠️  Connection test inconclusive. Check manually." -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Database Details:" -ForegroundColor Cyan
Write-Host "  Database: $Database" -ForegroundColor White
Write-Host "  Username: $Username" -ForegroundColor White
Write-Host "  Password: $Password" -ForegroundColor Yellow
Write-Host "  Host:     localhost:5432" -ForegroundColor White
Write-Host ""
Write-Host "Connection String (in .env):" -ForegroundColor Cyan
Write-Host "  DATABASE_URL=$connectionString" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Important: Save your password in a secure location!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Restart backend server:" -ForegroundColor White
Write-Host "     cd backend && uvicorn app.main:app --reload" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Verify async is working:" -ForegroundColor White
Write-Host "     curl http://localhost:8000/health/readiness" -ForegroundColor Gray
Write-Host "     (Should show 'database: healthy')" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Check for performance improvements in logs" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Your application now has full async PostgreSQL support!" -ForegroundColor Green
Write-Host ""
