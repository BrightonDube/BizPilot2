"""Models for integrated payment processing.

Tracks configured payment methods per business and a full transaction
audit trail with gateway references, refund chains, and tip amounts.

Why not extend the existing Order payment fields?
Order.payment_method and Order.payment_status are simple strings suitable
for basic tracking.  Integrated payments need:
  - Multiple configured methods per business (card terminals, EFT, etc.)
  - A 1-to-many relationship: one order can have split payments
  - Gateway-level audit data (reference IDs, response payloads)
  - Refund chains linking back to the original transaction
"""

import enum
import uuid

from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    Numeric,
    DateTime,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import BaseModel


class PaymentMethodType(str, enum.Enum):
    """Supported payment method types."""

    CASH = "cash"
    CARD = "card"
    EFT = "eft"
    SNAPSCAN = "snapscan"
    MOBILE = "mobile"
    GIFT_CARD = "gift_card"
    ACCOUNT = "account"


class PaymentTransactionStatus(str, enum.Enum):
    """Lifecycle of a payment transaction."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    VOIDED = "voided"


class PaymentMethod(BaseModel):
    """Configured payment method for a business.

    Examples: "Card Terminal #1", "SnapScan QR", "EFT via Stitch".
    The config JSONB stores provider-specific settings (never secrets).
    """

    __tablename__ = "payment_methods"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )
    name = Column(String(100), nullable=False)
    method_type = Column(String(30), nullable=False)
    provider = Column(String(100), nullable=True)
    config = Column(JSONB, nullable=True, comment="Provider-specific config (no secrets)")
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)


class PaymentTransaction(BaseModel):
    """Audit trail for every payment attempt against an order.

    Why track every attempt?
    Failed card taps, retries, and partial payments all need to be
    recorded for reconciliation.  The refund_of_id column creates
    a chain from refund → original, enabling traceability.
    """

    __tablename__ = "payment_transactions"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )
    order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("orders.id"),
        nullable=False,
        index=True,
    )
    payment_method_id = Column(
        UUID(as_uuid=True),
        ForeignKey("payment_methods.id"),
        nullable=True,
    )
    amount = Column(Numeric(12, 2), nullable=False)
    tip_amount = Column(Numeric(12, 2), default=0, nullable=False)
    status = Column(
        String(30),
        default=PaymentTransactionStatus.PENDING.value,
        nullable=False,
    )
    gateway_reference = Column(String(255), nullable=True)
    gateway_response = Column(JSONB, nullable=True)
    refund_of_id = Column(
        UUID(as_uuid=True),
        ForeignKey("payment_transactions.id"),
        nullable=True,
        comment="Links refund to original transaction",
    )
    processed_at = Column(DateTime(timezone=True), nullable=True)
