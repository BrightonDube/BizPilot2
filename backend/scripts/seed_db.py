"""
Main Database Seed Script for BizPilot

This script provides a comprehensive seeding solution for the BizPilot database.
It can be used for development, testing, and production environments.

Run: python -m scripts.seed_db
"""

import sys
import os
from datetime import datetime, timedelta
import secrets

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserStatus, SubscriptionStatus
from app.models.subscription_tier import SubscriptionTier, DEFAULT_TIERS


def create_subscription_tiers(db: Session) -> dict:
    """Create subscription tiers."""
    print("Creating subscription tiers...")
    
    tiers = {}
    for tier_data in DEFAULT_TIERS:
        tier = db.query(SubscriptionTier).filter(
            SubscriptionTier.slug == tier_data["slug"]
        ).first()
        
        if not tier:
            tier = SubscriptionTier(**tier_data)
            db.add(tier)
        else:
            for key, value in tier_data.items():
                setattr(tier, key, value)
        
        tiers[tier_data["slug"]] = tier
    
    db.commit()
    for tier in tiers.values():
        db.refresh(tier)
    
    print(f"  ✓ Subscription tiers: {len(tiers)}")
    return tiers


def create_demo_user(db: Session, tiers: dict) -> User:
    """Create demo user."""
    print("Creating demo user...")

    email = "demo@bizpilot.co.za"
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email)
        db.add(user)

    user.hashed_password = get_password_hash("Demo@2024")
    user.first_name = "Demo"
    user.last_name = "User"
    user.phone = "+27 21 555 0100"
    user.is_email_verified = True
    user.status = UserStatus.ACTIVE
    user.is_admin = True
    user.is_superadmin = False
    user.subscription_status = SubscriptionStatus.ACTIVE
    user.current_tier_id = tiers["pilot_pro"].id
    user.subscription_started_at = datetime.now() - timedelta(days=30)
    user.subscription_expires_at = datetime.now() + timedelta(days=335)

    db.commit()
    db.refresh(user)
    print(f"  ✓ User: {user.email}")
    return user


def create_superadmin(db: Session) -> tuple[User, str]:
    """Create the single BizPilot superadmin user."""
    print("Creating superadmin user...")

    password = os.getenv("BIZPILOT_SUPERADMIN_PASSWORD")
    if not password:
        password = secrets.token_urlsafe(24)

    email = "admin@bizpilot.co.za"

    # Ensure only this account can be superadmin
    db.query(User).filter(User.is_superadmin.is_(True), User.email != email).update(
        {User.is_superadmin: False},
        synchronize_session=False,
    )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email)
        db.add(user)

    user.hashed_password = get_password_hash(password)
    user.first_name = "BizPilot"
    user.last_name = "Admin"
    user.phone = None
    user.is_email_verified = True
    user.status = UserStatus.ACTIVE
    user.is_admin = False
    user.is_superadmin = True
    user.subscription_status = SubscriptionStatus.NONE
    user.current_tier_id = None

    db.commit()
    db.refresh(user)
    print(f"  ✓ Superadmin: {user.email}")
    return user, password


def main():
    """Main seeding function."""
    print("\n" + "=" * 60)
    print("BizPilot Database Seed Script")
    print("=" * 60 + "\n")

    db = SessionLocal()
    
    try:
        # Create subscription tiers
        tiers = create_subscription_tiers(db)
        
        # Create demo user
        demo_user = create_demo_user(db, tiers)
        
        # Create superadmin
        superadmin, superadmin_password = create_superadmin(db)
        
        print("\n" + "=" * 60)
        print("✅ Database Seeding Complete!")
        print("=" * 60)
        
        print("\n📧 Demo Login:")
        print("   Email: demo@bizpilot.co.za")
        print("   Password: Demo@2024")
        
        print("\n🔐 Superadmin Login:")
        print("   Email: admin@bizpilot.co.za")
        if os.getenv("BIZPILOT_SUPERADMIN_PASSWORD"):
            print("   Password: (from BIZPILOT_SUPERADMIN_PASSWORD env var)")
        else:
            print(f"   Password: {superadmin_password}")
            print("   NOTE: Password was auto-generated. Set BIZPILOT_SUPERADMIN_PASSWORD to control it.")
        
        print("\n" + "=" * 60 + "\n")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()