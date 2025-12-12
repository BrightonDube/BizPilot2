"""Order models for order management."""

from sqlalchemy import Column, String, Text, Numeric, Integer, Boolean, ForeignKey, Enum as SQLEnum, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
import enum
from datetime import datetime

from app.models.base import BaseModel


class OrderStatus(str, enum.Enum):
    """Order status."""

    DRAFT = "draft"
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentStatus(str, enum.Enum):
    """Payment status."""

    PENDING = "pending"
    PARTIAL = "partial"
    PAID = "paid"
    REFUNDED = "refunded"
    FAILED = "failed"


class Order(BaseModel):
    """Order model for sales management."""

    __tablename__ = "orders"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True, index=True)
    
    # Order reference
    order_number = Column(String(50), nullable=False, unique=True, index=True)
    
    # Status
    status = Column(SQLEnum(OrderStatus), default=OrderStatus.DRAFT)
    payment_status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING)
    
    # Pricing
    subtotal = Column(Numeric(12, 2), default=0)
    tax_amount = Column(Numeric(12, 2), default=0)
    discount_amount = Column(Numeric(12, 2), default=0)
    shipping_amount = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), default=0)
    
    # Payment
    amount_paid = Column(Numeric(12, 2), default=0)
    payment_method = Column(String(50), nullable=True)
    
    # Shipping
    shipping_address = Column(JSONB, nullable=True)  # {line1, line2, city, state, postal_code, country}
    billing_address = Column(JSONB, nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    internal_notes = Column(Text, nullable=True)
    
    # Dates
    order_date = Column(DateTime, default=datetime.utcnow)
    shipped_date = Column(DateTime, nullable=True)
    delivered_date = Column(DateTime, nullable=True)
    
    # Metadata
    tags = Column(ARRAY(String), default=[])
    source = Column(String(50), default="manual")  # manual, pos, online, etc.

    def __repr__(self) -> str:
        return f"<Order {self.order_number}>"

    @property
    def balance_due(self) -> float:
        """Calculate balance due."""
        return float(self.total - self.amount_paid)

    @property
    def is_paid(self) -> bool:
        """Check if order is fully paid."""
        return self.amount_paid >= self.total

    @property
    def item_count(self) -> int:
        """Get total item count. Would need to sum from order_items."""
        return 0  # Placeholder - would be calculated from order items


class OrderItem(BaseModel):
    """Order item model."""

    __tablename__ = "order_items"

    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True, index=True)
    
    # Product info (denormalized for historical record)
    name = Column(String(255), nullable=False)
    sku = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    
    # Pricing
    unit_price = Column(Numeric(12, 2), nullable=False)
    quantity = Column(Integer, default=1)
    
    # Tax
    tax_rate = Column(Numeric(5, 2), default=0)
    tax_amount = Column(Numeric(12, 2), default=0)
    
    # Discount
    discount_percent = Column(Numeric(5, 2), default=0)
    discount_amount = Column(Numeric(12, 2), default=0)
    
    # Total
    total = Column(Numeric(12, 2), default=0)
    
    # Notes
    notes = Column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<OrderItem {self.name} x{self.quantity}>"

    @property
    def line_total(self) -> float:
        """Calculate line total before tax."""
        return float(self.unit_price * self.quantity - self.discount_amount)
