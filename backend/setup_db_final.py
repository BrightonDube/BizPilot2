"""
Final PostgreSQL Setup Script
Uses the generated password to set up everything
"""

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import sys

# Configuration
DB_NAME = "bizpilot"
DB_USER = "bizpilot_user"
DB_PASSWORD = "btXZ6v71UVjzTCnaFWqe9oY4"
POSTGRES_PASSWORD = "BizPilot2026!"  # New postgres password

print("="*60)
print("  BizPilot2 PostgreSQL Setup - Automated")
print("="*60)
print()
print("Using generated password to set up PostgreSQL...")
print()

try:
    # Step 1: Connect to PostgreSQL
    print("1. Connecting to PostgreSQL server...")
    conn = psycopg2.connect(
        dbname="postgres",
        user="postgres",
        password=POSTGRES_PASSWORD,
        host="localhost",
        port=5432,
        connect_timeout=5
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    print("   ✅ Connected successfully!")
    print()
    
    # Step 2: Drop existing database if exists
    print("2. Cleaning up existing database (if any)...")
    cursor.execute(f"DROP DATABASE IF EXISTS {DB_NAME};")
    print("   ✅ Cleaned")
    print()
    
    # Step 3: Drop existing user if exists
    print("3. Cleaning up existing user (if any)...")
    cursor.execute(f"DROP USER IF EXISTS {DB_USER};")
    print("   ✅ Cleaned")
    print()
    
    # Step 4: Create database
    print("4. Creating database 'bizpilot'...")
    cursor.execute(f"CREATE DATABASE {DB_NAME};")
    print(f"   ✅ Database '{DB_NAME}' created")
    print()
    
    # Step 5: Create user
    print("5. Creating user 'bizpilot_user'...")
    cursor.execute(f"CREATE USER {DB_USER} WITH PASSWORD '{DB_PASSWORD}' LOGIN;")
    print(f"   ✅ User '{DB_USER}' created with login privileges")
    print()
    
    # Step 6: Grant database privileges
    print("6. Granting database privileges...")
    cursor.execute(f"GRANT ALL PRIVILEGES ON DATABASE {DB_NAME} TO {DB_USER};")
    print("   ✅ ALL database privileges granted")
    print()
    
    cursor.close()
    conn.close()
    
    # Step 7: Connect to new database for schema privileges
    print("7. Connecting to 'bizpilot' database...")
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user="postgres",
        password=POSTGRES_PASSWORD,
        host="localhost",
        port=5432
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    print("   ✅ Connected to new database")
    print()
    
    # Step 8: Grant schema privileges
    print("8. Granting schema privileges...")
    cursor.execute(f"GRANT ALL ON SCHEMA public TO {DB_USER};")
    cursor.execute(f"GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO {DB_USER};")
    cursor.execute(f"GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO {DB_USER};")
    print("   ✅ ALL schema privileges granted")
    print()
    
    # Step 9: Set default privileges for future objects
    print("9. Setting default privileges for future objects...")
    cursor.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO {DB_USER};")
    cursor.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO {DB_USER};")
    cursor.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO {DB_USER};")
    print("   ✅ Default privileges set")
    print()
    
    # Step 10: Verify setup
    print("10. Verifying setup...")
    cursor.execute("SELECT current_database(), current_user, version();")
    db, user, version = cursor.fetchone()
    print(f"   Database: {db}")
    print(f"   User: {user}")
    print(f"   PostgreSQL: {version[:60]}...")
    print()
    
    # Check bizpilot_user privileges
    cursor.execute("""
        SELECT grantee, privilege_type 
        FROM information_schema.role_table_grants 
        WHERE grantee = %s
        LIMIT 5;
    """, (DB_USER,))
    
    cursor.close()
    conn.close()
    
    # Success!
    print("="*60)
    print("  ✅ Database Setup Complete!")
    print("="*60)
    print()
    print("Database Details:")
    print(f"  Database:  {DB_NAME}")
    print(f"  Username:  {DB_USER}")
    print(f"  Password:  {DB_PASSWORD}")
    print("  Host:      localhost")
    print("  Port:      5432")
    print()
    print("Connection String (async - already in .env):")
    print(f"  postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@localhost:5432/{DB_NAME}")
    print()
    print("✅ Your PostgreSQL database is ready!")
    print()
    print("Next Steps:")
    print("  1. Run migrations: python -m alembic upgrade head")
    print("  2. Seed data (optional): python scripts/seed_capetown.py")
    print("  3. Restart backend server")
    print()
    
    sys.exit(0)
    
except psycopg2.OperationalError as e:
    print()
    print("❌ Connection Failed!")
    print()
    print(f"Error: {e}")
    print()
    if "password authentication failed" in str(e):
        print("The generated password didn't work for 'postgres' user.")
        print()
        print("This means the postgres user has a different password.")
        print("Please use pgAdmin or reset the password manually.")
        print("See POSTGRES_FINAL_SOLUTION.md for instructions.")
    else:
        print("PostgreSQL connection issue.")
        print("Check that PostgreSQL service is running:")
        print("  Get-Service postgresql-x64-18")
    print()
    sys.exit(1)
    
except Exception as e:
    print()
    print(f"❌ Unexpected Error: {e}")
    print()
    import traceback
    traceback.print_exc()
    sys.exit(1)
