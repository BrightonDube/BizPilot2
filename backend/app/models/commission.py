"""Commission record models for approval workflow."""

import enum

from sqlalchemy import Column, Numeric, DateTime, Text, Date, ForeignKey
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class CommissionStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PAID = "paid"


class CommissionRecord(BaseModel):
    """Persisted commission record with approval workflow."""

    __tablename__ = "commission_records"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    order_count = Column(Numeric(12, 0), default=0)
    total_sales = Column(Numeric(12, 2), default=0)
    total_discounts = Column(Numeric(12, 2), default=0)
    commission_rate = Column(Numeric(5, 2), nullable=False)
    commission_amount = Column(Numeric(12, 2), nullable=False)
    status = Column(
        SQLEnum(CommissionStatus, values_callable=lambda x: [e.value for e in x], name="commissionstatus"),
        default=CommissionStatus.PENDING,
        nullable=False,
        index=True,
    )
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    staff = relationship("User", foreign_keys=[user_id], lazy="joined")
    approver = relationship("User", foreign_keys=[approved_by], lazy="joined")
