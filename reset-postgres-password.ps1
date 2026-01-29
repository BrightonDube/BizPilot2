# Quick PostgreSQL Password Reset Script
# Run this in PowerShell as Administrator

Write-Host "=== PostgreSQL Password Reset ===" -ForegroundColor Cyan
Write-Host ""

# Check admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: Must run as Administrator!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host "Then run this script again." -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "1. Stopping PostgreSQL..." -ForegroundColor Yellow
Stop-Service postgresql-x64-18 -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "   Done" -ForegroundColor Green

Write-Host ""
Write-Host "2. Backing up pg_hba.conf..." -ForegroundColor Yellow
$pgHbaPath = "C:\Program Files\PostgreSQL\18\data\pg_hba.conf"
$backupPath = "$pgHbaPath.backup"
Copy-Item $pgHbaPath $backupPath -Force
Write-Host "   Backup: $backupPath" -ForegroundColor Green

Write-Host ""
Write-Host "3. Modifying pg_hba.conf..." -ForegroundColor Yellow
$content = Get-Content $pgHbaPath -Raw
$content = $content -replace 'scram-sha-256', 'trust' -replace 'md5', 'trust'
$content | Set-Content $pgHbaPath -NoNewline
Write-Host "   Modified (all auth set to 'trust')" -ForegroundColor Green

Write-Host ""
Write-Host "4. Starting PostgreSQL..." -ForegroundColor Yellow
Start-Service postgresql-x64-18
Start-Sleep -Seconds 3
Write-Host "   Done" -ForegroundColor Green

Write-Host ""
Write-Host "=== Ready to Reset Password ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Now run these commands:" -ForegroundColor Yellow
Write-Host ""
Write-Host '  psql -U postgres -d postgres' -ForegroundColor White
Write-Host '  ALTER USER postgres WITH PASSWORD ''NewPassword123!'';' -ForegroundColor White
Write-Host '  \q' -ForegroundColor White
Write-Host ""
Write-Host "Press any key to continue (will run commands for you)..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "5. Resetting postgres password..." -ForegroundColor Yellow

# Create SQL command
$newPassword = "btXZ6v71UVjzTCnaFWqe9oY4"
$sqlCmd = "ALTER USER postgres WITH PASSWORD '$newPassword';"

# Execute via psql
$env:PGPASSWORD = ""
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d postgres -c $sqlCmd

Write-Host "   New password: $newPassword" -ForegroundColor Green

Write-Host ""
Write-Host "6. Restoring secure authentication..." -ForegroundColor Yellow
$content = Get-Content $pgHbaPath -Raw
$content = $content -replace 'trust', 'scram-sha-256'
$content | Set-Content $pgHbaPath -NoNewline
Write-Host "   Restored scram-sha-256" -ForegroundColor Green

Write-Host ""
Write-Host "7. Restarting PostgreSQL..." -ForegroundColor Yellow
Restart-Service postgresql-x64-18
Start-Sleep -Seconds 3
Write-Host "   Done" -ForegroundColor Green

Write-Host ""
Write-Host "=== Password Reset Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "New postgres password: $newPassword" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test it:" -ForegroundColor Yellow
Write-Host "  psql -U postgres" -ForegroundColor White
Write-Host "  (Enter password: $newPassword)" -ForegroundColor White
Write-Host ""
Write-Host "Save this password!" -ForegroundColor Yellow
Write-Host ""
pause
