import sqlite3

conn = sqlite3.connect('bizpilot.db')
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()

print("All tables in database:")
for table in tables:
    print(f"  - {table[0]}")

print(f"\nTotal tables: {len(tables)}")

# Check customer_accounts tables
customer_account_tables = [
    'customer_accounts',
    'account_transactions',
    'account_payments',
    'payment_allocations',
    'account_statements',
    'collection_activities',
    'account_write_offs'
]

print("\nCustomer account tables status:")
for table_name in customer_account_tables:
    cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'")
    exists = cursor.fetchone()
    status = "✓ EXISTS" if exists else "✗ MISSING"
    print(f"  {status}: {table_name}")

conn.close()
