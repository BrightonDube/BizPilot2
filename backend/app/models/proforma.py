"""Proforma invoice (quote) models.

Contains the core quote model, line items, revision history,
customer approval tracking, and audit trail models.
"""

import enum
import secrets
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    Integer,
    Numeric,
    String,
    Text,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class QuoteStatus(str, enum.Enum):
    """Lifecycle states for a proforma invoice."""

    DRAFT = "draft"
    SENT = "sent"
    VIEWED = "viewed"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CONVERTED = "converted"
    CANCELLED = "cancelled"


class ProformaInvoice(BaseModel):
    """Proforma invoice / quotation.

    Tracks the full lifecycle from draft creation through customer
    approval, conversion to invoice, or cancellation/expiry.
    """

    __tablename__ = "proforma_invoices"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

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
    discount_pct = Column(Numeric(5, 2), default=Decimal("0"), comment="Quote-level discount %")
    total = Column(Numeric(12, 2), default=Decimal("0"))

    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)

    # Shareable link / customer portal
    approval_token = Column(
        String(64), nullable=True, unique=True, index=True,
        comment="Secret token for customer-facing shareable link",
    )

    # Approval tracking
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by_name = Column(String(255), nullable=True, comment="Customer name who approved")
    rejection_reason = Column(Text, nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    viewed_at = Column(DateTime(timezone=True), nullable=True)

    # Cancellation
    cancellation_reason = Column(Text, nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)

    # Conversion tracking
    converted_invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)
    converted_at = Column(DateTime(timezone=True), nullable=True)

    items = relationship("ProformaItem", back_populates="proforma", cascade="all, delete-orphan")
    approvals = relationship("ProformaApproval", back_populates="proforma", cascade="all, delete-orphan")
    audit_entries = relationship("ProformaAudit", back_populates="proforma", cascade="all, delete-orphan")

    def generate_approval_token(self) -> str:
        """Generate a cryptographically-secure token for customer access."""
        self.approval_token = secrets.token_urlsafe(48)
        return self.approval_token


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

    # Partial conversion tracking (Requirement 5.2)
    is_converted = Column(Boolean, default=False)

    proforma = relationship("ProformaInvoice", back_populates="items")


class ProformaRevision(BaseModel):
    """Immutable revision snapshot of a proforma invoice.

    A JSON snapshot is simpler to restore and display than computing
    diffs.  Revisions are meaningful checkpoints (e.g. before sending).
    """

    __tablename__ = "proforma_invoice_revisions"

    proforma_id = Column(
        UUID(as_uuid=True),
        ForeignKey("proforma_invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    revision_number = Column(Integer, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    change_summary = Column(Text, nullable=True)
    snapshot = Column(
        JSONB,
        nullable=False,
        comment="Full JSON snapshot of proforma + items at this revision",
    )

    __table_args__ = (
        UniqueConstraint("proforma_id", "revision_number", name="uq_proforma_revisions_proforma_number"),
    )


class ProformaApproval(BaseModel):
    """Records a customer approval or rejection event.

    Supports digital signature capture and tracks the customer-facing
    interaction history for audit purposes (Requirement 3).
    """

    __tablename__ = "proforma_invoice_approvals"

    proforma_id = Column(
        UUID(as_uuid=True),
        ForeignKey("proforma_invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action = Column(String(20), nullable=False, comment="approved | rejected | viewed")
    customer_name = Column(String(255), nullable=True)
    customer_email = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    signature_data = Column(Text, nullable=True, comment="Base64-encoded signature image")
    notes = Column(Text, nullable=True)

    proforma = relationship("ProformaInvoice", back_populates="approvals")


class ProformaAudit(BaseModel):
    """Audit trail entry for proforma invoice changes (Requirement 11).

    Records every state change, modification, and interaction.
    """

    __tablename__ = "proforma_invoice_audits"

    proforma_id = Column(
        UUID(as_uuid=True),
        ForeignKey("proforma_invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action = Column(String(50), nullable=False, comment="e.g. created, edited, sent, approved, converted")
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    old_value = Column(JSONB, nullable=True)
    new_value = Column(JSONB, nullable=True)
    details = Column(Text, nullable=True)

    proforma = relationship("ProformaInvoice", back_populates="audit_entries")
