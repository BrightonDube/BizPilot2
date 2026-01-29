import sqlite3

conn = sqlite3.connect('bizpilot.db')
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()

print("Tables in database:")
for table in tables:
    print(f"  - {table[0]}")

# Check if alembic_version exists
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version'")
alembic_table = cursor.fetchone()

if alembic_table:
    cursor.execute("SELECT version_num FROM alembic_version")
    version = cursor.fetchone()
    if version:
        print(f"\nCurrent Alembic version: {version[0]}")
    else:
        print("\nAlembic version table exists but is empty")
else:
    print("\nNo alembic_version table found")

conn.close()
