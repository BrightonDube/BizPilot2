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
    
    print(f"Connecting to database...")
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        print("Dropping all tables...")
        
        # Drop all tables in public schema
        conn.execute(text("""
            DO $$ DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
                END LOOP;
            END $$;
        """))
        
        # Drop all types
        conn.execute(text("""
            DO $$ DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e') LOOP
                    EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
                END LOOP;
            END $$;
        """))
        
        # Drop alembic version table
        conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE"))
        
        conn.commit()
        print("Database reset complete!")

if __name__ == "__main__":
    reset_database()
