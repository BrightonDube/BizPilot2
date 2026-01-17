"""Quick script to check users in the database."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.user import User
from sqlalchemy import text

def main():
    db = SessionLocal()
    
    try:
        # Check if we can connect
        db.execute(text("SELECT 1"))
        print("✓ Database connection successful")
        
        # Count users
        user_count = db.query(User).count()
        print(f"✓ Total users: {user_count}")
        
        # List all users
        users = db.query(User).all()
        for user in users:
            print(f"\nUser: {user.email}")
            print(f"  ID: {user.id}")
            print(f"  Name: {user.first_name} {user.last_name}")
            print(f"  Has password: {bool(user.hashed_password)}")
            print(f"  Is superadmin: {user.is_superadmin}")
            print(f"  Status: {user.status}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()
