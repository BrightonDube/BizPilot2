"""
Pre-Deployment Validation Script

Runs all necessary checks before deploying to production:
1. Schema consistency validation
2. Database connection test
3. Migration status check
4. Environment variable validation

Run this before every deployment to catch issues early.
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.sync_database import sync_engine


def print_header(title):
    """Print a formatted header."""
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def print_result(check_name, passed, message=""):
    """Print check result."""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} - {check_name}")
    if message:
        print(f"       {message}")


def check_database_connection():
    """Test database connection."""
    print_header("1. Database Connection Test")
    try:
        with sync_engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            result.fetchone()
        print_result("Database connection", True, "Successfully connected to database")
        return True
    except Exception as e:
        print_result("Database connection", False, f"Failed to connect: {e}")
        return False


def check_migrations():
    """Check migration status."""
    print_header("2. Migration Status Check")
    try:
        with sync_engine.connect() as conn:
            # Check if alembic_version table exists
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'alembic_version'
                )
            """))
            
            if not result.fetchone()[0]:
                print_result("Migrations", False, "alembic_version table not found")
                return False
            
            # Get current migration version
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            version = result.fetchone()
            
            if version:
                print_result("Migrations", True, f"Current version: {version[0]}")
                return True
            else:
                print_result("Migrations", False, "No migration version found")
                return False
                
    except Exception as e:
        print_result("Migrations", False, f"Error checking migrations: {e}")
        return False


def check_schema_consistency():
    """Run schema validation."""
    print_header("3. Schema Consistency Validation")
    try:
        # Import and run validation
        from scripts.validate_schema_consistency import main as validate_main
        
        # Capture the exit code
        try:
            validate_main()
            print_result("Schema consistency", True, "All models match database schema")
            return True
        except SystemExit as e:
            if e.code == 0:
                print_result("Schema consistency", True, "All models match database schema")
                return True
            else:
                print_result("Schema consistency", False, "Schema mismatches found")
                return False
                
    except Exception as e:
        print_result("Schema consistency", False, f"Validation error: {e}")
        return False


def check_environment():
    """Check required environment variables."""
    print_header("4. Environment Variables Check")
    
    required_vars = [
        "DATABASE_URL",
    ]
    
    optional_vars = [
        "BIZPILOT_SUPERADMIN_PASSWORD",
        "SECRET_KEY",
        "REDIS_URL",
    ]
    
    all_present = True
    
    for var in required_vars:
        if os.getenv(var):
            print_result(f"Required: {var}", True, "Set")
        else:
            print_result(f"Required: {var}", False, "NOT SET")
            all_present = False
    
    for var in optional_vars:
        if os.getenv(var):
            print_result(f"Optional: {var}", True, "Set")
        else:
            print_result(f"Optional: {var}", False, "Not set (using default)")
    
    return all_present


def check_critical_tables():
    """Check that critical tables exist."""
    print_header("5. Critical Tables Check")
    
    critical_tables = [
        "users",
        "businesses",
        "organizations",
        "products",
        "orders",
        "customers",
        "subscription_tiers",
    ]
    
    try:
        with sync_engine.connect() as conn:
            all_exist = True
            for table in critical_tables:
                result = conn.execute(text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = '{table}'
                    )
                """))
                
                exists = result.fetchone()[0]
                if exists:
                    print_result(f"Table: {table}", True, "Exists")
                else:
                    print_result(f"Table: {table}", False, "Missing")
                    all_exist = False
            
            return all_exist
            
    except Exception as e:
        print_result("Critical tables", False, f"Error checking tables: {e}")
        return False


def main():
    """Run all pre-deployment checks."""
    print("\n" + "=" * 70)
    print("PRE-DEPLOYMENT VALIDATION")
    print("=" * 70)
    print("\nRunning comprehensive checks before deployment...")
    
    checks = [
        ("Database Connection", check_database_connection),
        ("Migrations", check_migrations),
        ("Schema Consistency", check_schema_consistency),
        ("Environment Variables", check_environment),
        ("Critical Tables", check_critical_tables),
    ]
    
    results = []
    for check_name, check_func in checks:
        try:
            result = check_func()
            results.append((check_name, result))
        except Exception as e:
            print(f"\n❌ Unexpected error in {check_name}: {e}")
            results.append((check_name, False))
    
    # Summary
    print_header("VALIDATION SUMMARY")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"\nChecks passed: {passed}/{total}")
    
    for check_name, result in results:
        status = "✅" if result else "❌"
        print(f"  {status} {check_name}")
    
    if passed == total:
        print("\n" + "=" * 70)
        print("✅ ALL CHECKS PASSED - READY FOR DEPLOYMENT")
        print("=" * 70 + "\n")
        sys.exit(0)
    else:
        print("\n" + "=" * 70)
        print("❌ SOME CHECKS FAILED - DO NOT DEPLOY")
        print("=" * 70)
        print("\nPlease fix the issues above before deploying.")
        print("\nCommon fixes:")
        print("  - Schema issues: Run 'python -m scripts.auto_sync_schema'")
        print("  - Missing migrations: Run 'alembic upgrade head'")
        print("  - Environment variables: Check .env file")
        print("=" * 70 + "\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
