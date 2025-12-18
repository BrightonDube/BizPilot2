param(
  [string]$TargetBranch = "dev"
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

$branch = (git rev-parse --abbrev-ref HEAD).Trim()

if ($branch -eq "main") {
  Write-Host "Refusing to run bd sync on 'main' (protected). Switch to '$TargetBranch' and try again." -ForegroundColor Red
  exit 1
}

if ($branch -ne $TargetBranch) {
  Write-Host "Warning: you're on '$branch', not '$TargetBranch'. Beads will sync on the current branch." -ForegroundColor Yellow
  Write-Host "If you intended to sync issues to '$TargetBranch', run: git checkout $TargetBranch" -ForegroundColor Yellow
}

bd sync
