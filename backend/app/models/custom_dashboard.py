"""Custom dashboard models."""

from sqlalchemy import Column, String, Integer, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
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
