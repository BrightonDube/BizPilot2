# BizPilot Deployment Guide

This guide ensures smooth deployments by maintaining consistency between models, migrations, and database schema.

## Quick Start

### Local Development Setup

```bash
# 1. Set up database
psql -U postgres
CREATE DATABASE bizpilot;
CREATE USER bizpilot_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE bizpilot TO bizpilot_user;
\q

# 2. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Run migrations
python -m alembic upgrade head

# 4. Sync schema (adds any missing columns)
python -m scripts.auto_sync_schema

# 5. Seed database
python -m scripts.seed_capetown

# 6. Validate everything
python -m scripts.pre_deployment_check
```

### Production Deployment

```bash
# 1. Run migrations
python -m alembic upgrade head

# 2. Validate deployment readiness
python -m scripts.pre_deployment_check

# 3. If validation passes, deploy
# If validation fails, fix issues before deploying
```

## Schema Management Workflow

### When You Update Models

```bash
# 1. Update your SQLAlchemy models
# Edit files in app/models/

# 2. Sync schema immediately (for development)
python -m scripts.auto_sync_schema

# 3. Test with seed script
python -m scripts.seed_capetown

# 4. Create proper migration
python -m alembic revision --autogenerate -m "Description of changes"

# 5. Review and edit the migration file
# Check: alembic/versions/xxxxx_description.py

# 6. Apply migration
python -m alembic upgrade head

# 7. Validate everything is in sync
python -m scripts.validate_schema_consistency
```

### When You Pull Changes

```bash
# 1. Pull latest code
git pull

# 2. Run migrations
python -m alembic upgrade head

# 3. Sync any missing columns
python -m scripts.auto_sync_schema

# 4. Validate schema
python -m scripts.validate_schema_consistency

# 5. Reseed if needed
python -m scripts.seed_capetown
```

## Available Scripts

### Schema Management

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `auto_sync_schema.py` | Automatically add missing columns | After model changes, before creating migrations |
| `validate_schema_consistency.py` | Check models match database | Before deployment, in CI/CD |
| `pre_deployment_check.py` | Comprehensive pre-deployment validation | Before every deployment |

### Data Management

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `seed_capetown.py` | Seed database with Cape Town data | Local development, testing |

### Usage Examples

```bash
# Sync schema
python -m scripts.auto_sync_schema

# Validate schema
python -m scripts.validate_schema_consistency

# Pre-deployment check
python -m scripts.pre_deployment_check

# Seed database
python -m scripts.seed_capetown
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      
      - name: Run migrations
        run: |
          cd backend
          python -m alembic upgrade head
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      
      - name: Validate deployment
        run: |
          cd backend
          python -m scripts.pre_deployment_check
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      
      - name: Deploy
        if: success()
        run: |
          # Your deployment commands here
```

## Troubleshooting

### Issue: "Column does not exist" error

**Cause**: Model has columns not in database

**Solution**:
```bash
python -m scripts.auto_sync_schema
```

### Issue: Seed script fails

**Cause**: Schema mismatch between models and database

**Solution**:
```bash
# 1. Sync schema
python -m scripts.auto_sync_schema

# 2. Validate
python -m scripts.validate_schema_consistency

# 3. Try seed again
python -m scripts.seed_capetown
```

### Issue: Migration fails

**Cause**: Database state doesn't match migration expectations

**Solution**:
```bash
# 1. Check current migration version
python -m alembic current

# 2. Check migration history
python -m alembic history

# 3. If needed, downgrade and re-apply
python -m alembic downgrade -1
python -m alembic upgrade head

# 4. Sync any missing columns
python -m scripts.auto_sync_schema
```

### Issue: Pre-deployment check fails

**Cause**: Various issues (schema, migrations, environment)

**Solution**: Follow the specific error messages:
- Schema issues: Run `auto_sync_schema.py`
- Migration issues: Run `alembic upgrade head`
- Environment issues: Check `.env` file
- Table issues: Run migrations and sync

## Best Practices

### Development

1. **Always sync after model changes**
   ```bash
   python -m scripts.auto_sync_schema
   ```

2. **Test with seed script**
   ```bash
   python -m scripts.seed_capetown
   ```

3. **Create migrations for all changes**
   ```bash
   python -m alembic revision --autogenerate -m "Description"
   ```

4. **Validate before committing**
   ```bash
   python -m scripts.validate_schema_consistency
   ```

### Deployment

1. **Always run pre-deployment check**
   ```bash
   python -m scripts.pre_deployment_check
   ```

2. **Never skip migrations**
   ```bash
   python -m alembic upgrade head
   ```

3. **Monitor deployment logs**
   - Check for migration errors
   - Verify schema sync completed
   - Confirm application starts successfully

4. **Have rollback plan**
   - Know your current migration version
   - Test rollback in staging first
   - Keep database backups

### Production

1. **Never use auto_sync_schema in production**
   - Use proper migrations instead
   - Auto-sync is for development only

2. **Always backup before migrations**
   ```bash
   pg_dump -U postgres bizpilot > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

3. **Test migrations in staging first**
   - Apply to staging environment
   - Run full test suite
   - Verify application functionality

4. **Monitor after deployment**
   - Check application logs
   - Verify database connections
   - Test critical user flows

## Environment Variables

### Required

- `DATABASE_URL`: PostgreSQL connection string
  ```
  postgresql+asyncpg://user:password@localhost:5432/bizpilot
  ```

### Optional

- `BIZPILOT_SUPERADMIN_PASSWORD`: Superadmin password (auto-generated if not set)
- `SECRET_KEY`: JWT secret key (auto-generated if not set)
- `REDIS_URL`: Redis connection string (optional)

## Database Configuration

### Development

```env
DATABASE_URL=postgresql+asyncpg://bizpilot_user:password@localhost:5432/bizpilot
```

### Production

```env
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/bizpilot
```

### Alembic (Migrations)

Alembic uses `.env.alembic` if it exists, otherwise falls back to `.env`:

```env
DATABASE_URL=postgresql+psycopg://bizpilot_user:password@localhost:5432/bizpilot
```

Note: Alembic uses `psycopg` (synchronous) instead of `asyncpg`.

## Support

For issues or questions:
1. Check this guide for solutions
2. Review `scripts/README_SCHEMA_SYNC.md` for detailed schema management info
3. Run validation scripts to identify specific issues
4. Check application and database logs

## Quick Reference

```bash
# Development workflow
python -m scripts.auto_sync_schema          # Sync schema
python -m scripts.seed_capetown             # Seed data
python -m scripts.validate_schema_consistency  # Validate

# Deployment workflow
python -m alembic upgrade head              # Run migrations
python -m scripts.pre_deployment_check      # Validate deployment

# Troubleshooting
python -m alembic current                   # Check migration version
python -m alembic history                   # View migration history
python -m scripts.validate_schema_consistency  # Check schema
```
