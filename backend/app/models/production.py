"""Production model for manufacturing management."""

from decimal import Decimal
from sqlalchemy import Column, String, Text, Numeric, Integer, ForeignKey, Enum as SQLEnum, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.models.base import BaseModel


class ProductionStatus(str, enum.Enum):
    """Production order status."""
    DRAFT = "draft"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProductionOrder(BaseModel):
    """Production order for manufacturing products from ingredients."""

    __tablename__ = "production_orders"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    
    # Product being manufactured
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    
    # Production details
    order_number = Column(String(50), nullable=False, index=True)
    quantity_to_produce = Column(Integer, nullable=False, default=1)
    quantity_produced = Column(Integer, nullable=False, default=0)
    
    # Status
    status = Column(
        SQLEnum(ProductionStatus, values_callable=lambda x: [e.value for e in x], name='productionstatus'),
        default=ProductionStatus.DRAFT
    )
    
    # Dates
    scheduled_date = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Cost tracking
    estimated_cost = Column(Numeric(12, 2), default=0)
    actual_cost = Column(Numeric(12, 2), default=0)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # User who created/managed
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    product = relationship("Product")
    items = relationship("ProductionOrderItem", back_populates="production_order", lazy="selectin")

    def __repr__(self) -> str:
        return f"<ProductionOrder {self.order_number}>"

    @property
    def is_complete(self) -> bool:
        return self.status == ProductionStatus.COMPLETED

    @property
    def completion_percentage(self) -> float:
        if self.quantity_to_produce == 0:
            return 0.0
        return (self.quantity_produced / self.quantity_to_produce) * 100


class ProductionOrderItem(BaseModel):
    """Individual ingredient line in a production order."""

    __tablename__ = "production_order_items"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    production_order_id = Column(UUID(as_uuid=True), ForeignKey("production_orders.id"), nullable=False, index=True)
    
    # Source product (ingredient from inventory)
    source_product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True, index=True)
    
    # Ingredient details
    name = Column(String(255), nullable=False)
    unit = Column(String(50), nullable=False, default="unit")
    quantity_required = Column(Numeric(12, 4), nullable=False, default=0)
    quantity_used = Column(Numeric(12, 4), nullable=False, default=0)
    unit_cost = Column(Numeric(12, 4), nullable=False, default=0)
    
    # Relationships
    production_order = relationship("ProductionOrder", back_populates="items")
    source_product = relationship("Product")

    def __repr__(self) -> str:
        return f"<ProductionOrderItem {self.name}>"

    @property
    def line_total(self) -> Decimal:
        return Decimal(str(self.quantity_used or 0)) * Decimal(str(self.unit_cost or 0))
