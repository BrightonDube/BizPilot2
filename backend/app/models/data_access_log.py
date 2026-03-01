"""Customer data access log model for privacy compliance."""

from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class CustomerDataAccessLog(BaseModel):
    """Tracks access to customer personal data for POPIA/GDPR compliance."""

    __tablename__ = "customer_data_access_logs"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, index=True)
    accessed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    access_type = Column(String(50), nullable=False)  # view, export, delete, consent_update
    details = Column(Text, nullable=True)
