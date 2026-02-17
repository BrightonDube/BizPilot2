"""Cash register models."""

import enum
from sqlalchemy import Column, String, Integer, Numeric, Boolean, DateTime, ForeignKey, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class RegisterStatus(str, enum.Enum):
    CLOSED = "closed"
    OPEN = "open"
    SUSPENDED = "suspended"


class CashRegister(BaseModel):
    """Cash register terminal."""

    __tablename__ = "cash_registers"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)
    is_active = Column(Boolean, default=True)

    location = relationship("Location", lazy="joined")
    sessions = relationship("RegisterSession", back_populates="register", lazy="dynamic")


class RegisterSession(BaseModel):
    """Register session tracking open/close cycles."""

    __tablename__ = "register_sessions"

    register_id = Column(UUID(as_uuid=True), ForeignKey("cash_registers.id"), nullable=False, index=True)
    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    opened_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    closed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(
        SQLEnum(RegisterStatus, values_callable=lambda x: [e.value for e in x], name="registerstatus"),
        default=RegisterStatus.OPEN,
    )
    opening_float = Column(Numeric(12, 2), default=0)
    closing_float = Column(Numeric(12, 2), nullable=True)
    expected_cash = Column(Numeric(12, 2), nullable=True)
    actual_cash = Column(Numeric(12, 2), nullable=True)
    cash_difference = Column(Numeric(12, 2), nullable=True)
    total_sales = Column(Numeric(12, 2), default=0)
    total_refunds = Column(Numeric(12, 2), default=0)
    total_cash_payments = Column(Numeric(12, 2), default=0)
    total_card_payments = Column(Numeric(12, 2), default=0)
    transaction_count = Column(Integer, default=0)
    opened_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    register = relationship("CashRegister", back_populates="sessions", lazy="joined")
    opener = relationship("User", foreign_keys=[opened_by], lazy="joined")
    closer = relationship("User", foreign_keys=[closed_by], lazy="joined")
    movements = relationship("CashMovement", back_populates="session", lazy="joined")


class CashMovement(BaseModel):
    """Cash movement within a register session."""

    __tablename__ = "cash_movements"

    session_id = Column(UUID(as_uuid=True), ForeignKey("register_sessions.id"), nullable=False, index=True)
    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    movement_type = Column(String(20), nullable=False)  # cash_in, cash_out, pay_in, pay_out
    amount = Column(Numeric(12, 2), nullable=False)
    reason = Column(String(255), nullable=False)
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    session = relationship("RegisterSession", back_populates="movements")
    user = relationship("User", lazy="joined")
