"""Inventory service for business logic."""

from typing import List, Optional, Tuple
from decimal import Decimal
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.inventory import InventoryItem, InventoryTransaction, TransactionType
from app.models.product import Product
from app.models.base import utc_now
from app.schemas.inventory import InventoryItemCreate, InventoryItemUpdate, InventoryAdjustment


class InventoryService:
    """Service for inventory operations."""

    def __init__(self, db: Session):
        self.db = db

    def _coerce_uuid(self, value: Optional[str]):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        try:
            return uuid.UUID(str(value))
        except (ValueError, TypeError):
            return value

    def get_inventory_items(
        self,
        business_id: str,
        page: int = 1,
        per_page: int = 20,
        search: Optional[str] = None,
        low_stock_only: bool = False,
        location: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> Tuple[List[InventoryItem], int]:
        """Get inventory items with filtering and pagination."""
        query = self.db.query(InventoryItem).filter(
            InventoryItem.business_id == business_id,
            InventoryItem.deleted_at.is_(None),
        )

        if search:
            term = f"%{search.strip()}%"
            query = query.join(Product, Product.id == InventoryItem.product_id).filter(
                Product.deleted_at.is_(None),
                func.lower(Product.name).like(func.lower(term))
                | func.lower(Product.sku).like(func.lower(term)),
            )
        
        if low_stock_only:
            query = query.filter(
                InventoryItem.quantity_on_hand <= InventoryItem.reorder_point
            )
        
        if location:
            query = query.filter(InventoryItem.location == location)
        
        total = query.count()
        
        sort_column = getattr(InventoryItem, sort_by, InventoryItem.created_at)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
        
        offset = (page - 1) * per_page
        items = query.offset(offset).limit(per_page).all()
        
        return items, total

    def get_inventory_item(self, item_id: str, business_id: str) -> Optional[InventoryItem]:
        """Get an inventory item by ID."""
        return self.db.query(InventoryItem).filter(
            InventoryItem.id == item_id,
            InventoryItem.business_id == business_id,
            InventoryItem.deleted_at.is_(None),
        ).first()

    def get_inventory_by_product(self, product_id: str, business_id: str) -> Optional[InventoryItem]:
        """Get inventory item by product ID."""
        return self.db.query(InventoryItem).filter(
            InventoryItem.product_id == product_id,
            InventoryItem.business_id == business_id,
            InventoryItem.deleted_at.is_(None),
        ).first()

    def create_inventory_item(self, business_id: str, data: InventoryItemCreate) -> InventoryItem:
        """Create a new inventory item."""
        item = InventoryItem(
            business_id=business_id,
            product_id=data.product_id,
            quantity_on_hand=data.quantity_on_hand,
            quantity_reserved=data.quantity_reserved,
            quantity_incoming=data.quantity_incoming,
            reorder_point=data.reorder_point,
            reorder_quantity=data.reorder_quantity,
            location=data.location,
            bin_location=data.bin_location,
            average_cost=data.average_cost,
            last_cost=data.last_cost,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def update_inventory_item(self, item: InventoryItem, data: InventoryItemUpdate) -> InventoryItem:
        """Update an inventory item."""
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)
        self.db.commit()
        self.db.refresh(item)
        return item

    def adjust_inventory(
        self,
        item: InventoryItem,
        adjustment: InventoryAdjustment,
        user_id: Optional[str] = None,
    ) -> InventoryTransaction:
        """Adjust inventory quantity."""
        quantity_before = item.quantity_on_hand
        quantity_after = quantity_before + adjustment.quantity_change
        
        if quantity_after < 0:
            raise ValueError("Cannot reduce inventory below zero")
        
        # Update inventory
        item.quantity_on_hand = quantity_after
        
        # Create transaction record
        transaction = InventoryTransaction(
            business_id=item.business_id,
            product_id=item.product_id,
            inventory_item_id=item.id,
            transaction_type=TransactionType.ADJUSTMENT,
            quantity_change=adjustment.quantity_change,
            quantity_before=quantity_before,
            quantity_after=quantity_after,
            notes=f"{adjustment.reason}: {adjustment.notes or ''}",
            user_id=self._coerce_uuid(user_id),
        )
        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

    def record_sale(
        self,
        product_id: str,
        business_id: str,
        quantity: int,
        unit_price: Decimal,
        order_id: Optional[str] = None,
    ) -> Optional[InventoryTransaction]:
        """Record a sale transaction."""
        item = self.get_inventory_by_product(product_id, business_id)
        if not item:
            return None
        
        quantity_before = item.quantity_on_hand
        quantity_after = quantity_before - quantity
        
        if quantity_after < 0:
            raise ValueError("Insufficient inventory")
        
        item.quantity_on_hand = quantity_after
        item.last_sold_at = utc_now()
        
        transaction = InventoryTransaction(
            business_id=business_id,
            product_id=product_id,
            inventory_item_id=item.id,
            transaction_type=TransactionType.SALE,
            quantity_change=-quantity,
            quantity_before=quantity_before,
            quantity_after=quantity_after,
            unit_cost=item.average_cost,
            total_cost=item.average_cost * quantity,
            reference_type="order" if order_id else None,
            reference_id=order_id,
        )
        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

    def record_purchase(
        self,
        product_id: str,
        business_id: str,
        quantity: int,
        unit_cost: Decimal,
        purchase_order_id: Optional[str] = None,
    ) -> Optional[InventoryTransaction]:
        """Record a purchase/receiving transaction."""
        item = self.get_inventory_by_product(product_id, business_id)
        if not item:
            return None
        
        quantity_before = item.quantity_on_hand
        quantity_after = quantity_before + quantity
        
        # Update weighted average cost
        total_value = (item.quantity_on_hand * item.average_cost) + (quantity * unit_cost)
        item.average_cost = total_value / quantity_after if quantity_after > 0 else unit_cost
        item.last_cost = unit_cost
        item.quantity_on_hand = quantity_after
        item.last_received_at = utc_now()
        
        transaction = InventoryTransaction(
            business_id=business_id,
            product_id=product_id,
            inventory_item_id=item.id,
            transaction_type=TransactionType.PURCHASE,
            quantity_change=quantity,
            quantity_before=quantity_before,
            quantity_after=quantity_after,
            unit_cost=unit_cost,
            total_cost=unit_cost * quantity,
            reference_type="purchase_order" if purchase_order_id else None,
            reference_id=purchase_order_id,
        )
        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

    def get_transactions(
        self,
        business_id: str,
        product_id: Optional[str] = None,
        transaction_type: Optional[TransactionType] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> Tuple[List[InventoryTransaction], int]:
        """Get inventory transactions."""
        query = self.db.query(InventoryTransaction).filter(
            InventoryTransaction.business_id == business_id,
            InventoryTransaction.deleted_at.is_(None),
        )
        
        if product_id:
            query = query.filter(InventoryTransaction.product_id == product_id)
        
        if transaction_type:
            query = query.filter(InventoryTransaction.transaction_type == transaction_type)
        
        total = query.count()
        
        query = query.order_by(InventoryTransaction.created_at.desc())
        offset = (page - 1) * per_page
        transactions = query.offset(offset).limit(per_page).all()
        
        return transactions, total

    def get_low_stock_items(self, business_id: str) -> List[InventoryItem]:
        """Get items below reorder point."""
        return self.db.query(InventoryItem).filter(
            InventoryItem.business_id == business_id,
            InventoryItem.deleted_at.is_(None),
            InventoryItem.quantity_on_hand <= InventoryItem.reorder_point,
        ).all()

    def get_inventory_summary(self, business_id: str) -> dict:
        """Get inventory summary statistics."""
        items = self.db.query(InventoryItem).filter(
            InventoryItem.business_id == business_id,
            InventoryItem.deleted_at.is_(None),
        )
        
        total_items = items.count()
        total_value = self.db.query(
            func.sum(InventoryItem.quantity_on_hand * InventoryItem.average_cost)
        ).filter(
            InventoryItem.business_id == business_id,
            InventoryItem.deleted_at.is_(None),
        ).scalar() or 0
        
        low_stock_count = items.filter(
            InventoryItem.quantity_on_hand <= InventoryItem.reorder_point,
            InventoryItem.quantity_on_hand > 0,
        ).count()
        
        out_of_stock_count = items.filter(
            InventoryItem.quantity_on_hand == 0
        ).count()
        
        return {
            "total_items": total_items,
            "total_value": Decimal(str(total_value)),
            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
        }
