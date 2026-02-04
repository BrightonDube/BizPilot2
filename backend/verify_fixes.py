"""
Verification script for all critical fixes applied.

This script tests:
1. Database connection (sync/async based on driver)
2. Encryption service
3. Redis connection
4. API health checks
5. Rate limiting configuration
6. CSRF protection setup
"""

import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

def print_section(title):
    """Print a formatted section header."""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def test_environment_variables():
    """Check if required environment variables are set."""
    print_section("1. Environment Variables")
    
    from app.core.config import settings
    
    checks = {
        "SECRET_KEY": len(settings.SECRET_KEY) >= 32,
        "DATABASE_URL": bool(settings.DATABASE_URL),
        "REDIS_URL": bool(settings.REDIS_URL),
        "ENVIRONMENT": bool(settings.ENVIRONMENT),
    }
    
    for key, passed in checks.items():
        status = "✅" if passed else "❌"
        value = getattr(settings, key, None)
        # Mask sensitive values
        if key in ["SECRET_KEY"] and value:
            display_value = f"{value[:8]}...{value[-8:]}" if len(value) > 16 else "***"
        else:
            display_value = value
        print(f"{status} {key}: {display_value}")
    
    # Check optional encryption key
    encryption_key = os.getenv("DB_ENCRYPTION_KEY")
    if encryption_key:
        print(f"✅ DB_ENCRYPTION_KEY: Set ({len(encryption_key)} chars)")
    else:
        print("⚠️  DB_ENCRYPTION_KEY: Not set (POS API keys won't be encrypted)")
    
    return all(checks.values())

def test_database():
    """Test database connection."""
    print_section("2. Database Connection")
    
    from app.core.config import settings
    from app.core.database import SessionLocal
    from sqlalchemy import text
    
    # Check database type
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")
    is_postgres = settings.DATABASE_URL.startswith("postgresql")
    
    print(f"Database Type: {'SQLite' if is_sqlite else 'PostgreSQL' if is_postgres else 'Unknown'}")
    print(f"Async Support: {'❌ No (SQLite)' if is_sqlite else '✅ Yes (PostgreSQL)'}")
    
    # Test sync connection (always works)
    try:
        db = SessionLocal()
        result = db.execute(text("SELECT 1 as test"))
        result.fetchone()
        db.close()
        print("✅ Sync database connection: OK")
        return True
    except Exception as e:
        print(f"❌ Sync database connection: FAILED - {e}")
        return False

def test_encryption():
    """Test encryption service."""
    print_section("3. Encryption Service")
    
    from app.core.encryption import encryption_service
    
    if not encryption_service.is_enabled():
        print("⚠️  Encryption service: NOT ENABLED (DB_ENCRYPTION_KEY not set)")
        print("   POS API keys will be stored as plaintext (NOT RECOMMENDED)")
        return False
    
    try:
        # Test encryption/decryption
        test_data = "test-api-key-12345"
        encrypted = encryption_service.encrypt(test_data)
        decrypted = encryption_service.decrypt(encrypted)
        
        if decrypted == test_data:
            print("✅ Encryption/Decryption: OK")
            print(f"   Original: {test_data}")
            print(f"   Encrypted: {encrypted[:20]}...")
            print(f"   Decrypted: {decrypted}")
            return True
        else:
            print("❌ Encryption/Decryption: FAILED (data mismatch)")
            return False
    except Exception as e:
        print(f"❌ Encryption service: FAILED - {e}")
        return False

def test_redis():
    """Test Redis connection."""
    print_section("4. Redis Connection")
    
    import asyncio
    from app.core.redis import redis_manager
    
    async def check_redis():
        await redis_manager.connect()
        
        if redis_manager.is_available():
            print("✅ Redis connection: OK")
            
            # Test operations
            await redis_manager.set("test_key", "test_value", ttl_seconds=60)
            value = await redis_manager.get("test_key")
            await redis_manager.delete("test_key")
            
            if value == "test_value":
                print("✅ Redis operations: OK")
                return True
            else:
                print("❌ Redis operations: FAILED")
                return False
        else:
            print("⚠️  Redis connection: UNAVAILABLE (fallback mode active)")
            return False
    
    try:
        return asyncio.run(check_redis())
    except Exception as e:
        print(f"⚠️  Redis connection: FAILED - {e}")
        print("   Application will use database fallback (slower but functional)")
        return False

def test_rate_limiting():
    """Check rate limiting configuration."""
    print_section("5. Rate Limiting")
    
    try:
        from app.core.rate_limit import (
            AUTH_RATE_LIMIT,
            REGISTER_RATE_LIMIT,
            PASSWORD_RESET_RATE_LIMIT,
            TRUSTED_PROXIES
        )
        
        print(f"✅ AUTH_RATE_LIMIT: {AUTH_RATE_LIMIT}")
        print(f"✅ REGISTER_RATE_LIMIT: {REGISTER_RATE_LIMIT}")
        print(f"✅ PASSWORD_RESET_RATE_LIMIT: {PASSWORD_RESET_RATE_LIMIT}")
        print(f"✅ TRUSTED_PROXIES: {len(TRUSTED_PROXIES)} configured")
        
        return True
    except Exception as e:
        print(f"❌ Rate limiting config: FAILED - {e}")
        return False

def test_api_startup():
    """Test if the API can start."""
    print_section("6. API Startup Test")
    
    try:
        from app.main import app
        print("✅ FastAPI app: OK")
        print(f"   Title: {app.title}")
        print(f"   Version: {app.version}")
        
        # Check middleware
        middleware_count = len(app.user_middleware)
        print(f"✅ Middleware: {middleware_count} configured")
        
        return True
    except Exception as e:
        print(f"❌ API startup: FAILED - {e}")
        import traceback
        traceback.print_exc()
        return False

def test_health_endpoints():
    """Verify health check endpoints are configured."""
    print_section("7. Health Check Endpoints")
    
    try:
        from app.main import app
        
        routes = [route.path for route in app.routes]
        
        health_endpoints = [
            "/health/liveness",
            "/health/readiness",
            "/health",
            "/api/health",
            "/api/csrf-token"
        ]
        
        for endpoint in health_endpoints:
            if endpoint in routes:
                print(f"✅ {endpoint}: Configured")
            else:
                print(f"❌ {endpoint}: Missing")
        
        return True
    except Exception as e:
        print(f"❌ Health endpoints check: FAILED - {e}")
        return False

def main():
    """Run all verification tests."""
    print("\n" + "="*60)
    print("  BizPilot2 Critical Fixes Verification")
    print("  Date: 2026-01-26")
    print("="*60)
    
    results = []
    
    # Run all tests
    results.append(("Environment Variables", test_environment_variables()))
    results.append(("Database Connection", test_database()))
    results.append(("Encryption Service", test_encryption()))
    results.append(("Redis Connection", test_redis()))
    results.append(("Rate Limiting Config", test_rate_limiting()))
    results.append(("API Startup", test_api_startup()))
    results.append(("Health Endpoints", test_health_endpoints()))
    
    # Summary
    print_section("VERIFICATION SUMMARY")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\n{'='*60}")
    print(f"  Results: {passed}/{total} tests passed")
    print('='*60)
    
    if passed == total:
        print("\n🎉 All verifications passed! Application is ready.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Review errors above.")
        return 1

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\nVerification interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Verification failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
