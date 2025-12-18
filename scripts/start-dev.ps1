param(
  [switch]$SkipMigrate
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

Write-Host "Starting BizPilot dev servers..." -ForegroundColor Cyan

$backendCmd = if ($SkipMigrate) {
  "pnpm backend:dev"
} else {
  "pnpm backend:migrate; pnpm backend:dev"
}

Start-Process -FilePath "pwsh" -WorkingDirectory $repoRoot -ArgumentList @(
  "-NoExit",
  "-Command",
  $backendCmd
)

Start-Process -FilePath "pwsh" -WorkingDirectory $repoRoot -ArgumentList @(
  "-NoExit",
  "-Command",
  "pnpm frontend:dev"
)

Write-Host "Opened separate terminals for backend and frontend." -ForegroundColor Green
