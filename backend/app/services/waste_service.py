"""Service for waste and shrinkage tracking.

Records stock removed due to spoilage, damage, theft, or other losses.
Each waste event deducts from inventory via an InventoryTransaction (type=WASTE).
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.inventory import InventoryItem, InventoryTransaction, TransactionType
from app.models.waste import WasteCategory, WasteRecord


class WasteService:
    """Business logic for waste tracking and reporting."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # -----------------------------------------------------------------------
    # Waste Categories
    # -----------------------------------------------------------------------

    def create_category(
        self,
        business_id: uuid.UUID,
        name: str,
        description: Optional[str] = None,
        colour: Optional[str] = None,
    ) -> WasteCategory:
        category = WasteCategory(
            id=uuid.uuid4(),
            business_id=business_id,
            name=name,
            description=description,
            colour=colour,
        )
        self.db.add(category)
        self.db.flush()
        return category

    def list_categories(self, business_id: uuid.UUID) -> List[WasteCategory]:
        return (
            self.db.query(WasteCategory)
            .filter(
                WasteCategory.business_id == business_id,
                WasteCategory.deleted_at.is_(None),
            )
            .order_by(WasteCategory.name)
            .all()
        )

    # -----------------------------------------------------------------------
    # Waste Records
    # -----------------------------------------------------------------------

    def record_waste(
        self,
        business_id: uuid.UUID,
        product_id: uuid.UUID,
        recorded_by_id: uuid.UUID,
        quantity: int,
        waste_category_id: Optional[uuid.UUID] = None,
        notes: Optional[str] = None,
    ) -> WasteRecord:
        """Record a waste event and deduct the quantity from inventory.

        Raises ValueError if product has insufficient stock.
        """
        if quantity <= 0:
            raise ValueError("Waste quantity must be positive")

        inv_item = (
            self.db.query(InventoryItem)
            .filter(
                InventoryItem.product_id == product_id,
                InventoryItem.business_id == business_id,
                InventoryItem.deleted_at.is_(None),
            )
            .first()
        )
        if not inv_item:
            raise ValueError("Inventory item not found for this product")
        if inv_item.quantity_on_hand < quantity:
            raise ValueError(
                f"Insufficient stock: {inv_item.quantity_on_hand} on hand, {quantity} requested"
            )

        qty_before = inv_item.quantity_on_hand
        unit_cost = inv_item.average_cost or Decimal(0)
        total_cost = unit_cost * quantity

        # Deduct from inventory
        inv_item.quantity_on_hand -= quantity

        # Create audit transaction
        txn = InventoryTransaction(
            id=uuid.uuid4(),
            business_id=business_id,
            product_id=product_id,
            inventory_item_id=inv_item.id,
            transaction_type=TransactionType.WASTE,
            quantity_change=-quantity,
            quantity_before=qty_before,
            quantity_after=inv_item.quantity_on_hand,
            unit_cost=unit_cost,
            total_cost=total_cost,
            reference_type="waste",
            notes=notes or "Waste recorded",
            user_id=recorded_by_id,
        )
        self.db.add(txn)
        self.db.flush()

        waste_record = WasteRecord(
            id=uuid.uuid4(),
            business_id=business_id,
            product_id=product_id,
            waste_category_id=waste_category_id,
            quantity=quantity,
            unit_cost=unit_cost,
            total_cost=total_cost,
            recorded_by_id=recorded_by_id,
            recorded_at=datetime.now(timezone.utc),
            notes=notes,
            inventory_transaction_id=txn.id,
        )
        self.db.add(waste_record)
        self.db.flush()
        return waste_record

    def get_waste_report(
        self,
        business_id: uuid.UUID,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> dict:
        """Aggregate waste by category and by product for the given period."""
        query = self.db.query(WasteRecord).filter(
            WasteRecord.business_id == business_id,
            WasteRecord.deleted_at.is_(None),
        )
        if date_from:
            query = query.filter(WasteRecord.recorded_at >= date_from)
        if date_to:
            query = query.filter(WasteRecord.recorded_at <= date_to)

        records = query.all()

        total_quantity = sum(r.quantity for r in records)
        total_cost = sum(r.total_cost or Decimal(0) for r in records)

        # Group by category
        by_category: dict = {}
        for r in records:
            cat_id = str(r.waste_category_id) if r.waste_category_id else "uncategorised"
            if cat_id not in by_category:
                by_category[cat_id] = {"quantity": 0, "total_cost": Decimal(0)}
            by_category[cat_id]["quantity"] += r.quantity
            by_category[cat_id]["total_cost"] += r.total_cost or Decimal(0)

        # Group by product
        by_product: dict = {}
        for r in records:
            pid = str(r.product_id)
            if pid not in by_product:
                by_product[pid] = {"quantity": 0, "total_cost": Decimal(0)}
            by_product[pid]["quantity"] += r.quantity
            by_product[pid]["total_cost"] += r.total_cost or Decimal(0)

        return {
            "total_quantity": total_quantity,
            "total_cost": float(total_cost),
            "by_category": {
                k: {"quantity": v["quantity"], "total_cost": float(v["total_cost"])}
                for k, v in by_category.items()
            },
            "by_product": {
                k: {"quantity": v["quantity"], "total_cost": float(v["total_cost"])}
                for k, v in by_product.items()
            },
            "records": [
                {
                    "id": str(r.id),
                    "product_id": str(r.product_id),
                    "waste_category_id": str(r.waste_category_id) if r.waste_category_id else None,
                    "quantity": r.quantity,
                    "total_cost": float(r.total_cost or 0),
                    "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
                    "notes": r.notes,
                }
                for r in records
            ],
        }

    def list_records(
        self,
        business_id: uuid.UUID,
        page: int = 1,
        per_page: int = 50,
    ) -> Tuple[List[WasteRecord], int]:
        query = self.db.query(WasteRecord).filter(
            WasteRecord.business_id == business_id,
            WasteRecord.deleted_at.is_(None),
        )
        total = query.count()
        records = (
            query.order_by(WasteRecord.recorded_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return records, total
