#!/usr/bin/env python
"""Seed the database with initial data."""

import sys
import os
import json
from datetime import datetime

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.models import User, Organization, Business, Role, BusinessUser, Permission, DEFAULT_ROLES, UserStatus, BusinessUserStatus


def seed_system_roles(db):
    """Create system roles."""
    print("Creating system roles...")
    
    for role_key, role_data in DEFAULT_ROLES.items():
        existing = db.query(Role).filter(Role.name == role_data["name"], Role.is_system == True).first()
        if not existing:
            role = Role(
                name=role_data["name"],
                description=role_data["description"],
                is_system=True,
                permissions=json.dumps(role_data["permissions"]),
            )
            db.add(role)
            print(f"  Created role: {role_data['name']}")
        else:
            print(f"  Role already exists: {role_data['name']}")
    
    db.commit()


def seed_demo_user(db):
    """Create a demo user for development."""
    print("Creating demo user...")
    
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    existing = db.query(User).filter(User.email == "demo@bizpilot.com").first()
    if existing:
        print("  Demo user already exists")
        return existing
    
    user = User(
        email="demo@bizpilot.com",
        hashed_password=pwd_context.hash("demo123456"),
        first_name="Demo",
        last_name="User",
        is_email_verified=True,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"  Created demo user: {user.email}")
    return user


def seed_demo_organization(db, owner):
    """Create a demo organization."""
    print("Creating demo organization...")
    
    existing = db.query(Organization).filter(Organization.slug == "demo-org").first()
    if existing:
        print("  Demo organization already exists")
        return existing
    
    org = Organization(
        name="Demo Organization",
        slug="demo-org",
        owner_id=owner.id,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    print(f"  Created organization: {org.name}")
    return org


def seed_demo_business(db, organization):
    """Create a demo business."""
    print("Creating demo business...")
    
    existing = db.query(Business).filter(Business.slug == "demo-business").first()
    if existing:
        print("  Demo business already exists")
        return existing
    
    business = Business(
        name="Demo Business",
        slug="demo-business",
        organization_id=organization.id,
        description="A demo business for testing BizPilot features",
        address_city="Cape Town",
        address_country="South Africa",
        currency="ZAR",
        vat_rate=15.00,
        invoice_prefix="DEMO",
    )
    db.add(business)
    db.commit()
    db.refresh(business)
    print(f"  Created business: {business.name}")
    return business


def seed_demo_business_user(db, user, business):
    """Link demo user to demo business with admin role."""
    print("Linking demo user to business...")
    
    existing = db.query(BusinessUser).filter(
        BusinessUser.user_id == user.id,
        BusinessUser.business_id == business.id
    ).first()
    
    if existing:
        print("  Demo user already linked to business")
        return existing
    
    # Get admin role
    admin_role = db.query(Role).filter(Role.name == "Admin", Role.is_system == True).first()
    
    business_user = BusinessUser(
        user_id=user.id,
        business_id=business.id,
        role_id=admin_role.id,
        status=BusinessUserStatus.ACTIVE,
        is_primary=True,
    )
    db.add(business_user)
    db.commit()
    print(f"  Linked user to business as Admin")
    return business_user


def main():
    """Run all seed functions."""
    print("=" * 50)
    print("BizPilot Database Seeder")
    print("=" * 50)
    
    db = SessionLocal()
    
    try:
        # Seed system roles
        seed_system_roles(db)
        
        # Seed demo data
        demo_user = seed_demo_user(db)
        demo_org = seed_demo_organization(db, demo_user)
        demo_business = seed_demo_business(db, demo_org)
        seed_demo_business_user(db, demo_user, demo_business)
        
        print("=" * 50)
        print("Seeding complete!")
        print("=" * 50)
        print("\nDemo Credentials:")
        print("  Email: demo@bizpilot.com")
        print("  Password: demo123456")
        
    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
