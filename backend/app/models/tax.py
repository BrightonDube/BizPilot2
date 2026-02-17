"""Tax configuration models."""

import enum
from sqlalchemy import Column, String, Text, Boolean, ForeignKey, Numeric, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class TaxType(str, enum.Enum):
    VAT = "vat"
    SALES_TAX = "sales_tax"
    SERVICE_TAX = "service_tax"
    EXCISE = "excise"
    CUSTOM = "custom"


class TaxRate(BaseModel):
    """Tax rate configuration."""
    __tablename__ = "tax_rates"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=True)
    tax_type = Column(
        SQLEnum(TaxType, values_callable=lambda x: [e.value for e in x], name='taxtype'),
        default=TaxType.VAT,
    )
    rate = Column(Numeric(8, 4), nullable=False)  # e.g., 15.0000 for 15%
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_inclusive = Column(Boolean, default=True)  # True = price includes tax


class ProductTaxRate(BaseModel):
    """Links a tax rate to a product (overrides default)."""
    __tablename__ = "product_tax_rates"

    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    tax_rate_id = Column(UUID(as_uuid=True), ForeignKey("tax_rates.id"), nullable=False, index=True)

    product = relationship("Product", lazy="joined")
    tax_rate = relationship("TaxRate", lazy="joined")


class CategoryTaxRate(BaseModel):
    """Links a tax rate to a category."""
    __tablename__ = "category_tax_rates"

    category_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id"), nullable=False, index=True)
    tax_rate_id = Column(UUID(as_uuid=True), ForeignKey("tax_rates.id"), nullable=False, index=True)

    category = relationship("ProductCategory", lazy="joined")
    tax_rate = relationship("TaxRate", lazy="joined")
