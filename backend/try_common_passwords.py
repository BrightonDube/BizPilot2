"""
PostgreSQL Setup - Try Common Passwords
Attempts connection with common default passwords
"""

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

DB_NAME = "bizpilot"
DB_USER = "bizpilot_user"
DB_PASSWORD = "btXZ6v71UVjzTCnaFWqe9oY4"

# Common default passwords to try
COMMON_PASSWORDS = [
    "postgres",
    "admin",
    "password",
    "root",
    "12345",
    "123456",
    "",  # Empty password
]

print("="*60)
print("  Trying Common Postgres Passwords")
print("="*60)
print()
print("⚠️  This will try common passwords. Not recommended for production!")
print()

success = False
working_password = None

for pwd in COMMON_PASSWORDS:
    try:
        print(f"Trying password: '{'(empty)' if pwd == '' else '***'}'...", end=" ")
        
        if pwd:
            conn = psycopg2.connect(
                dbname="postgres",
                user="postgres",
                password=pwd,
                host="localhost",
                port=5432,
                connect_timeout=3
            )
        else:
            conn = psycopg2.connect(
                dbname="postgres",
                user="postgres",
                host="localhost",
                port=5432,
                connect_timeout=3
            )
        
        print("✅ SUCCESS!")
        working_password = pwd
        success = True
        
        # Now set up the database
        print()
        print("Found working password! Setting up database...")
        print()
        
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Create database
        try:
            cursor.execute(f"DROP DATABASE IF EXISTS {DB_NAME};")
            cursor.execute(f"CREATE DATABASE {DB_NAME};")
            print(f"✅ Database '{DB_NAME}' created")
        except:
            print(f"⚠️  Database '{DB_NAME}' may already exist")
        
        # Create user
        try:
            cursor.execute(f"DROP USER IF EXISTS {DB_USER};")
            cursor.execute(f"CREATE USER {DB_USER} WITH PASSWORD '{DB_PASSWORD}';")
            print(f"✅ User '{DB_USER}' created")
        except:
            print(f"⚠️  User '{DB_USER}' may already exist")
        
        # Grant privileges
        cursor.execute(f"GRANT ALL PRIVILEGES ON DATABASE {DB_NAME} TO {DB_USER};")
        print("✅ Privileges granted")
        
        cursor.close()
        conn.close()
        
        # Connect to new database for schema privileges
        if pwd:
            conn = psycopg2.connect(
                dbname=DB_NAME,
                user="postgres",
                password=pwd,
                host="localhost"
            )
        else:
            conn = psycopg2.connect(
                dbname=DB_NAME,
                user="postgres",
                host="localhost"
            )
        
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        cursor.execute(f"GRANT ALL ON SCHEMA public TO {DB_USER};")
        cursor.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO {DB_USER};")
        cursor.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO {DB_USER};")
        print("✅ Schema privileges granted")
        
        cursor.close()
        conn.close()
        
        break
        
    except psycopg2.OperationalError:
        print("❌ Failed")
    except Exception as e:
        print(f"❌ Error: {e}")

print()
if success:
    print("="*60)
    print("  ✅ Database Setup Complete!")
    print("="*60)
    print()
    print(f"Postgres password is: {'(empty)' if working_password == '' else working_password}")
    print(f"Database: {DB_NAME}")
    print(f"User: {DB_USER}")
    print(f"Password: {DB_PASSWORD}")
    print()
    print("⚠️  IMPORTANT: Change the postgres password for security:")
    print(f"  psql -U postgres")
    print(f"  ALTER USER postgres WITH PASSWORD 'your_secure_password';")
    print()
else:
    print("="*60)
    print("  ❌ Could Not Connect")
    print("="*60)
    print()
    print("None of the common passwords worked.")
    print()
    print("Options:")
    print("  1. Check pgAdmin - it might have saved password")
    print("  2. Reset password manually (see POSTGRES_PASSWORD_HELP.md)")
    print("  3. Contact your system administrator")
    print()
