"""
Diagnose login errors by testing the authentication flow directly.
Run: python diagnose_login_error.py
"""

import sys
import traceback
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    print("🔍 Diagnosing Login Error")
    print("=" * 60)
    
    # Test 1: Import dependencies
    print("\n1️⃣ Testing imports...")
    from app.core.database import SessionLocal
    from app.models.user import User
    from app.core.security import verify_password, get_password_hash
    print("   ✅ All imports successful")
    
    # Test 2: Database connection
    print("\n2️⃣ Testing database connection...")
    db = SessionLocal()
    user_count = db.query(User).count()
    print(f"   ✅ Database connected. Found {user_count} users")
    
    # Test 3: Get first user
    print("\n3️⃣ Getting first user...")
    first_user = db.query(User).first()
    if not first_user:
        print("   ❌ No users found in database!")
        print("   💡 You need to create a user first or run migrations")
        sys.exit(1)
    
    print(f"   ✅ Found user: {first_user.email}")
    print(f"      - ID: {first_user.id}")
    print(f"      - Has password: {first_user.hashed_password is not None}")
    print(f"      - Status: {first_user.status.value if first_user.status else 'None'}")
    
    # Test 4: Check password hash format
    print("\n4️⃣ Checking password hash format...")
    if first_user.hashed_password:
        hash_sample = first_user.hashed_password[:20] + "..."
        print(f"   Hash sample: {hash_sample}")
        
        # Check if it's bcrypt format
        if first_user.hashed_password.startswith('$2b$') or first_user.hashed_password.startswith('$2a$'):
            print("   ✅ Hash format looks like bcrypt")
        else:
            print("   ⚠️  Hash format doesn't look like bcrypt!")
            print(f"   Full hash: {first_user.hashed_password}")
    
    # Test 5: Try password verification with a test password
    print("\n5️⃣ Testing password hashing...")
    try:
        test_password = "test123"
        test_hash = get_password_hash(test_password)
        print("   ✅ Can create password hash")
        print(f"   Test hash: {test_hash[:30]}...")
        
        # Verify it
        can_verify = verify_password(test_password, test_hash)
        print(f"   ✅ Can verify password: {can_verify}")
        
    except Exception as e:
        print(f"   ❌ Password hashing failed: {e}")
        traceback.print_exc()
    
    # Test 6: Try to verify actual user password (if you know it)
    print("\n6️⃣ Testing actual user password verification...")
    print("   Enter the password for this user (or press Enter to skip):")
    print(f"   User: {first_user.email}")
    
    # For automated testing, skip this
    print("   ⏭️  Skipping interactive password test")
    
    # Test 7: Check bcrypt library
    print("\n7️⃣ Checking bcrypt library...")
    try:
        import bcrypt
        print(f"   ✅ bcrypt version: {bcrypt.__version__}")
        
        # Test bcrypt directly
        test_pw = b"test"
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(test_pw, salt)
        verified = bcrypt.checkpw(test_pw, hashed)
        print(f"   ✅ bcrypt works: {verified}")
        
    except Exception as e:
        print(f"   ❌ bcrypt error: {e}")
        traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("✅ Diagnosis complete!")
    print("\n💡 Next steps:")
    print("   1. Check the backend terminal for the actual error when you try to login")
    print("   2. The error is likely in password verification or database query")
    print("   3. If bcrypt version mismatch, you may need to reset passwords")
    
    db.close()
    
except Exception as e:
    print(f"\n❌ Fatal error during diagnosis: {e}")
    print("\nFull traceback:")
    traceback.print_exc()
    sys.exit(1)
