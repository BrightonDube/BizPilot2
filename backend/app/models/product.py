"""Product model for product management."""

from sqlalchemy import Column, String, Text, Numeric, Integer, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.models.base import BaseModel


class ProductStatus(str, enum.Enum):
    """Product status."""

    ACTIVE = "active"
    DRAFT = "draft"
    ARCHIVED = "archived"
    OUT_OF_STOCK = "out_of_stock"


class Product(BaseModel):
    """Product model for inventory management."""

    __tablename__ = "products"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id"), nullable=True, index=True)
    
    # Basic info
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    sku = Column(String(100), nullable=True, index=True)  # Stock Keeping Unit
    barcode = Column(String(100), nullable=True, index=True)
    
    # Pricing
    cost_price = Column(Numeric(12, 2), nullable=True)  # What you pay
    selling_price = Column(Numeric(12, 2), nullable=False)  # What customer pays
    compare_at_price = Column(Numeric(12, 2), nullable=True)  # Original price (for discounts)
    
    # Tax
    is_taxable = Column(Boolean, default=True)
    tax_rate = Column(Numeric(5, 2), nullable=True)  # Override default VAT rate
    
    # Inventory
    track_inventory = Column(Boolean, default=True)
    quantity = Column(Integer, default=0)
    low_stock_threshold = Column(Integer, default=10)
    
    # Status
    status = Column(
        SQLEnum(ProductStatus, values_callable=lambda x: [e.value for e in x], name='productstatus'),
        default=ProductStatus.DRAFT
    )
    
    # Media
    image_url = Column(String(500), nullable=True)
    
    # Relationships
    # category = relationship("ProductCategory", back_populates="products")

    def __repr__(self) -> str:
        return f"<Product {self.name}>"

    @property
    def is_low_stock(self) -> bool:
        """Check if product is low on stock."""
        return self.track_inventory and self.quantity <= self.low_stock_threshold

    @property
    def profit_margin(self) -> float:
        """Calculate profit margin percentage."""
        if not self.cost_price or self.cost_price == 0:
            return 0.0
        return float((self.selling_price - self.cost_price) / self.selling_price * 100)


class ProductCategory(BaseModel):
    """Product category model."""

    __tablename__ = "product_categories"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id"), nullable=True)
    
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(20), nullable=True)  # Hex color like #3b82f6
    image_url = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0)
    
    # Relationships
    # products = relationship("Product", back_populates="category")
    parent = relationship("ProductCategory", remote_side="ProductCategory.id", backref="children")

    def __repr__(self) -> str:
        return f"<ProductCategory {self.name}>"
