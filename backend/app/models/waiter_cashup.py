from sqlalchemy import Column, String, Numeric, Integer, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class WaiterCashup(BaseModel):
    """Waiter cashup report for a completed shift."""

    __tablename__ = "waiter_cashups"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shift_id = Column(
        UUID(as_uuid=True),
        ForeignKey("shifts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    waiter_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String(20), nullable=False, default="pending")  # pending | approved | rejected
    total_sales = Column(Numeric(15, 2), nullable=False)
    total_tips = Column(Numeric(15, 2), nullable=False, default=0.00)
    cash_collected = Column(Numeric(15, 2), nullable=False, default=0.00)
    card_collected = Column(Numeric(15, 2), nullable=False, default=0.00)
    cover_count = Column(Integer, nullable=False, default=0)
    tables_served = Column(Integer, nullable=False, default=0)
    generated_at = Column(DateTime(timezone=True), nullable=False)
    
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Relationships
    shift = relationship("Shift")
    waiter = relationship("User", foreign_keys=[waiter_id])
    approver = relationship("User", foreign_keys=[approved_by])
