# Schema Synchronization and Validation

This directory contains tools to ensure consistency between SQLAlchemy models, Alembic migrations, and the actual database schema.

## Problem Statement

When developing with SQLAlchemy and Alembic, schema mismatches can occur when:
- Models are updated but migrations aren't created
- Migrations are incomplete or missing columns
- Database schema drifts from model definitions
- Seed scripts fail due to missing columns

## Solution: Automated Schema Sync

We've implemented three tools to maintain schema consistency:

### 1. Auto Schema Sync (`auto_sync_schema.py`)

**Purpose**: Automatically detect and fix schema mismatches by adding missing columns.

**Usage**:
```bash
python -m scripts.auto_sync_schema
```

**What it does**:
- Inspects all SQLAlchemy models
- Compares model columns with actual database columns
- Automatically adds any missing columns with appropriate types
- Handles nullable/not-null constraints and defaults
- Skips tables that don't exist

**When to use**:
- After updating models but before creating migrations
- When seed scripts fail due to missing columns
- After pulling changes that include model updates
- Before deployment to ensure schema is complete

### 2. Schema Validation (`validate_schema_consistency.py`)

**Purpose**: Validate that models and database are in sync without making changes.

**Usage**:
```bash
python -m scripts.validate_schema_consistency
```

**What it does**:
- Checks all model columns exist in database
- Reports missing columns as ERRORS
- Reports extra database columns as WARNINGS
- Provides detailed validation report
- Exits with code 1 if errors found (useful for CI/CD)

**When to use**:
- In CI/CD pipelines to catch schema drift
- Before running seed scripts
- After running migrations to verify completeness
- As a pre-deployment check

### 3. Cape Town Seed Script (`seed_capetown.py`)

**Purpose**: Seed the database with comprehensive production-like data.

**Usage**:
```bash
python -m scripts.seed_capetown
```

**What it does**:
- Clears all existing data
- Seeds all tables with Cape Town business data
- Creates demo user and superadmin
- Generates realistic orders, invoices, customers, etc.

**When to use**:
- Setting up local development environment
- After database reset
- Testing UI components with realistic data
- Demonstrating the application

## Workflow

### Development Workflow

1. **Update Models**: Make changes to SQLAlchemy models
2. **Sync Schema**: Run `auto_sync_schema.py` to add missing columns
3. **Validate**: Run `validate_schema_consistency.py` to confirm sync
4. **Create Migration**: Generate Alembic migration for the changes
5. **Test**: Run seed script to verify everything works

### Deployment Workflow

1. **Run Migrations**: `alembic upgrade head`
2. **Validate Schema**: `python -m scripts.validate_schema_consistency`
3. **Seed Data** (if needed): `python -m scripts.seed_capetown`

### CI/CD Integration

Add to your CI/CD pipeline:

```yaml
- name: Validate Schema
  run: |
    cd backend
    python -m scripts.validate_schema_consistency
```

This will fail the build if schema is out of sync.

## Common Issues and Solutions

### Issue: Seed script fails with "column does not exist"

**Solution**:
```bash
python -m scripts.auto_sync_schema
python -m scripts.seed_capetown
```

### Issue: Migration created but columns still missing

**Cause**: Migration might not include all model changes

**Solution**:
1. Run `auto_sync_schema.py` to add missing columns immediately
2. Review and update the migration file
3. Run `validate_schema_consistency.py` to confirm

### Issue: Validation reports extra columns in database

**Cause**: Database has columns not defined in models (possibly from old migrations)

**Solution**:
- If columns are obsolete: Create migration to drop them
- If columns are needed: Add them to the model

### Issue: "NOT NULL constraint violation" when adding columns

**Cause**: Trying to add NOT NULL column to table with existing data

**Solution**:
The auto_sync_schema tool handles this by:
1. Adding column as nullable first
2. Setting default values if specified in model
3. For manual fixes, create a migration that:
   - Adds column as nullable
   - Updates existing rows with default value
   - Alters column to NOT NULL

## Best Practices

1. **Always validate before deployment**
   ```bash
   python -m scripts.validate_schema_consistency
   ```

2. **Run auto-sync after model changes**
   ```bash
   python -m scripts.auto_sync_schema
   ```

3. **Keep migrations in sync with models**
   - After auto-sync, create proper migration
   - Don't rely on auto-sync in production

4. **Test seed script regularly**
   - Ensures all tables and columns are properly defined
   - Catches schema issues early

5. **Use validation in CI/CD**
   - Prevents deploying with schema mismatches
   - Catches issues before they reach production

## Technical Details

### Synchronous Database Connection

All scripts use `SyncSessionLocal` from `app.core.sync_database` which provides:
- Synchronous psycopg connection (not asyncpg)
- Compatible with Alembic and scripts
- Separate from async application database connection

### Column Type Mapping

The auto_sync_schema tool maps SQLAlchemy types to PostgreSQL types:
- `UUID` → `UUID`
- `JSONB` → `JSONB`
- `Boolean` → `BOOLEAN`
- `Integer` → `INTEGER`
- `Numeric(p,s)` → `NUMERIC(p,s)`
- `DateTime` → `TIMESTAMP WITH TIME ZONE`
- `Date` → `DATE`
- `Text` → `TEXT`
- `String(n)` → `VARCHAR(n)`
- `ARRAY` → `VARCHAR[]`

### Base Model Columns

All models inherit from `BaseModel` which provides:
- `id` (UUID, primary key)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `deleted_at` (timestamp, for soft deletes)

Some models override the primary key (e.g., `tier_features` uses `tier_name`).

## Files

- `auto_sync_schema.py` - Automatic schema synchronization
- `validate_schema_consistency.py` - Schema validation tool
- `seed_capetown.py` - Comprehensive seed script
- `../app/core/sync_database.py` - Synchronous database connection

## Support

If you encounter issues:
1. Check this README for common solutions
2. Run validation to see specific errors
3. Review model definitions and migrations
4. Check database logs for constraint violations
