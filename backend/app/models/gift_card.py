"""Gift card / voucher models."""

import enum

from sqlalchemy import Column, String, Numeric, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class GiftCardStatus(str, enum.Enum):
    """Status of a gift card."""

    ACTIVE = "active"
    REDEEMED = "redeemed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class GiftCard(BaseModel):
    """Gift card / voucher model."""

    __tablename__ = "gift_cards"

    business_id = Column(
        UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True
    )
    code = Column(String(50), unique=True, nullable=False, index=True)
    initial_value = Column(Numeric(12, 2), nullable=False)
    current_balance = Column(Numeric(12, 2), nullable=False)
    status = Column(
        SQLEnum(
            GiftCardStatus,
            values_callable=lambda x: [e.value for e in x],
            name="giftcardstatus",
        ),
        default=GiftCardStatus.ACTIVE,
        nullable=False,
    )
    customer_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    customer_name = Column(String(255), nullable=True)
    customer_email = Column(String(255), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    transactions = relationship(
        "GiftCardTransaction",
        back_populates="gift_card",
        lazy="selectin",
    )


class GiftCardTransaction(BaseModel):
    """Transaction record for a gift card."""

    __tablename__ = "gift_card_transactions"

    gift_card_id = Column(
        UUID(as_uuid=True), ForeignKey("gift_cards.id"), nullable=False, index=True
    )
    transaction_type = Column(String(20), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    balance_after = Column(Numeric(12, 2), nullable=False)
    reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    performed_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    # Relationships
    gift_card = relationship("GiftCard", back_populates="transactions")
    user = relationship("User")
