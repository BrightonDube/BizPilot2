# Run checks in sequence
Write-Host "=== STEP 1: Running ruff checks ===" -ForegroundColor Cyan
cd backend
python -m ruff check app/api/staff_targets.py app/services/staff_target_service.py app/models/staff_target.py --no-fix
Write-Host "=== STEP 2: Testing StaffTarget import ===" -ForegroundColor Cyan
python -c "from app.models.staff_target import StaffTarget; print('Models import OK')"
Write-Host "=== STEP 3: Testing router import ===" -ForegroundColor Cyan
python -c "from app.api.staff_targets import router; print(f'Router OK: {len(router.routes)} routes')"
Write-Host "=== STEP 4: Git status ===" -ForegroundColor Cyan
cd ..
git --no-pager status --short
Write-Host "=== STEP 5: Git diff stat ===" -ForegroundColor Cyan
git --no-pager diff --stat
