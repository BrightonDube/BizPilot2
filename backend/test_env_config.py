"""
Quick test to verify environment configuration is loaded correctly.
Run: python test_env_config.py
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from app.core.config import settings
    
    print("✅ Environment Configuration Test")
    print("=" * 50)
    
    # Test critical settings
    tests = {
        "Database URL": settings.DATABASE_URL,
        "Secret Key Length": len(settings.SECRET_KEY),
        "SMTP Host": settings.SMTP_HOST,
        "SMTP Port": settings.SMTP_PORT,
        "Google Client ID": settings.GOOGLE_CLIENT_ID[:20] + "..." if settings.GOOGLE_CLIENT_ID else "Not set",
        "Groq API Key": "Set" if settings.GROQ_API_KEY else "Not set",
        "Paystack Secret": "Set" if settings.PAYSTACK_SECRET_KEY else "Not set",
        "Frontend URL": settings.FRONTEND_URL,
        "Environment": settings.ENVIRONMENT,
        "Debug Mode": settings.DEBUG,
        "CORS Origins": len(settings.CORS_ORIGINS),
    }
    
    print("\n📋 Configuration Values:")
    for key, value in tests.items():
        print(f"  {key}: {value}")
    
    # Validation checks
    print("\n🔍 Validation Checks:")
    
    checks = []
    checks.append(("Secret Key Length >= 32", len(settings.SECRET_KEY) >= 32))
    checks.append(("Database URL set", bool(settings.DATABASE_URL)))
    checks.append(("SMTP configured", bool(settings.SMTP_HOST)))
    checks.append(("Google OAuth set", bool(settings.GOOGLE_CLIENT_ID)))
    checks.append(("CORS origins configured", len(settings.CORS_ORIGINS) > 0))
    
    all_passed = True
    for check_name, passed in checks:
        status = "✅" if passed else "❌"
        print(f"  {status} {check_name}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 50)
    if all_passed:
        print("✅ All checks passed! Configuration is ready.")
        print("\nNext steps:")
        print("  1. Start PostgreSQL: Make sure it's running on localhost:5432")
        print("  2. Create database: createdb bizpilot_dev")
        print("  3. Run migrations: python -m alembic upgrade head")
        print("  4. Start backend: uvicorn app.main:app --reload --port 8000")
    else:
        print("❌ Some checks failed. Please review the configuration.")
    
    sys.exit(0 if all_passed else 1)
    
except Exception as e:
    print(f"❌ Error loading configuration: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
