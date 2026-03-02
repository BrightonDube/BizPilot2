"""Custom dashboard models.

Contains Dashboard, DashboardWidget, DashboardTemplate, DashboardShare,
and DashboardExportSchedule models supporting the full dashboard builder
feature set.
"""

import enum

from sqlalchemy import Column, String, Integer, Text, Boolean, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, JSONType


class Dashboard(BaseModel):
    """User-created custom dashboard."""

    __tablename__ = "dashboards"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)
    layout = Column(Text, nullable=True)  # JSON layout config
    is_shared = Column(Boolean, default=False)

    user = relationship("User", lazy="joined")
    widgets = relationship("DashboardWidget", back_populates="dashboard", lazy="selectin")
    shares = relationship("DashboardShare", back_populates="dashboard", lazy="noload")
    export_schedules = relationship("DashboardExportSchedule", back_populates="dashboard", lazy="noload")


class DashboardWidget(BaseModel):
    """Widget on a dashboard."""

    __tablename__ = "dashboard_widgets"

    dashboard_id = Column(UUID(as_uuid=True), ForeignKey("dashboards.id"), nullable=False, index=True)
    widget_type = Column(String(50), nullable=False)  # "kpi", "chart", "table", "list"
    title = Column(String(255), nullable=False)
    config = Column(JSONType, nullable=True)  # Widget-specific config
    position_x = Column(Integer, default=0)
    position_y = Column(Integer, default=0)
    width = Column(Integer, default=4)  # Grid columns (1-12)
    height = Column(Integer, default=3)  # Grid rows

    dashboard = relationship("Dashboard", back_populates="widgets")


class DashboardTemplate(BaseModel):
    """Pre-built or user-saved dashboard configuration.

    System templates (is_system=True, business_id=NULL) ship with BizPilot
    and cannot be modified.  Business templates belong to a specific business
    and can be freely edited/deleted.
    """

    __tablename__ = "dashboard_templates"

    business_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    # Why JSONB for layout + widgets_config?
    # Templates store a snapshot of the full dashboard configuration.
    # Using JSONB keeps the schema flexible and avoids a complex
    # normalised structure for what is essentially a serialised document.
    layout = Column(JSONB, nullable=False, server_default="{}")
    widgets_config = Column(JSONB, nullable=False, server_default="[]")
    thumbnail_url = Column(String(500), nullable=True)
    is_system = Column(Boolean, nullable=False, server_default="false")


class SharePermission(str, enum.Enum):
    """Permission levels for dashboard sharing."""
    VIEW = "view"
    EDIT = "edit"


class DashboardShare(BaseModel):
    """Fine-grained sharing link between a dashboard and a user.

    Why a separate table instead of a boolean on Dashboard?
    Per-user permissions (view vs edit) and the ability to share with
    multiple users require a many-to-many junction table.
    """

    __tablename__ = "dashboard_shares"
    __table_args__ = (
        UniqueConstraint("dashboard_id", "shared_with_user_id", name="uq_dashboard_share_user"),
    )

    dashboard_id = Column(UUID(as_uuid=True), ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True)
    shared_with_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission = Column(String(20), nullable=False, default=SharePermission.VIEW.value)

    dashboard = relationship("Dashboard", back_populates="shares")
    shared_with_user = relationship("User", foreign_keys=[shared_with_user_id])


class ExportFormat(str, enum.Enum):
    PDF = "pdf"
    CSV = "csv"


class ExportFrequency(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class DashboardExportSchedule(BaseModel):
    """Recurring export schedule for a dashboard.

    When is_active is True, the scheduler will generate a report in the
    specified format and email it to the recipients list.
    """

    __tablename__ = "dashboard_export_schedules"

    dashboard_id = Column(UUID(as_uuid=True), ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    format = Column(String(20), nullable=False, default=ExportFormat.PDF.value)
    frequency = Column(String(20), nullable=False, default=ExportFrequency.WEEKLY.value)
    recipients = Column(JSONB, nullable=False, server_default="[]")
    is_active = Column(Boolean, nullable=False, default=True)
    last_sent_at = Column(DateTime(timezone=True), nullable=True)
    next_send_at = Column(DateTime(timezone=True), nullable=True)

    dashboard = relationship("Dashboard", back_populates="export_schedules")
    user = relationship("User", foreign_keys=[user_id])
