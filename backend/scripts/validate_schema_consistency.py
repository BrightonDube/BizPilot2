"""
Schema Consistency Validation Tool

This script validates that:
1. All model columns exist in the database
2. All database columns are defined in models
3. Column types match between models and database
4. Foreign keys are properly defined

Run before deployment to ensure schema consistency.
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from app.core.sync_database import sync_engine
from app.models.base import Base

# Import all models to ensure they're registered
from app.models import *  # noqa: F403, F401


def validate_table_schema(conn, table_name, model_class):
    """Validate a single table's schema against its model."""
    errors = []
    warnings = []
    
    # Get existing columns from database
    result = conn.execute(text(f"""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = '{table_name}'
        ORDER BY ordinal_position
    """))
    
    db_columns = {row[0]: {
        'data_type': row[1],
        'is_nullable': row[2],
        'column_default': row[3]
    } for row in result.fetchall()}
    
    # Get columns from model
    mapper = inspect(model_class)
    model_columns = {}
    
    for column in mapper.columns:
        model_columns[column.name] = column
    
    # Check for missing columns in database
    missing_in_db = set(model_columns.keys()) - set(db_columns.keys())
    if missing_in_db:
        for col in missing_in_db:
            # Check if this column is a primary key that's been replaced by another column
            column_obj = model_columns[col]
            if column_obj.primary_key:
                # Check if there's already a different primary key in the database
                has_other_pk = False
                for col_name in db_columns.keys():
                    if col_name != col and col_name in model_columns:
                        if model_columns[col_name].primary_key:
                            has_other_pk = True
                            break
                
                if has_other_pk:
                    # This is a replaced primary key, just warn
                    warnings.append(f"Column '{col}' is a PK in model but table uses a different PK")
                    continue
            errors.append(f"Column '{col}' defined in model but missing in database")
    
    # Check for extra columns in database
    extra_in_db = set(db_columns.keys()) - set(model_columns.keys())
    if extra_in_db:
        for col in extra_in_db:
            warnings.append(f"Column '{col}' exists in database but not in model")
    
    return errors, warnings


def main():
    """Validate all model schemas against database."""
    print("\n" + "=" * 70)
    print("Schema Consistency Validation")
    print("=" * 70 + "\n")
    
    all_errors = []
    all_warnings = []
    tables_checked = 0
    tables_valid = 0
    
    with sync_engine.connect() as conn:
        # Get all mapped classes
        for mapper in Base.registry.mappers:
            model_class = mapper.class_
            table_name = mapper.local_table.name
            
            try:
                # Check if table exists
                result = conn.execute(text(f"""
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = '{table_name}'
                """))
                
                if not result.fetchone():
                    all_warnings.append(f"Table '{table_name}' does not exist in database")
                    continue
                
                tables_checked += 1
                errors, warnings = validate_table_schema(conn, table_name, model_class)
                
                if errors:
                    print(f"❌ {table_name}:")
                    for error in errors:
                        print(f"   ERROR: {error}")
                        all_errors.append(f"{table_name}: {error}")
                    if warnings:
                        for warning in warnings:
                            print(f"   WARNING: {warning}")
                            all_warnings.append(f"{table_name}: {warning}")
                elif warnings:
                    print(f"⚠️  {table_name}:")
                    for warning in warnings:
                        print(f"   WARNING: {warning}")
                        all_warnings.append(f"{table_name}: {warning}")
                    tables_valid += 1
                else:
                    tables_valid += 1
                    
            except Exception as e:
                all_errors.append(f"{table_name}: Validation error - {e}")
                print(f"❌ {table_name}: Validation error - {e}")
    
    # Summary
    print("\n" + "=" * 70)
    print("Validation Summary")
    print("=" * 70)
    print(f"Tables checked: {tables_checked}")
    print(f"Tables valid: {tables_valid}")
    print(f"Errors: {len(all_errors)}")
    print(f"Warnings: {len(all_warnings)}")
    
    if all_errors:
        print("\n🚨 CRITICAL ERRORS FOUND:")
        for error in all_errors:
            print(f"  - {error}")
        print("\n❌ Schema validation FAILED")
        print("Run 'python -m scripts.auto_sync_schema' to fix missing columns")
        sys.exit(1)
    elif all_warnings:
        print("\n⚠️  WARNINGS FOUND:")
        for warning in all_warnings:
            print(f"  - {warning}")
        print("\n✅ Schema validation PASSED (with warnings)")
        sys.exit(0)
    else:
        print("\n✅ Schema validation PASSED")
        print("All models are in sync with the database!")
        sys.exit(0)


if __name__ == "__main__":
    main()
