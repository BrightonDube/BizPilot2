"""Expense tracking models."""

import enum
from sqlalchemy import (
    Column, String, Numeric, Boolean, Date, ForeignKey, Text,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ExpenseTrackingStatus(str, enum.Enum):
    """Status for tracked expenses."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PAID = "paid"


class ExpenseTrackingCategory(BaseModel):
    """Expense category for the expense tracking system."""
    __tablename__ = "expense_tracking_categories"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    budget_limit = Column(Numeric(12, 2), nullable=True)
    is_active = Column(Boolean, default=True)


class Expense(BaseModel):
    """Expense record for business expense tracking."""
    __tablename__ = "expenses"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("expense_tracking_categories.id"),
        nullable=True,
        index=True,
    )
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(Text, nullable=False)
    vendor = Column(String(255), nullable=True)
    receipt_url = Column(String(500), nullable=True)
    expense_date = Column(Date, nullable=False)
    status = Column(
        SQLEnum(
            ExpenseTrackingStatus,
            values_callable=lambda x: [e.value for e in x],
            name="expensetrackingstatus",
        ),
        default=ExpenseTrackingStatus.PENDING,
    )
    payment_method = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)

    category = relationship("ExpenseTrackingCategory", lazy="joined")
    submitter = relationship("User", foreign_keys=[submitted_by], lazy="joined")
    approver = relationship("User", foreign_keys=[approved_by], lazy="joined")
