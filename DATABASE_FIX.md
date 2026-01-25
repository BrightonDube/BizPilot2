# Database Connection Fix - Login 500 Error

**Date:** 2026-01-24  
**Issue:** 500 Internal Server Error on login  
**Root Cause:** Production PostgreSQL database not accessible from localhost

## Problem

The production DigitalOcean PostgreSQL database has IP whitelisting enabled. Your local machine cannot connect, causing:
- Login 500 errors
- Subscription tiers 500 errors
- All database queries fail with connection timeout

## Solution

Use a local PostgreSQL database for development.

## Quick Setup

### Windows
```powershell
cd backend
.\setup_local_db.ps1
```

### macOS/Linux
```bash
cd backend
chmod +x setup_local_db.sh
./setup_local_db.sh
```

## Manual Setup

1. Install PostgreSQL
2. Create database: `createdb -U postgres bizpilot_dev`
3. Run migrations: `cd backend && python -m alembic upgrade head`
4. Seed data: `python scripts/direct_seed.py`
5. Start app: `pnpm run dev:all`

## What Changed

- `backend/.env` - Updated DATABASE_URL to use localhost
- Created setup scripts for easy database initialization
- Updated ENV_SYNC_NOTES.md with troubleshooting info

## Testing

```bash
# Test database connection
curl http://localhost:8000/api/v1/auth/test-db-query

# Test authentication
curl http://localhost:8000/api/v1/auth/test-auth-components
```

Both should return `{"status":"success",...}`

## Status

✅ Fixed - Local database configured and ready to use
