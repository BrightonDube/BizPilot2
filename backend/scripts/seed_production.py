#!/usr/bin/env python3
"""
Production Database Seeding Script

This script seeds essential data for the BizPilot2 production database.
It's designed to be run as a DigitalOcean App Platform PRE_DEPLOY job.

Features:
- Safe to run multiple times (idempotent)
- Only creates missing data
- Does not delete or modify existing data
- Creates superadmin with password from environment variable

Usage:
  python -m scripts.seed_production

Environment Variables:
  DATABASE_URL - PostgreSQL connection string (required)
  BIZPILOT_SUPERADMIN_PASSWORD - Superadmin password (required in production)
  BIZPILOT_SUPERADMIN_EMAIL - Superadmin email (default: admin@bizpilot.co.za)
"""

import os
import sys
import secrets

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.subscription_tier import SubscriptionTier, DEFAULT_TIERS
from app.models.role import Role, DEFAULT_ROLES
from app.models.user import User, UserStatus


def seed_subscription_tiers(db: Session) -> list[str]:
    """Seed default subscription tiers."""
    created = []
    for tier_key, tier_data in DEFAULT_TIERS.items():
        existing = db.query(SubscriptionTier).filter(
            SubscriptionTier.name == tier_data["name"]
        ).first()
        if not existing:
            tier = SubscriptionTier(**tier_data)
            db.add(tier)
            created.append(tier_data["name"])
            print(f"  ✓ Created tier: {tier_data['name']}")
        else:
            print(f"  - Tier exists: {tier_data['name']}")
    return created


def seed_default_roles(db: Session) -> list[str]:
    """Seed default user roles."""
    created = []
    for role_data in DEFAULT_ROLES:
        existing = db.query(Role).filter(Role.name == role_data["name"]).first()
        if not existing:
            role = Role(**role_data)
            db.add(role)
            created.append(role_data["name"])
            print(f"  ✓ Created role: {role_data['name']}")
        else:
            print(f"  - Role exists: {role_data['name']}")
    return created


def seed_superadmin(db: Session) -> tuple[bool, str]:
    """
    Create or update the superadmin user.
    
    Returns:
        tuple[bool, str]: (created, email) - whether created and the email
    """
    email = os.getenv("BIZPILOT_SUPERADMIN_EMAIL", "admin@bizpilot.co.za")
    password = os.getenv("BIZPILOT_SUPERADMIN_PASSWORD")
    
    if not password:
        # In development, generate a random password
        if os.getenv("ENVIRONMENT", "development") == "production":
            print("  ⚠ WARNING: BIZPILOT_SUPERADMIN_PASSWORD not set in production!")
            print("  ⚠ Generating random password - check logs for value")
        password = secrets.token_urlsafe(16)
        print(f"  ⚠ Generated password: {password}")
    
    # Ensure only this account is superadmin
    db.query(User).filter(
        User.is_superadmin == True, 
        User.email != email
    ).update(
        {User.is_superadmin: False},
        synchronize_session=False,
    )
    
    user = db.query(User).filter(User.email == email).first()
    created = False
    
    if not user:
        user = User(email=email)
        db.add(user)
        created = True
    
    user.hashed_password = get_password_hash(password)
    user.first_name = "BizPilot"
    user.last_name = "Admin"
    user.is_email_verified = True
    user.status = UserStatus.ACTIVE
    user.is_admin = True
    user.is_superadmin = True
    
    if created:
        print(f"  ✓ Created superadmin: {email}")
    else:
        print(f"  ✓ Updated superadmin: {email}")
    
    return created, email


def main():
    """Main entry point for production seeding."""
    print("=" * 60)
    print("BizPilot2 Production Database Seeding")
    print("=" * 60)
    
    # Check for DATABASE_URL
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)
    
    print(f"\nConnecting to database...")
    print(f"Environment: {os.getenv('ENVIRONMENT', 'development')}")
    
    db = SessionLocal()
    try:
        results = {
            "tiers": [],
            "roles": [],
            "superadmin_created": False,
            "superadmin_email": None,
        }
        
        # 1. Seed subscription tiers
        print("\n[1/3] Seeding subscription tiers...")
        results["tiers"] = seed_subscription_tiers(db)
        
        # 2. Seed default roles
        print("\n[2/3] Seeding default roles...")
        results["roles"] = seed_default_roles(db)
        
        # 3. Create superadmin
        print("\n[3/3] Creating/updating superadmin...")
        results["superadmin_created"], results["superadmin_email"] = seed_superadmin(db)
        
        # Commit all changes
        db.commit()
        
        print("\n" + "=" * 60)
        print("Seeding Complete!")
        print("=" * 60)
        print(f"\nSummary:")
        print(f"  - Tiers created: {len(results['tiers'])}")
        print(f"  - Roles created: {len(results['roles'])}")
        print(f"  - Superadmin: {results['superadmin_email']}")
        
        print("\n✓ Production seeding completed successfully!")
        return 0
        
    except Exception as e:
        print(f"\nERROR: Seeding failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
