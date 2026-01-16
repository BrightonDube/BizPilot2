"""LaybyItem model for storing items within a layby.

This model stores the individual products/items that are part of a layby.
Each layby can have multiple items, and each item references a product
with quantity, pricing, and discount information.

Validates: Requirements 1.2
"""

from decimal import Decimal

from sqlalchemy import Column, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class LaybyItem(BaseModel):
    """LaybyItem model for items within a layby.
    
    This model represents individual products/items that are part of a layby
    purchase arrangement. Each layby can contain multiple items, and each item
    stores denormalized product information for historical record keeping.
    
    Attributes:
        id: Unique identifier for the layby item (inherited from BaseModel)
        layby_id: Reference to the parent layby (CASCADE delete)
        product_id: Reference to the product (RESTRICT delete)
        product_name: Denormalized product name for historical records
        product_sku: Denormalized product SKU (optional)
        quantity: Number of units of this product
        unit_price: Price per unit at time of layby creation
        discount_amount: Discount applied to this item
        tax_amount: Tax amount for this item
        total_amount: Total amount for this item (quantity * unit_price - discount + tax)
        notes: Optional notes about this item
        created_at: Timestamp when the item was added (inherited from BaseModel)
        updated_at: Timestamp when the item was last updated (inherited from BaseModel)
        deleted_at: Soft delete timestamp (inherited from BaseModel)
    
    Validates: Requirements 1.2 (multiple products per layby)
    """

    __tablename__ = "layby_items"

    # Foreign key to laybys table (Requirement 1.2 - multiple products per layby)
    layby_id = Column(
        UUID(as_uuid=True),
        ForeignKey("laybys.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Product reference (RESTRICT delete to prevent orphaned layby items)
    product_id = Column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Denormalized product info (for historical record keeping)
    # These fields capture the product details at the time of layby creation
    product_name = Column(
        String(255),
        nullable=False,
    )
    product_sku = Column(
        String(100),
        nullable=True,
    )

    # Quantity and pricing
    quantity = Column(
        Integer,
        nullable=False,
    )
    unit_price = Column(
        Numeric(10, 2),
        nullable=False,
    )
    discount_amount = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    tax_amount = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    total_amount = Column(
        Numeric(10, 2),
        nullable=False,
    )

    # Optional notes for the item
    notes = Column(
        Text,
        nullable=True,
    )

    # Relationships
    layby = relationship(
        "Layby",
        back_populates="items",
    )
    product = relationship(
        "Product",
        backref="layby_items",
        lazy="joined",
    )

    def __repr__(self) -> str:
        return f"<LaybyItem {self.product_name} x{self.quantity}>"

    @property
    def unit_price_float(self) -> float:
        """Return unit_price as a float for calculations."""
        return float(self.unit_price)

    @property
    def discount_amount_float(self) -> float:
        """Return discount_amount as a float for calculations."""
        return float(self.discount_amount)

    @property
    def tax_amount_float(self) -> float:
        """Return tax_amount as a float for calculations."""
        return float(self.tax_amount)

    @property
    def total_amount_float(self) -> float:
        """Return total_amount as a float for calculations."""
        return float(self.total_amount)

    @property
    def subtotal(self) -> Decimal:
        """Calculate subtotal (quantity * unit_price) before discount and tax."""
        return Decimal(str(self.quantity)) * self.unit_price

    @property
    def subtotal_float(self) -> float:
        """Return subtotal as a float for calculations."""
        return float(self.subtotal)

    def calculate_total(self) -> Decimal:
        """Calculate and return the total amount for this item.
        
        Formula: (quantity * unit_price) - discount_amount + tax_amount
        
        Returns:
            The calculated total amount as a Decimal.
        """
        subtotal = Decimal(str(self.quantity)) * self.unit_price
        return subtotal - self.discount_amount + self.tax_amount
