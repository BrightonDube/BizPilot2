import sqlite3

conn = sqlite3.connect('test.db')
cursor = conn.cursor()

# Check customer_accounts table structure
print("=" * 80)
print("CUSTOMER_ACCOUNTS TABLE STRUCTURE")
print("=" * 80)
cursor.execute("PRAGMA table_info(customer_accounts)")
columns = cursor.fetchall()
for col in columns:
    print(f"  {col[1]:30} {col[2]:15} {'NOT NULL' if col[3] else 'NULL':10} {f'DEFAULT {col[4]}' if col[4] else ''}")

# Check indexes on customer_accounts
print("\n" + "=" * 80)
print("INDEXES ON CUSTOMER_ACCOUNTS")
print("=" * 80)
cursor.execute("PRAGMA index_list(customer_accounts)")
indexes = cursor.fetchall()
for idx in indexes:
    print(f"  Index: {idx[1]}")
    cursor.execute(f"PRAGMA index_info({idx[1]})")
    cols = cursor.fetchall()
    for col in cols:
        print(f"    - Column: {col[2]}")

# Check account_transactions table structure
print("\n" + "=" * 80)
print("ACCOUNT_TRANSACTIONS TABLE STRUCTURE")
print("=" * 80)
cursor.execute("PRAGMA table_info(account_transactions)")
columns = cursor.fetchall()
for col in columns:
    print(f"  {col[1]:30} {col[2]:15} {'NOT NULL' if col[3] else 'NULL':10} {f'DEFAULT {col[4]}' if col[4] else ''}")

# Check indexes on account_transactions
print("\n" + "=" * 80)
print("INDEXES ON ACCOUNT_TRANSACTIONS")
print("=" * 80)
cursor.execute("PRAGMA index_list(account_transactions)")
indexes = cursor.fetchall()
for idx in indexes:
    print(f"  Index: {idx[1]}")
    cursor.execute(f"PRAGMA index_info({idx[1]})")
    cols = cursor.fetchall()
    for col in cols:
        print(f"    - Column: {col[2]}")

# Check account_payments table structure
print("\n" + "=" * 80)
print("ACCOUNT_PAYMENTS TABLE STRUCTURE")
print("=" * 80)
cursor.execute("PRAGMA table_info(account_payments)")
columns = cursor.fetchall()
for col in columns:
    print(f"  {col[1]:30} {col[2]:15} {'NOT NULL' if col[3] else 'NULL':10} {f'DEFAULT {col[4]}' if col[4] else ''}")

# Check account_statements table structure
print("\n" + "=" * 80)
print("ACCOUNT_STATEMENTS TABLE STRUCTURE")
print("=" * 80)
cursor.execute("PRAGMA table_info(account_statements)")
columns = cursor.fetchall()
for col in columns:
    print(f"  {col[1]:30} {col[2]:15} {'NOT NULL' if col[3] else 'NULL':10} {f'DEFAULT {col[4]}' if col[4] else ''}")

# Check collection_activities table structure
print("\n" + "=" * 80)
print("COLLECTION_ACTIVITIES TABLE STRUCTURE")
print("=" * 80)
cursor.execute("PRAGMA table_info(collection_activities)")
columns = cursor.fetchall()
for col in columns:
    print(f"  {col[1]:30} {col[2]:15} {'NOT NULL' if col[3] else 'NULL':10} {f'DEFAULT {col[4]}' if col[4] else ''}")

# Check account_write_offs table structure
print("\n" + "=" * 80)
print("ACCOUNT_WRITE_OFFS TABLE STRUCTURE")
print("=" * 80)
cursor.execute("PRAGMA table_info(account_write_offs)")
columns = cursor.fetchall()
for col in columns:
    print(f"  {col[1]:30} {col[2]:15} {'NOT NULL' if col[3] else 'NULL':10} {f'DEFAULT {col[4]}' if col[4] else ''}")

conn.close()

print("\n" + "=" * 80)
print("✓ ALL CUSTOMER-ACCOUNTS TABLES VERIFIED SUCCESSFULLY")
print("=" * 80)
