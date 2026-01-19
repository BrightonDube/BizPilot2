"""Product model for product management."""

from decimal import Decimal
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

    labor_minutes = Column(Integer, default=0)
    
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
    image_url = Column(Text, nullable=True)
    
    # Relationships
    # category = relationship("ProductCategory", back_populates="products")
    ingredients = relationship(
        "ProductIngredient",
        back_populates="product",
        lazy="selectin",
        primaryjoin="and_(Product.id==ProductIngredient.product_id, ProductIngredient.deleted_at.is_(None))",
        order_by="ProductIngredient.sort_order.asc()",
    )
    stock_reservations = relationship(
        "StockReservation",
        back_populates="product",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Product {self.name}>"

    @property
    def is_low_stock(self) -> bool:
        """Check if product is low on stock."""
        return self.track_inventory and self.quantity <= self.low_stock_threshold

    @property
    def profit_margin(self) -> float:
        """Calculate profit margin percentage."""
        effective_cost = self.effective_cost
        if not effective_cost or effective_cost == 0:
            return 0.0
        return float((self.selling_price - effective_cost) / self.selling_price * 100)

    @property
    def ingredients_total_cost(self) -> float:
        if not self.ingredients:
            return Decimal("0")
        return sum((ing.cost or Decimal("0")) * (ing.quantity or Decimal("0")) for ing in self.ingredients)

    @property
    def has_ingredients(self) -> bool:
        return bool(self.ingredients)

    @property
    def effective_cost(self):
        """Effective cost for margin calculations.

        If ingredients exist, use ingredients total cost.
        Otherwise fall back to cost_price.
        """
        if self.has_ingredients:
            return self.ingredients_total_cost
        return self.cost_price


class ProductCategory(BaseModel):
    """Product category model."""

    __tablename__ = "product_categories"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id"), nullable=True)
    
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(20), nullable=True)  # Hex color like #3b82f6
    image_url = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)
    
    # Relationships
    # products = relationship("Product", back_populates="category")
    parent = relationship("ProductCategory", remote_side="ProductCategory.id", backref="children")

    def __repr__(self) -> str:
        return f"<ProductCategory {self.name}>"
