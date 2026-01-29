"""Order models for order management."""

from sqlalchemy import Column, String, Text, Numeric, Integer, ForeignKey, Enum as SQLEnum, DateTime
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
import enum

from app.models.base import BaseModel, utc_now, JSONType


class OrderStatus(str, enum.Enum):
    """Order status."""

    DRAFT = "draft"
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    RECEIVED = "received"  # For purchase orders when goods are received
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentStatus(str, enum.Enum):
    """Payment status."""

    PENDING = "pending"
    PARTIAL = "partial"
    PAID = "paid"
    REFUNDED = "refunded"
    FAILED = "failed"


class OrderDirection(str, enum.Enum):
    """Order direction."""

    INBOUND = "inbound"  # customer orders (sales)
    OUTBOUND = "outbound"  # supplier orders (purchasing)


class Order(BaseModel):
    """Order model for sales management."""

    __tablename__ = "orders"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True, index=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True, index=True)

    direction = Column(
        SQLEnum(OrderDirection, values_callable=lambda x: [e.value for e in x], name='orderdirection'),
        default=OrderDirection.INBOUND,
        nullable=False,
    )
    
    # Order reference
    order_number = Column(String(50), nullable=False, unique=True, index=True)
    
    # Status
    status = Column(
        SQLEnum(OrderStatus, values_callable=lambda x: [e.value for e in x], name='orderstatus'),
        default=OrderStatus.DRAFT
    )
    payment_status = Column(
        SQLEnum(PaymentStatus, values_callable=lambda x: [e.value for e in x], name='paymentstatus'),
        default=PaymentStatus.PENDING
    )
    
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
    shipping_address = Column(JSONType, nullable=True)  # {line1, line2, city, state, postal_code, country}
    billing_address = Column(JSONType, nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    internal_notes = Column(Text, nullable=True)
    
    # Dates
    order_date = Column(DateTime(timezone=True), default=utc_now)
    shipped_date = Column(DateTime(timezone=True), nullable=True)
    delivered_date = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    tags = Column(ARRAY(String), default=[])
    source = Column(String(50), default="manual")  # manual, pos, online, etc.
    
    # Relationships
    items = relationship("OrderItem", back_populates="order", lazy="selectin")
    customer = relationship("Customer", backref="orders", lazy="joined")
    supplier = relationship("Supplier", backref="orders", lazy="joined")

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
        """Get total item count from order items relationship."""
        if self.items:
            return sum(item.quantity for item in self.items if item.deleted_at is None)
        return 0


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
    
    # Relationship back to order
    order = relationship("Order", back_populates="items")

    def __repr__(self) -> str:
        return f"<OrderItem {self.name} x{self.quantity}>"

    @property
    def line_total(self) -> float:
        """Calculate line total before tax."""
        return float(self.unit_price * self.quantity - self.discount_amount)
