"""Report template model for custom report builder."""

from sqlalchemy import Column, String, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ReportTemplate(BaseModel):
    """Saved custom report template with selected metrics, filters, and schedule."""

    __tablename__ = "report_templates"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    report_type = Column(String(50), nullable=False, default="custom")
    metrics = Column(JSONB, nullable=False, default=list)
    filters = Column(JSONB, nullable=False, default=dict)
    group_by = Column(JSONB, nullable=False, default=list)
    sort_by = Column(String(100), nullable=True)
    sort_direction = Column(String(4), nullable=True, default="desc")
    is_scheduled = Column(Boolean, default=False)
    schedule_cron = Column(String(100), nullable=True)
    schedule_recipients = Column(JSONB, nullable=True, default=list)
    is_public = Column(Boolean, default=False)

    owner = relationship("User", foreign_keys=[created_by], lazy="joined")
