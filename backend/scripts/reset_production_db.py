"""
Reset production database - drop all tables and recreate schema
"""
import os
import sys
from sqlalchemy import create_engine, text

def reset_database():
    """Drop all tables and recreate schema"""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)
    
    print("Connecting to database...")
    engine = create_engine(database_url, isolation_level="AUTOCOMMIT")
    
    with engine.connect() as conn:
        print("Dropping all tables...")
        
        # Drop all tables in public schema
        result = conn.execute(text("""
            SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        """))
        tables = [row[0] for row in result]
        
        for table in tables:
            print(f"  Dropping table: {table}")
            conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
        
        print("Dropping all enum types...")
        
        # Drop all enum types
        result = conn.execute(text("""
            SELECT t.typname
            FROM pg_type t
            JOIN pg_namespace n ON t.typnamespace = n.oid
            WHERE n.nspname = 'public' AND t.typtype = 'e'
        """))
        types = [row[0] for row in result]
        
        for type_name in types:
            print(f"  Dropping type: {type_name}")
            conn.execute(text(f'DROP TYPE IF EXISTS "{type_name}" CASCADE'))
        
        print("Database reset complete!")

if __name__ == "__main__":
    reset_database()
