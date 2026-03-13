"""Inventory report configuration model.

Why a dedicated model for report configs?
Users repeatedly generate the same inventory reports with the same filters.
Persisting configurations avoids repetitive setup and enables scheduled
report emails to reference a stored configuration by ID.
"""

from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class InventoryReportConfig(BaseModel):
    """Saved inventory report configuration.

    Stores filter presets, grouping, and sort options so users can
    re-run reports without reconfiguring every parameter.
    """

    __tablename__ = "inventory_report_configs"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)
    report_type = Column(String(50), nullable=False, index=True)
    filters = Column(JSONB, nullable=True)
    group_by = Column(String(50), nullable=True)
    sort_by = Column(String(50), nullable=True)
    sort_direction = Column(String(4), nullable=True, default="asc")
    is_default = Column(Boolean, nullable=False, default=False)
    is_shared = Column(Boolean, nullable=False, default=False)
    schedule_cron = Column(String(100), nullable=True)

    # Relationships
    created_by = relationship("User", lazy="joined")
