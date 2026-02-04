"""
Automatic Schema Synchronization Tool

This script automatically detects and fixes schema mismatches between
SQLAlchemy models and the actual database schema by:
1. Inspecting all model definitions
2. Comparing with actual database columns
3. Adding any missing columns with appropriate types

This ensures the database always matches the models.
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect, Integer, String, Boolean, Numeric, DateTime, Date, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from app.core.sync_database import sync_engine
from app.models.base import Base

# Import all models to ensure they're registered
from app.models import *  # noqa: F403, F401


def get_sqlalchemy_type_to_pg(column):
    """Convert SQLAlchemy column type to PostgreSQL type string."""
    col_type = column.type
    
    if isinstance(col_type, UUID):
        return "UUID"
    elif isinstance(col_type, JSONB):
        return "JSONB"
    elif isinstance(col_type, Boolean):
        return "BOOLEAN"
    elif isinstance(col_type, Integer):
        return "INTEGER"
    elif isinstance(col_type, Numeric):
        precision = getattr(col_type, 'precision', 12)
        scale = getattr(col_type, 'scale', 2)
        return f"NUMERIC({precision},{scale})"
    elif isinstance(col_type, DateTime):
        return "TIMESTAMP WITH TIME ZONE"
    elif isinstance(col_type, Date):
        return "DATE"
    elif isinstance(col_type, Text):
        return "TEXT"
    elif isinstance(col_type, String):
        length = getattr(col_type, 'length', None)
        if length:
            return f"VARCHAR({length})"
        return "VARCHAR"
    elif isinstance(col_type, ARRAY):
        return "VARCHAR[]"  # Simplified for common case
    else:
        # Default fallback
        return "TEXT"


def sync_table_schema(conn, table_name, model_class):
    """Sync a single table's schema with its model."""
    print(f"\nChecking table: {table_name}")
    
    # Get existing columns from database
    result = conn.execute(text(f"""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = '{table_name}'
    """))
    
    existing_columns = {row[0]: row for row in result.fetchall()}
    
    # Get columns from model
    mapper = inspect(model_class)
    model_columns = {}
    
    for column in mapper.columns:
        # Include ALL columns, even base model columns
        model_columns[column.name] = column
    
    # Find missing columns
    missing_columns = set(model_columns.keys()) - set(existing_columns.keys())
    
    if not missing_columns:
        print("  ✓ All columns exist")
        return
    
    print(f"  Adding {len(missing_columns)} missing columns: {', '.join(missing_columns)}")
    
    # Add missing columns
    for col_name in missing_columns:
        column = model_columns[col_name]
        pg_type = get_sqlalchemy_type_to_pg(column)
        
        nullable = "NULL" if column.nullable else "NOT NULL"
        default = ""
        
        if column.default is not None:
            if hasattr(column.default, 'arg'):
                if callable(column.default.arg):
                    # Skip callable defaults
                    default = ""
                elif isinstance(column.default.arg, bool):
                    default = f"DEFAULT {str(column.default.arg).upper()}"
                elif isinstance(column.default.arg, (int, float)):
                    default = f"DEFAULT {column.default.arg}"
                elif isinstance(column.default.arg, str):
                    default = f"DEFAULT '{column.default.arg}'"
        
        try:
            sql = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {pg_type} {default} {nullable}"
            print(f"    Executing: {sql}")
            conn.execute(text(sql))
            conn.commit()
            print(f"    ✓ Added column: {col_name}")
        except Exception as e:
            print(f"    ⚠ Warning for {col_name}: {e}")
            conn.rollback()


def main():
    """Automatically sync all model schemas with database."""
    print("\n" + "=" * 60)
    print("Automatic Schema Synchronization")
    print("=" * 60)
    
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
                
                if result.fetchone():
                    sync_table_schema(conn, table_name, model_class)
                else:
                    print(f"\n⚠ Table {table_name} does not exist (skipping)")
                    
            except Exception as e:
                print(f"\n❌ Error processing {table_name}: {e}")
                continue
        
        print("\n" + "=" * 60)
        print("✅ Schema synchronization complete!")
        print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
