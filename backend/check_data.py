import sqlite3

conn = sqlite3.connect('bizpilot.db')
cursor = conn.cursor()

tables = ['users', 'organizations', 'businesses', 'products', 'product_categories']

print("Checking for data in tables:")
for table in tables:
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"  {table}: {count} rows")
    except Exception as e:
        print(f"  {table}: Error - {e}")

conn.close()
