# Overdue Invoice Scheduler - Deployment Checklist

This checklist ensures the overdue invoice scheduler is properly configured and operational in production environments.

## Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Database Migration](#database-migration)
- [Environment Variables](#environment-variables)
- [Deployment Verification](#deployment-verification)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

Before deploying the scheduler to production, ensure the following:

- [ ] **Code Review**: All scheduler code has been reviewed and approved
- [ ] **Tests Passing**: All property-based and unit tests pass locally
  ```bash
  cd backend
  pytest app/tests/property/ -v
  pytest app/tests/unit/ -v
  ```
- [ ] **Environment Variables**: All required environment variables are documented
- [ ] **Database Migration**: Migration file exists and has been tested locally
- [ ] **Monitoring Setup**: Health check endpoints are accessible

---

## Database Migration

### Step 1: Verify Migration File Exists

The scheduler requires the `job_execution_logs` table. Verify the migration file exists:

```bash
cd backend
ls alembic/versions/*job_execution_logs*.py
```

Expected file: `298dd1eda420_add_job_execution_logs_table.py`

### Step 2: Apply Migration in Production

**For DigitalOcean App Platform:**

The migration is automatically applied via the `release-migrate` pre-deploy job defined in `.do/app.yaml`. No manual action required.

**For Render:**

Add a pre-deploy command in the Render dashboard:
```bash
alembic upgrade head
```

**For Azure:**

Run the migration manually after deployment:
```bash
az webapp ssh --resource-group bizpilot-rg --name bizpilot-api
cd /app
alembic upgrade head
```

**For Docker/Manual Deployment:**

```bash
# Using Docker
docker-compose exec api alembic upgrade head

# Manual
cd backend
source venv/bin/activate
alembic upgrade head
```

### Step 3: Verify Migration Applied

Connect to your production database and verify the table exists:

```sql
-- Check if table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'job_execution_logs';

-- Check table structure
\d job_execution_logs

-- Expected columns:
-- - id (UUID, primary key)
-- - job_name (VARCHAR(100), indexed)
-- - start_time (TIMESTAMP)
-- - end_time (TIMESTAMP, nullable)
-- - status (VARCHAR(20))
-- - invoices_processed (INTEGER)
-- - notifications_created (INTEGER)
-- - error_count (INTEGER)
-- - error_details (TEXT, nullable)
```

---

## Environment Variables

### Required Variables

The scheduler requires the following environment variables to be set in production:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `OVERDUE_INVOICE_SCHEDULE_TYPE` | Schedule type: "cron" or "interval" | `cron` | `cron` |
| `OVERDUE_INVOICE_SCHEDULE_VALUE` | Cron expression or interval hours | `0 0 * * *` | `0 0 * * *` (daily at midnight) |
| `OVERDU