"""Payment model for tracking payments."""

from sqlalchemy import Column, String, Text, Numeric, ForeignKey, Enum as SQLEnum, Date
from sqlalchemy.dialects.postgresql import UUID
import enum
from datetime import date

from app.models.base import BaseModel


class PaymentStatus(str, enum.Enum):
    """Payment status."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class PaymentMethod(str, enum.Enum):
    """Payment method."""

    CASH = "cash"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    MOBILE = "mobile"
    CHECK = "check"
    OTHER = "other"


class Payment(BaseModel):
    """Payment model."""

    __tablename__ = "payments"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True, index=True)
    
    # Payment reference
    payment_number = Column(String(50), nullable=False, unique=True, index=True)
    
    # Payment details
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(SQLEnum(PaymentMethod), default=PaymentMethod.CASH)
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING)
    
    # Dates
    payment_date = Column(Date, default=date.today)
    
    # Reference info
    reference = Column(String(100), nullable=True)
    transaction_id = Column(String(100), nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Payment {self.payment_number}>"
