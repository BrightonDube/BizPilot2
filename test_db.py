import os
import sys

# Setup environment
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")
os.environ.setdefault("DATABASE_URL", "postgresql://bizpilot:bizpilot@localhost:5432/bizpilot")

# Add paths
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app.core.database import get_sync_db

try:
    db = next(get_sync_db())
    print("DB CONNECTION SUCCESS")
except Exception as e:
    print(f"DB CONNECTION FAILED: {e}")
