# Helper script to update DATABASE_URL in backend\.env
param(
    [Parameter(Mandatory=$true)]
    [string]$DatabaseUrl
)

Write-Host "`n📝 Updating DATABASE_URL...`n" -ForegroundColor Cyan

$envPath = "backend\.env"

if (-not (Test-Path $envPath)) {
    Write-Host "❌ backend\.env not found!" -ForegroundColor Red
    exit 1
}

# Add ?sslmode=require if not present and not localhost
if ($DatabaseUrl -notlike "*localhost*" -and $DatabaseUrl -notlike "*sslmode=*") {
    $DatabaseUrl += "?sslmode=require"
    Write-Host "✓ Added ?sslmode=require for cloud database" -ForegroundColor Green
}

# Read current .env
$envContent = Get-Content $envPath -Raw

# Replace DATABASE_URL
$envContent = $envContent -replace 'DATABASE_URL=.*', "DATABASE_URL=$DatabaseUrl"

# Write back
$envContent | Out-File -FilePath $envPath -Encoding UTF8 -NoNewline

Write-Host "✓ DATABASE_URL updated in backend\.env`n" -ForegroundColor Green
Write-Host "Database URL: $DatabaseUrl`n" -ForegroundColor Cyan

Write-Host "🚀 Ready to start! Run: .\start-local.ps1`n" -ForegroundColor Magenta
