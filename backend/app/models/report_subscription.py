"""Report subscription models for automated report emails."""

from enum import Enum

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ReportType(str, Enum):
    """Types of automated reports available for subscription."""
    SALES_SUMMARY = "sales_summary"
    INVENTORY_STATUS = "inventory_status"
    FINANCIAL_OVERVIEW = "financial_overview"
    CUSTOMER_ACTIVITY = "customer_activity"


class DeliveryFrequency(str, Enum):
    """Delivery frequency for report subscriptions."""
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class DeliveryStatus(str, Enum):
    """Status of report delivery attempts."""
    SUCCESS = "success"
    FAILED = "failed"
    RETRYING = "retrying"


class ReportSubscription(BaseModel):
    """User subscription to automated report emails."""
    
    __tablename__ = "report_subscriptions"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    report_type = Column(String(50), nullable=False)
    frequency = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_sent_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationship
    user = relationship("User", backref="report_subscriptions")
    
    # Unique constraint on (user_id, report_type, frequency)
    __table_args__ = (
        Index("idx_report_subscriptions_user_id", "user_id"),
        Index("idx_report_subscriptions_frequency_active", "frequency", "is_active"),
    )


class ReportDeliveryLog(BaseModel):
    """Log of report delivery attempts for debugging and auditing."""
    
    __tablename__ = "report_delivery_logs"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    report_type = Column(String(50), nullable=False)
    frequency = Column(String(20), nullable=False)
    reporting_period_start = Column(DateTime(timezone=True), nullable=False)
    reporting_period_end = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False)
    error_message = Column(String, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index("idx_report_delivery_logs_user_id", "user_id"),
        Index("idx_report_delivery_logs_status", "status"),
        Index("idx_report_delivery_logs_created_at", "created_at"),
    )
