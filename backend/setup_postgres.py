"""
Setup PostgreSQL database for BizPilot2
This script creates the database and user using Python
"""

import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Database configuration
DB_NAME = "bizpilot"
DB_USER = "bizpilot_user"
DB_PASSWORD = "btXZ6v71UVjzTCnaFWqe9oY4"
DB_HOST = "localhost"
DB_PORT = 5432

print("="*60)
print("  BizPilot2 PostgreSQL Setup")
print("="*60)
print()

# Ask for postgres password
postgres_password = input("Enter postgres password (or press Enter to try without): ").strip()

try:
    # Connect to PostgreSQL as superuser
    print("1. Connecting to PostgreSQL...")
    
    if postgres_password:
        conn = psycopg2.connect(
            dbname="postgres",
            user="postgres",
            password=postgres_password,
            host=DB_HOST,
            port=DB_PORT
        )
    else:
        # Try without password (trusted authentication)
        conn = psycopg2.connect(
            dbname="postgres",
            user="postgres",
            host=DB_HOST,
            port=DB_PORT
        )
    
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    print("   ✅ Connected to PostgreSQL")
    print()
    
    # Drop existing database if exists
    print("2. Dropping existing database (if exists)...")
    cursor.execute(f"DROP DATABASE IF EXISTS {DB_NAME};")
    print("   ✅ Cleaned up")
    print()
    
    # Drop existing user if exists
    print("3. Dropping existing user (if exists)...")
    cursor.execute(f"DROP USER IF EXISTS {DB_USER};")
    print("   ✅ Cleaned up")
    print()
    
    # Create new database
    print("4. Creating database...")
    cursor.execute(f"CREATE DATABASE {DB_NAME};")
    print(f"   ✅ Database '{DB_NAME}' created")
    print()
    
    # Create new user
    print("5. Creating user...")
    cursor.execute(f"CREATE USER {DB_USER} WITH PASSWORD '{DB_PASSWORD}';")
    print(f"   ✅ User '{DB_USER}' created")
    print()
    
    # Grant privileges on database
    print("6. Granting database privileges...")
    cursor.execute(f"GRANT ALL PRIVILEGES ON DATABASE {DB_NAME} TO {DB_USER};")
    print("   ✅ Database privileges granted")
    print()
    
    # Close connection to postgres database
    cursor.close()
    conn.close()
    
    # Connect to the new database to grant schema privileges
    print("7. Connecting to new database...")
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user="postgres",
        password=postgres_password if postgres_password else None,
        host=DB_HOST,
        port=DB_PORT
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    print("   ✅ Connected to new database")
    print()
    
    # Grant schema privileges
    print("8. Granting schema privileges...")
    cursor.execute(f"GRANT ALL ON SCHEMA public TO {DB_USER};")
    cursor.execute(f"GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO {DB_USER};")
    cursor.execute(f"GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO {DB_USER};")
    print("   ✅ Schema privileges granted")
    print()
    
    # Grant default privileges for future objects
    print("9. Setting default privileges...")
    cursor.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO {DB_USER};")
    cursor.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO {DB_USER};")
    cursor.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO {DB_USER};")
    print("   ✅ Default privileges set")
    print()
    
    # Verify setup
    print("10. Verifying setup...")
    cursor.execute("SELECT version();")
    version = cursor.fetchone()[0]
    print(f"   PostgreSQL: {version[:50]}...")
    print()
    
    cursor.close()
    conn.close()
    
    print("="*60)
    print("  ✅ Setup Complete!")
    print("="*60)
    print()
    print("Database Details:")
    print(f"  Database: {DB_NAME}")
    print(f"  Username: {DB_USER}")
    print(f"  Password: {DB_PASSWORD}")
    print(f"  Host:     {DB_HOST}:{DB_PORT}")
    print()
    print("Connection String (in .env):")
    print(f"  DATABASE_URL=postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}")
    print()
    print("✅ Your database is ready!")
    print()
    
    sys.exit(0)
    
except psycopg2.OperationalError as e:
    print()
    print("❌ Connection failed!")
    print(f"   Error: {e}")
    print()
    print("Possible solutions:")
    print("  1. Check postgres password")
    print("  2. Check PostgreSQL service is running:")
    print("     Get-Service postgresql-x64-18")
    print("  3. Try resetting postgres password in pgAdmin")
    print()
    sys.exit(1)
    
except Exception as e:
    print()
    print(f"❌ Error: {e}")
    print()
    sys.exit(1)
