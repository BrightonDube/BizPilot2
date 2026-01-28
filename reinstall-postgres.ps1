# PostgreSQL Complete Reinstall Script
# Run as Administrator

Write-Host "=== PostgreSQL Complete Reinstall ===" -ForegroundColor Cyan
Write-Host ""

# New password for postgres superuser
$NEW_POSTGRES_PASSWORD = "BizPilot2026!"
Write-Host "New postgres password will be: $NEW_POSTGRES_PASSWORD" -ForegroundColor Green
Write-Host ""

# Step 1: Stop PostgreSQL services
Write-Host "Step 1: Stopping PostgreSQL services..." -ForegroundColor Yellow
try {
    Stop-Service postgresql-x64-17 -Force -ErrorAction SilentlyContinue
    Stop-Service postgresql-x64-18 -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Services stopped" -ForegroundColor Green
} catch {
    Write-Host "⚠ Could not stop services (may require admin)" -ForegroundColor Yellow
}

# Step 2: Uninstall PostgreSQL 17
Write-Host ""
Write-Host "Step 2: Uninstalling PostgreSQL 17..." -ForegroundColor Yellow
if (Test-Path "C:\Program Files\PostgreSQL\17\uninstall-postgresql.exe") {
    Start-Process -FilePath "C:\Program Files\PostgreSQL\17\uninstall-postgresql.exe" -ArgumentList "--mode unattended" -Wait
    Write-Host "✓ PostgreSQL 17 uninstalled" -ForegroundColor Green
} else {
    Write-Host "⚠ PostgreSQL 17 not found" -ForegroundColor Yellow
}

# Step 3: Uninstall PostgreSQL 18
Write-Host ""
Write-Host "Step 3: Uninstalling PostgreSQL 18..." -ForegroundColor Yellow
if (Test-Path "C:\Program Files\PostgreSQL\18\uninstall-postgresql.exe") {
    Start-Process -FilePath "C:\Program Files\PostgreSQL\18\uninstall-postgresql.exe" -ArgumentList "--mode unattended" -Wait
    Write-Host "✓ PostgreSQL 18 uninstalled" -ForegroundColor Green
} else {
    Write-Host "⚠ PostgreSQL 18 not found" -ForegroundColor Yellow
}

# Step 4: Clean up data directories
Write-Host ""
Write-Host "Step 4: Cleaning up data directories..." -ForegroundColor Yellow
$dataDirs = @(
    "C:\Program Files\PostgreSQL",
    "$env:LOCALAPPDATA\PostgreSQL",
    "$env:APPDATA\postgresql"
)

foreach ($dir in $dataDirs) {
    if (Test-Path $dir) {
        Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✓ Removed $dir" -ForegroundColor Green
    }
}

# Step 5: Download PostgreSQL 18 installer
Write-Host ""
Write-Host "Step 5: Downloading PostgreSQL 18..." -ForegroundColor Yellow
$installerUrl = "https://get.enterprisedb.com/postgresql/postgresql-18.1-2-windows-x64.exe"
$installerPath = "$env:TEMP\postgresql-18-installer.exe"

if (Test-Path $installerPath) {
    Remove-Item $installerPath -Force
}

try {
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "✓ Downloaded installer" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to download installer" -ForegroundColor Red
    Write-Host "Please download manually from: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads" -ForegroundColor Yellow
    exit 1
}

# Step 6: Install PostgreSQL 18 with new password
Write-Host ""
Write-Host "Step 6: Installing PostgreSQL 18..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray

$installArgs = @(
    "--mode", "unattended",
    "--unattendedmodeui", "minimal",
    "--superpassword", $NEW_POSTGRES_PASSWORD,
    "--servicename", "postgresql-x64-18",
    "--serviceaccount", "NT AUTHORITY\NetworkService",
    "--serverport", "5432",
    "--locale", "en_US",
    "--enable-components", "server,commandlinetools"
)

Start-Process -FilePath $installerPath -ArgumentList $installArgs -Wait -NoNewWindow

if (Test-Path "C:\Program Files\PostgreSQL\18\bin\psql.exe") {
    Write-Host "✓ PostgreSQL 18 installed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Installation failed" -ForegroundColor Red
    exit 1
}

# Step 7: Add PostgreSQL to PATH
Write-Host ""
Write-Host "Step 7: Adding PostgreSQL to PATH..." -ForegroundColor Yellow
$pgBinPath = "C:\Program Files\PostgreSQL\18\bin"
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ($currentPath -notlike "*$pgBinPath*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$pgBinPath", "Machine")
    $env:Path = "$env:Path;$pgBinPath"
    Write-Host "✓ Added to PATH" -ForegroundColor Green
} else {
    Write-Host "✓ Already in PATH" -ForegroundColor Green
}

# Step 8: Wait for service to start
Write-Host ""
Write-Host "Step 8: Waiting for PostgreSQL service to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

$service = Get-Service postgresql-x64-18 -ErrorAction SilentlyContinue
if ($service -and $service.Status -eq "Running") {
    Write-Host "✓ PostgreSQL service is running" -ForegroundColor Green
} else {
    Write-Host "⚠ Service not running, attempting to start..." -ForegroundColor Yellow
    Start-Service postgresql-x64-18
    Start-Sleep -Seconds 3
}

# Step 9: Test connection
Write-Host ""
Write-Host "Step 9: Testing connection..." -ForegroundColor Yellow
$env:PGPASSWORD = $NEW_POSTGRES_PASSWORD
$testResult = & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -p 5432 -c "SELECT version();" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Connection successful!" -ForegroundColor Green
} else {
    Write-Host "✗ Connection failed" -ForegroundColor Red
    Write-Host $testResult -ForegroundColor Red
}

# Step 10: Create BizPilot database and user
Write-Host ""
Write-Host "Step 10: Creating BizPilot database and user..." -ForegroundColor Yellow

$sqlCommands = @"
DROP DATABASE IF EXISTS bizpilot;
CREATE DATABASE bizpilot;
DROP USER IF EXISTS bizpilot_user;
CREATE USER bizpilot_user WITH LOGIN PASSWORD 'btXZ6v71UVjzTCnaFWqe9oY4';
GRANT ALL PRIVILEGES ON DATABASE bizpilot TO bizpilot_user;
"@

$sqlCommands | & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -p 5432

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Database and user created" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to create database" -ForegroundColor Red
}

# Step 11: Grant schema privileges
Write-Host ""
Write-Host "Step 11: Setting up schema privileges..." -ForegroundColor Yellow

$schemaSQL = @"
GRANT ALL ON SCHEMA public TO bizpilot_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bizpilot_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bizpilot_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO bizpilot_user;
"@

$schemaSQL | & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -p 5432 -d bizpilot

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Schema privileges set" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to set privileges" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "PostgreSQL Superuser Credentials:" -ForegroundColor White
Write-Host "  Username: postgres" -ForegroundColor Gray
Write-Host "  Password: $NEW_POSTGRES_PASSWORD" -ForegroundColor Gray
Write-Host ""
Write-Host "BizPilot Database Credentials:" -ForegroundColor White
Write-Host "  Database: bizpilot" -ForegroundColor Gray
Write-Host "  Username: bizpilot_user" -ForegroundColor Gray
Write-Host "  Password: btXZ6v71UVjzTCnaFWqe9oY4" -ForegroundColor Gray
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. cd backend" -ForegroundColor Gray
Write-Host "2. alembic upgrade head" -ForegroundColor Gray
Write-Host "3. python init_local_db.py" -ForegroundColor Gray
Write-Host "4. uvicorn app.main:app --reload" -ForegroundColor Gray
Write-Host ""
