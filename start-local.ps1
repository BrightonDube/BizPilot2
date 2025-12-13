# BizPilot Local Development Startup Script
# This script starts both backend and frontend servers

param(
    [switch]$SkipDependencies
)

Write-Host "`n🚀 BizPilot Local Development Startup`n" -ForegroundColor Cyan

# Check if .env files exist
if (-not (Test-Path "backend\.env")) {
    Write-Host "❌ backend\.env not found! Please create it first." -ForegroundColor Red
    Write-Host "   Run setup-env.ps1 or copy from backend\.env.example`n" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "frontend\.env.local")) {
    Write-Host "❌ frontend\.env.local not found! Please create it first." -ForegroundColor Red
    Write-Host "   Run setup-env.ps1 or copy from frontend\.env.example`n" -ForegroundColor Yellow
    exit 1
}

# Install dependencies if needed
if (-not $SkipDependencies) {
    Write-Host "📦 Installing dependencies...`n" -ForegroundColor Yellow
    
    # Backend dependencies
    Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
    Set-Location backend
    python -m pip install -r requirements.txt --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
        exit 1
    }
    Set-Location ..
    
    # Frontend dependencies
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    Set-Location frontend
    pnpm install --silent
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
        exit 1
    }
    Set-Location ..
    
    Write-Host "✓ Dependencies installed`n" -ForegroundColor Green
}

# Run database migrations
Write-Host "🗄️  Running database migrations..." -ForegroundColor Yellow
Set-Location backend
python -m alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Database migrations failed!" -ForegroundColor Red
    Write-Host "   Make sure your DATABASE_URL in backend\.env is correct" -ForegroundColor Yellow
    Write-Host "   and the database is accessible`n" -ForegroundColor Yellow
    Set-Location ..
    exit 1
}
Set-Location ..
Write-Host "✓ Database migrations complete`n" -ForegroundColor Green

Write-Host "🎉 Starting servers...`n" -ForegroundColor Green
Write-Host "Backend API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000`n" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop all servers`n" -ForegroundColor Yellow

# Start backend in background
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\backend
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start frontend in current session (so we can see output)
Set-Location frontend
pnpm dev

# Cleanup: Stop backend job when frontend stops
Stop-Job -Job $backendJob
Remove-Job -Job $backendJob
Set-Location ..

Write-Host "`n👋 Servers stopped" -ForegroundColor Yellow
