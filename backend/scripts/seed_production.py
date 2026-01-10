#!/usr/bin/env python3
"""
Production Database Seeding Script

This script seeds essential data for the BizPilot2 production database.
It's designed to be run as a DigitalOcean App Platform job after migrations.

Features:
- Safe to run multiple times (idempotent)
- Only creates missing data
- Does not delete or modify existing data

Usage:
  python -m scripts.seed_production

Environment:
  DATABASE_URL - PostgreSQL connection string (required)
"""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.subscription_tier import SubscriptionTier, DEFAULT_TIERS
from app.models.role import Role, DEFAULT_ROLES


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
    
    db = SessionLocal()
    try:
        results = {
            "tiers": [],
            "roles": [],
        }
        
        # 1. Seed subscription tiers
        print("\n[1/2] Seeding subscription tiers...")
        results["tiers"] = seed_subscription_tiers(db)
        
        # 2. Seed default roles
        print("\n[2/2] Seeding default roles...")
        results["roles"] = seed_default_roles(db)
        
        # Commit all changes
        db.commit()
        
        print("\n" + "=" * 60)
        print("Seeding Complete!")
        print("=" * 60)
        print(f"\nCreated:")
        print(f"  - Tiers: {len(results['tiers'])}")
        print(f"  - Roles: {len(results['roles'])}")
        
        if not results["tiers"] and not results["roles"]:
            print("\nAll essential data already exists. No changes made.")
        
        print("\n✓ Production seeding completed successfully!")
        return 0
        
    except Exception as e:
        print(f"\nERROR: Seeding failed: {e}")
        db.rollback()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
