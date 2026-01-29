# PostgreSQL Setup for BizPilot - Manual Steps
# Since psql authentication is failing, use pgAdmin instead

Write-Host "=== PostgreSQL Setup for BizPilot ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "OPTION 1: Use pgAdmin (Recommended)" -ForegroundColor Yellow
Write-Host "1. Open pgAdmin 4" -ForegroundColor White
Write-Host "2. Right-click 'PostgreSQL 18' -> Query Tool" -ForegroundColor White
Write-Host "3. Copy and paste this SQL:" -ForegroundColor White
Write-Host ""
Write-Host "DROP DATABASE IF EXISTS bizpilot;" -ForegroundColor Green
Write-Host "CREATE DATABASE bizpilot;" -ForegroundColor Green
Write-Host "DROP USER IF EXISTS bizpilot_user;" -ForegroundColor Green
Write-Host "CREATE USER bizpilot_user WITH LOGIN PASSWORD 'btXZ6v71UVjzTCnaFWqe9oY4';" -ForegroundColor Green
Write-Host "GRANT ALL PRIVILEGES ON DATABASE bizpilot TO bizpilot_user;" -ForegroundColor Green
Write-Host ""
Write-Host "4. Click Execute (F5)" -ForegroundColor White
Write-Host "5. Right-click 'bizpilot' database -> Query Tool" -ForegroundColor White
Write-Host "6. Copy and paste this SQL:" -ForegroundColor White
Write-Host ""
Write-Host "GRANT ALL ON SCHEMA public TO bizpilot_user;" -ForegroundColor Green
Write-Host "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bizpilot_user;" -ForegroundColor Green
Write-Host "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bizpilot_user;" -ForegroundColor Green
Write-Host ""
Write-Host "7. Click Execute (F5)" -ForegroundColor White
Write-Host ""
Write-Host "OPTION 2: Reset postgres password first" -ForegroundColor Yellow
Write-Host "Run: .\reset-postgres-password.ps1 (as Administrator)" -ForegroundColor White
Write-Host "Then run: psql -U postgres -f backend\setup_bizpilot.sql" -ForegroundColor White
Write-Host ""
Write-Host "After database is created, come back and I'll run migrations!" -ForegroundColor Cyan
Write-Host ""
