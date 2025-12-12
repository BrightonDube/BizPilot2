"""Inventory models for stock management."""

from sqlalchemy import Column, String, Text, Numeric, Integer, ForeignKey, Enum as SQLEnum, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
from datetime import datetime

from app.models.base import BaseModel


class TransactionType(str, enum.Enum):
    """Inventory transaction type."""

    ADJUSTMENT = "adjustment"
    PURCHASE = "purchase"
    SALE = "sale"
    TRANSFER = "transfer"
    RETURN = "return"
    WRITE_OFF = "write_off"
    COUNT = "count"


class InventoryItem(BaseModel):
    """Inventory item linked to a product."""

    __tablename__ = "inventory_items"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    
    # Stock levels
    quantity_on_hand = Column(Integer, default=0)
    quantity_reserved = Column(Integer, default=0)  # Reserved for pending orders
    quantity_incoming = Column(Integer, default=0)  # Expected from purchase orders
    
    # Thresholds
    reorder_point = Column(Integer, default=10)
    reorder_quantity = Column(Integer, default=50)
    
    # Location (for multi-location support)
    location = Column(String(100), nullable=True)
    bin_location = Column(String(50), nullable=True)  # e.g., "A-12-3"
    
    # Cost tracking
    average_cost = Column(Numeric(12, 2), default=0)  # Weighted average cost
    last_cost = Column(Numeric(12, 2), default=0)  # Last purchase cost
    
    # Dates
    last_counted_at = Column(DateTime, nullable=True)
    last_received_at = Column(DateTime, nullable=True)
    last_sold_at = Column(DateTime, nullable=True)

    def __repr__(self) -> str:
        return f"<InventoryItem product_id={self.product_id}>"

    @property
    def quantity_available(self) -> int:
        """Get available quantity (on hand minus reserved)."""
        return max(0, self.quantity_on_hand - self.quantity_reserved)

    @property
    def is_low_stock(self) -> bool:
        """Check if stock is below reorder point."""
        return self.quantity_on_hand <= self.reorder_point

    @property
    def stock_value(self) -> float:
        """Calculate total stock value."""
        return float(self.quantity_on_hand * self.average_cost)


class InventoryTransaction(BaseModel):
    """Record of inventory changes."""

    __tablename__ = "inventory_transactions"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    inventory_item_id = Column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=True, index=True)
    
    # Transaction details
    transaction_type = Column(SQLEnum(TransactionType), nullable=False)
    quantity_change = Column(Integer, nullable=False)  # Positive for increase, negative for decrease
    quantity_before = Column(Integer, nullable=False)
    quantity_after = Column(Integer, nullable=False)
    
    # Cost
    unit_cost = Column(Numeric(12, 2), nullable=True)
    total_cost = Column(Numeric(12, 2), nullable=True)
    
    # Reference
    reference_type = Column(String(50), nullable=True)  # order, purchase_order, count, etc.
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # User who made the change
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Location
    from_location = Column(String(100), nullable=True)
    to_location = Column(String(100), nullable=True)

    def __repr__(self) -> str:
        return f"<InventoryTransaction {self.transaction_type} qty={self.quantity_change}>"
