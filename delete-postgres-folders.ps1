# Delete PostgreSQL Folders Script
# Run as Administrator

Write-Host "=== Deleting PostgreSQL Folders ===" -ForegroundColor Cyan
Write-Host ""

# Stop PostgreSQL services first
Write-Host "Stopping PostgreSQL services..." -ForegroundColor Yellow
try {
    Stop-Service postgresql-x64-17 -Force -ErrorAction SilentlyContinue
    Stop-Service postgresql-x64-18 -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Services stopped" -ForegroundColor Green
} catch {
    Write-Host "⚠ Could not stop services (may require admin)" -ForegroundColor Yellow
}

Start-Sleep -Seconds 2

# Define folders to delete
$foldersToDelete = @(
    "C:\Program Files\PostgreSQL",
    "$env:LOCALAPPDATA\PostgreSQL",
    "$env:APPDATA\postgresql"
)

# Delete each folder
foreach ($folder in $foldersToDelete) {
    Write-Host ""
    Write-Host "Checking: $folder" -ForegroundColor Yellow
    
    if (Test-Path $folder) {
        Write-Host "  Found. Attempting to delete..." -ForegroundColor Gray
        
        try {
            # Try to take ownership first
            takeown /F "$folder" /R /D Y 2>&1 | Out-Null
            icacls "$folder" /grant administrators:F /T 2>&1 | Out-Null
            
            # Now delete
            Remove-Item -Path $folder -Recurse -Force -ErrorAction Stop
            Write-Host "  ✓ Deleted successfully" -ForegroundColor Green
        }
        catch {
            Write-Host "  ✗ Failed to delete: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "  Try running as Administrator or delete manually" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "  ✓ Does not exist (already clean)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== Cleanup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Download PostgreSQL 18 installer" -ForegroundColor Gray
Write-Host "2. Install with password: BizPilot2026!" -ForegroundColor Gray
Write-Host "3. Run database setup commands" -ForegroundColor Gray
Write-Host ""
