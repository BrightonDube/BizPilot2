"""Proforma invoice (quote) models."""

import enum
from datetime import date
from decimal import Decimal

from sqlalchemy import Column, Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class QuoteStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    VIEWED = "viewed"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CONVERTED = "converted"
    CANCELLED = "cancelled"


class ProformaInvoice(BaseModel):
    """Proforma invoice / quotation."""

    __tablename__ = "proforma_invoices"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True, index=True)

    quote_number = Column(String(50), nullable=False, unique=True, index=True)
    status = Column(
        SQLEnum(QuoteStatus, values_callable=lambda x: [e.value for e in x], name="quotestatus"),
        default=QuoteStatus.DRAFT,
    )

    issue_date = Column(Date, default=date.today)
    expiry_date = Column(Date, nullable=True)
    validity_days = Column(Integer, default=30)

    subtotal = Column(Numeric(12, 2), default=Decimal("0"))
    tax_amount = Column(Numeric(12, 2), default=Decimal("0"))
    discount_amount = Column(Numeric(12, 2), default=Decimal("0"))
    total = Column(Numeric(12, 2), default=Decimal("0"))

    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)

    # Conversion tracking
    converted_invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)

    items = relationship("ProformaItem", back_populates="proforma", cascade="all, delete-orphan")


class ProformaItem(BaseModel):
    """Line item on a proforma invoice."""

    __tablename__ = "proforma_items"

    proforma_id = Column(UUID(as_uuid=True), ForeignKey("proforma_invoices.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)

    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(12, 4), default=Decimal("1"))
    unit_price = Column(Numeric(12, 2), default=Decimal("0"))
    discount_pct = Column(Numeric(5, 2), default=Decimal("0"))
    tax_rate = Column(Numeric(5, 2), default=Decimal("15"))
    line_total = Column(Numeric(12, 2), default=Decimal("0"))

    proforma = relationship("ProformaInvoice", back_populates="items")
