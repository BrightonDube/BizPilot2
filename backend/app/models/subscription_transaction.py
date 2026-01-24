"""SubscriptionTransaction model for tracking payment history."""

from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import relationship
import enum

from app.models.base import BaseModel, JSONType


class TransactionStatus(str, enum.Enum):
    """Transaction status."""

    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class TransactionType(str, enum.Enum):
    """Type of subscription transaction."""

    SUBSCRIPTION = "subscription"
    RENEWAL = "renewal"
    UPGRADE = "upgrade"
    DOWNGRADE = "downgrade"
    REFUND = "refund"
    CANCELLATION = "cancellation"


class SubscriptionTransaction(BaseModel):
    """Model to track subscription payment transactions."""

    __tablename__ = "subscription_transactions"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    tier_id = Column(UUID(as_uuid=True), ForeignKey("subscription_tiers.id"), nullable=True)
    
    # Transaction details
    transaction_type = Column(
        ENUM(TransactionType, values_callable=lambda x: [e.value for e in x], name='subscription_transaction_type', create_type=False),
        nullable=False,
        default=TransactionType.SUBSCRIPTION
    )
    status = Column(
        ENUM(TransactionStatus, values_callable=lambda x: [e.value for e in x], name='subscription_transaction_status', create_type=False),
        nullable=False,
        default=TransactionStatus.PENDING
    )
    
    # Amount in cents
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(3), nullable=False, default="ZAR")
    
    # Paystack references
    paystack_reference = Column(String(100), nullable=True, unique=True, index=True)
    paystack_transaction_id = Column(String(100), nullable=True)
    paystack_authorization_code = Column(String(100), nullable=True)
    
    # Payment method details (masked/partial for security)
    payment_method = Column(String(50), nullable=True)  # e.g., "card", "bank"
    card_last_four = Column(String(4), nullable=True)
    card_brand = Column(String(20), nullable=True)  # e.g., "visa", "mastercard"
    
    # Timestamps
    paid_at = Column(DateTime, nullable=True)
    
    # Subscription period covered
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)
    
    # Raw webhook/API response for debugging
    raw_response = Column(JSONType, nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    failure_reason = Column(String(500), nullable=True)

    # Relationships
    user = relationship("User", back_populates="subscription_transactions")
    tier = relationship("SubscriptionTier")

    def __repr__(self) -> str:
        return f"<SubscriptionTransaction {self.paystack_reference} - {self.status.value}>"

    @property
    def amount(self) -> float:
        """Return amount in currency units."""
        return self.amount_cents / 100
