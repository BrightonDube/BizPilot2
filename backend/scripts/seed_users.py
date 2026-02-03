"""
Minimal User Seeding Script for BizPilot Production.

Creates only essential users for login testing:
- Demo user (demo@bizpilot.co.za)
- Superadmin user (brightondube520@gmail.com)

Run: python -m scripts.seed_users
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.sync_database import SyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserStatus, SubscriptionStatus
from app.models.subscription_tier import SubscriptionTier, DEFAULT_TIERS


def ensure_tiers(db: Session) -> dict:
    """Ensure subscription tiers exist."""
    print("Ensuring subscription tiers...")
    tiers = {}
    
    for tier_key, tier_data in DEFAULT_TIERS.items():
        tier = db.query(SubscriptionTier).filter(
            SubscriptionTier.name == tier_data["name"]
        ).first()
        
        if not tier:
            tier = SubscriptionTier(
                name=tier_data["name"],
                description=tier_data["description"],
                price_monthly=tier_data["price_monthly"],
                price_yearly=tier_data["price_yearly"],
                max_products=tier_data["max_products"],
                max_users=tier_data["max_users"],
                max_businesses=tier_data["max_businesses"],
                features=tier_data["features"],
                is_active=True,
            )
            db.add(tier)
            print(f"  Created tier: {tier_data['name']}")
        else:
            print(f"  Tier exists: {tier_data['name']}")
        
        tiers[tier_key] = tier
    
    db.commit()
    return tiers


def create_demo_user(db: Session, tiers: dict) -> User:
    """Create or update demo user."""
    print("Creating demo user...")
    
    email = "demo@bizpilot.co.za"
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        user = User(email=email)
        db.add(user)
        print(f"  Created user: {email}")
    else:
        print(f"  User exists: {email}")
    
    user.hashed_password = get_password_hash("Demo@2024")
    user.first_name = "Sipho"
    user.last_name = "Nkosi"
    user.phone = "+27 21 555 0100"
    user.is_email_verified = True
    user.status = UserStatus.ACTIVE
    user.is_admin = True
    user.is_superadmin = False
    user.subscription_status = SubscriptionStatus.ACTIVE
    
    # Get pilot_pro tier
    pilot_pro = tiers.get("pilot_pro")
    if pilot_pro:
        user.current_tier_id = pilot_pro.id
    
    from datetime import datetime, timedelta
    user.subscription_started_at = datetime.now() - timedelta(days=30)
    user.subscription_expires_at = datetime.now() + timedelta(days=335)
    
    db.commit()
    db.refresh(user)
    print(f"  ✓ Demo user ready: {email}")
    return user


def create_superadmin(db: Session) -> tuple:
    """Create or update superadmin user."""
    print("Creating superadmin user...")
    
    email = "brightondube520@gmail.com"
    password = "Admin@2026"
    
    # Ensure only this account is superadmin
    db.query(User).filter(
        User.is_superadmin.is_(True),
        User.email != email
    ).update({User.is_superadmin: False}, synchronize_session=False)
    
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        user = User(email=email)
        db.add(user)
        print(f"  Created user: {email}")
    else:
        print(f"  User exists: {email}")
    
    user.hashed_password = get_password_hash(password)
    user.first_name = "Brighton"
    user.last_name = "Dube"
    user.is_email_verified = True
    user.status = UserStatus.ACTIVE
    user.is_admin = True
    user.is_superadmin = True
    user.subscription_status = SubscriptionStatus.NONE
    user.current_tier_id = None
    
    db.commit()
    db.refresh(user)
    print(f"  ✓ Superadmin ready: {email}")
    return user, password


def main():
    """Main seeding function."""
    print("\n" + "=" * 50)
    print("BIZPILOT MINIMAL USER SEEDING")
    print("=" * 50 + "\n")
    
    db = SyncSessionLocal()
    
    try:
        # Create tiers first (users depend on them)
        tiers = ensure_tiers(db)
        
        # Create users
        demo_user = create_demo_user(db, tiers)
        superadmin, superadmin_pwd = create_superadmin(db)
        
        print("\n" + "=" * 50)
        print("✅ USER SEEDING COMPLETE")
        print("=" * 50)
        print("\n📧 Demo Login:")
        print("   Email: demo@bizpilot.co.za")
        print("   Password: Demo@2024")
        print("\n🔐 Superadmin Login:")
        print(f"   Email: {superadmin.email}")
        print(f"   Password: {superadmin_pwd}")
        print("=" * 50 + "\n")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
