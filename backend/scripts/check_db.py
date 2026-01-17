"""
Quick database check script to verify connection and data.
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import SessionLocal
from app.models.user import User

def main():
    print("=" * 60)
    print("DATABASE CONNECTION CHECK")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Test connection
        print("\n1. Testing database connection...")
        result = db.execute(text("SELECT version()"))
        version = result.scalar()
        print(f"   ✓ Connected to: {version}")
        
        # Check users table
        print("\n2. Checking users table...")
        user_count = db.query(User).count()
        print(f"   ✓ Total users: {user_count}")
        
        if user_count > 0:
            print("\n3. Sample users:")
            users = db.query(User).limit(5).all()
            for user in users:
                print(f"   - {user.email} (superadmin={user.is_superadmin}, admin={user.is_admin})")
        else:
            print("\n   ⚠ WARNING: No users found in database!")
            print("   Database needs to be seeded.")
        
        print("\n" + "=" * 60)
        print("CHECK COMPLETE")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n   ✗ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
