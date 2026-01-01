"""Seed script for Suppliers (non-destructive, idempotent)."""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.business import Business
from app.models.supplier import Supplier


def seed_suppliers_for_business(db: Session, business_id: str) -> int:
    existing = db.query(Supplier).filter(
        Supplier.business_id == business_id,
        Supplier.deleted_at.is_(None),
    ).count()

    if existing > 0:
        return 0

    suppliers = [
        Supplier(
            business_id=business_id,
            name="Cape Packaging Co.",
            contact_name="Lerato Molefe",
            email="orders@capepackaging.example",
            phone="+27 21 555 1000",
            city="Cape Town",
            state="Western Cape",
            country="South Africa",
            tags=["packaging"],
        ),
        Supplier(
            business_id=business_id,
            name="Atlantic Wholesale Foods",
            contact_name="Thabo Dlamini",
            email="sales@atlanticwholesale.example",
            phone="+27 21 555 2000",
            city="Cape Town",
            state="Western Cape",
            country="South Africa",
            tags=["groceries", "wholesale"],
        ),
        Supplier(
            business_id=business_id,
            name="Table Bay Stationers",
            contact_name="Aisha Khan",
            email="hello@tablebaystationers.example",
            phone="+27 21 555 3000",
            city="Cape Town",
            state="Western Cape",
            country="South Africa",
            tags=["stationery"],
        ),
    ]

    db.add_all(suppliers)
    db.commit()
    return len(suppliers)


def main() -> None:
    db = SessionLocal()
    try:
        businesses = db.query(Business).all()
        total_added = 0
        for business in businesses:
            total_added += seed_suppliers_for_business(db, str(business.id))
        print(f"  ✓ Suppliers seeded: {total_added}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
