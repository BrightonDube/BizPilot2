"""Check database structure."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import SessionLocal

db = SessionLocal()

# Get all tables
result = db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"))
tables = [r[0] for r in result]
print("=== TABLES ===")
for t in tables:
    print(f"  - {t}")

# Get enum types
print("\n=== ENUM TYPES ===")
result = db.execute(text("SELECT typname, enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid ORDER BY typname, enumsortorder"))
enums = {}
for row in result:
    if row[0] not in enums:
        enums[row[0]] = []
    enums[row[0]].append(row[1])
for name, values in enums.items():
    print(f"  {name}: {values}")

db.close()
