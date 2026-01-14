"""Invoice models for invoicing."""

from sqlalchemy import Column, String, Text, Numeric, ForeignKey, Enum as SQLEnum, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
import enum
from datetime import date

from app.models.base import BaseModel


class InvoiceStatus(str, enum.Enum):
    """Invoice status."""

    DRAFT = "draft"
    SENT = "sent"
    VIEWED = "viewed"
    PAID = "paid"
    PARTIAL = "partial"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class Invoice(BaseModel):
    """Invoice model."""

    __tablename__ = "invoices"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True, index=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True, index=True)
    
    # Invoice reference
    invoice_number = Column(String(50), nullable=False, unique=True, index=True)
    
    # Status
    status = Column(
        SQLEnum(InvoiceStatus, values_callable=lambda x: [e.value for e in x], name='invoicestatus'),
        default=InvoiceStatus.DRAFT
    )
    
    # Dates
    issue_date = Column(Date, default=date.today)
    due_date = Column(Date, nullable=True)
    paid_date = Column(Date, nullable=True)
    
    # Pricing
    subtotal = Column(Numeric(12, 2), default=0)
    tax_amount = Column(Numeric(12, 2), default=0)
    discount_amount = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), default=0)
    
    # Payment
    amount_paid = Column(Numeric(12, 2), default=0)
    
    # Paystack payment tracking
    payment_reference = Column(String(100), nullable=True, index=True)
    payment_gateway_fees = Column(Numeric(12, 2), default=0)
    gateway_status = Column(String(50), nullable=True)
    
    # Addresses
    billing_address = Column(JSONB, nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)
    footer = Column(Text, nullable=True)
    
    # PDF
    pdf_url = Column(String(500), nullable=True)

    def __repr__(self) -> str:
        return f"<Invoice {self.invoice_number}>"

    @property
    def balance_due(self) -> float:
        """Calculate balance due."""
        return float(self.total - self.amount_paid)

    @property
    def is_paid(self) -> bool:
        """Check if invoice is fully paid."""
        return self.amount_paid >= self.total

    @property
    def is_overdue(self) -> bool:
        """Check if invoice is overdue."""
        if self.due_date and not self.is_paid:
            return date.today() > self.due_date
        return False
    
    @property
    def total_with_fees(self) -> float:
        """Calculate total including gateway fees."""
        return float(self.total) + float(self.payment_gateway_fees or 0)


class InvoiceItem(BaseModel):
    """Invoice item model."""

    __tablename__ = "invoice_items"

    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    
    # Item info
    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(10, 2), default=1)
    unit_price = Column(Numeric(12, 2), nullable=False)
    
    # Tax
    tax_rate = Column(Numeric(5, 2), default=0)
    tax_amount = Column(Numeric(12, 2), default=0)
    
    # Discount
    discount_percent = Column(Numeric(5, 2), default=0)
    discount_amount = Column(Numeric(12, 2), default=0)
    
    # Total
    total = Column(Numeric(12, 2), default=0)

    def __repr__(self) -> str:
        return f"<InvoiceItem {self.description[:30]}>"

    @property
    def line_total(self) -> float:
        """Calculate line total before tax."""
        return float(self.unit_price * self.quantity - self.discount_amount)
