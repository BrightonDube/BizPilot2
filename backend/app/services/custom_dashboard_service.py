"""
Custom dashboard service.

Manages dashboard CRUD, widget layout, templates, sharing,
and export schedule operations.

Why a service for dashboards?
The dashboard API (dashboards.py) handles HTTP concerns but delegates
business logic here. Dashboard operations involve complex rules:
template application, widget position validation, share permissions,
and export schedule management. A service keeps these rules testable
and reusable.
"""

from typing import Optional, Tuple, List
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.custom_dashboard import (
    Dashboard,
    DashboardWidget,
    DashboardTemplate,
    DashboardShare,
    DashboardExportSchedule,
)


class CustomDashboardService:
    """
    Service for managing custom dashboards and their components.

    Dashboards are user-owned but can be shared within a business.
    Templates provide pre-built layouts that can be applied to new dashboards.
    """

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Dashboard CRUD
    # ------------------------------------------------------------------

    def list_dashboards(
        self,
        business_id: UUID,
        user_id: UUID,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[Dashboard], int]:
        """
        List dashboards visible to a user.
        Includes owned dashboards and those shared with the user.
        """
        # Own dashboards + shared dashboards
        query = self.db.query(Dashboard).filter(
            Dashboard.business_id == business_id,
            Dashboard.deleted_at.is_(None),
        ).filter(
            (Dashboard.user_id == user_id) | (Dashboard.is_shared == True)  # noqa: E712
        )

        total = query.count()
        items = (
            query.order_by(Dashboard.is_default.desc(), Dashboard.name)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_dashboard(
        self, dashboard_id: UUID, business_id: UUID
    ) -> Optional[Dashboard]:
        """Get a single dashboard by ID, scoped to business."""
        return (
            self.db.query(Dashboard)
            .filter(
                Dashboard.id == dashboard_id,
                Dashboard.business_id == business_id,
                Dashboard.deleted_at.is_(None),
            )
            .first()
        )

    def create_dashboard(
        self,
        business_id: UUID,
        user_id: UUID,
        name: str,
        is_default: bool = False,
    ) -> Dashboard:
        """
        Create a new dashboard.
        If is_default=True, unset any existing default for this user.
        """
        if is_default:
            self._clear_user_default(business_id, user_id)

        dashboard = Dashboard(
            business_id=business_id,
            user_id=user_id,
            name=name,
            is_default=is_default,
            is_shared=False,
        )
        self.db.add(dashboard)
        self.db.commit()
        self.db.refresh(dashboard)
        return dashboard

    def update_dashboard(
        self,
        dashboard_id: UUID,
        business_id: UUID,
        name: Optional[str] = None,
        is_default: Optional[bool] = None,
        is_shared: Optional[bool] = None,
    ) -> Optional[Dashboard]:
        """Update dashboard properties."""
        dashboard = self.get_dashboard(dashboard_id, business_id)
        if not dashboard:
            return None

        if name is not None:
            dashboard.name = name
        if is_default is not None:
            if is_default:
                self._clear_user_default(business_id, dashboard.user_id)
            dashboard.is_default = is_default
        if is_shared is not None:
            dashboard.is_shared = is_shared

        self.db.commit()
        self.db.refresh(dashboard)
        return dashboard

    def delete_dashboard(
        self, dashboard_id: UUID, business_id: UUID
    ) -> bool:
        """Soft-delete a dashboard and its widgets."""
        dashboard = self.get_dashboard(dashboard_id, business_id)
        if not dashboard:
            return False
        dashboard.soft_delete()
        self.db.commit()
        return True

    def _clear_user_default(self, business_id: UUID, user_id: UUID) -> None:
        """Remove default flag from all user dashboards in this business."""
        self.db.query(Dashboard).filter(
            Dashboard.business_id == business_id,
            Dashboard.user_id == user_id,
            Dashboard.is_default == True,  # noqa: E712
        ).update({"is_default": False})

    # ------------------------------------------------------------------
    # Widget management
    # ------------------------------------------------------------------

    def list_widgets(self, dashboard_id: UUID) -> List[DashboardWidget]:
        """List all widgets for a dashboard, ordered by position."""
        return (
            self.db.query(DashboardWidget)
            .filter(
                DashboardWidget.dashboard_id == dashboard_id,
                DashboardWidget.deleted_at.is_(None),
            )
            .order_by(DashboardWidget.position_y, DashboardWidget.position_x)
            .all()
        )

    def add_widget(
        self,
        dashboard_id: UUID,
        widget_type: str,
        title: str,
        position_x: int = 0,
        position_y: int = 0,
        config: Optional[dict] = None,
    ) -> DashboardWidget:
        """Add a new widget to a dashboard."""
        widget = DashboardWidget(
            dashboard_id=dashboard_id,
            widget_type=widget_type,
            title=title,
            position_x=position_x,
            position_y=position_y,
        )
        self.db.add(widget)
        self.db.commit()
        self.db.refresh(widget)
        return widget

    def update_widget(
        self,
        widget_id: UUID,
        title: Optional[str] = None,
        position_x: Optional[int] = None,
        position_y: Optional[int] = None,
    ) -> Optional[DashboardWidget]:
        """Update widget properties (title, position)."""
        widget = (
            self.db.query(DashboardWidget)
            .filter(
                DashboardWidget.id == widget_id,
                DashboardWidget.deleted_at.is_(None),
            )
            .first()
        )
        if not widget:
            return None

        if title is not None:
            widget.title = title
        if position_x is not None:
            widget.position_x = position_x
        if position_y is not None:
            widget.position_y = position_y

        self.db.commit()
        self.db.refresh(widget)
        return widget

    def delete_widget(self, widget_id: UUID) -> bool:
        """Soft-delete a widget."""
        widget = (
            self.db.query(DashboardWidget)
            .filter(
                DashboardWidget.id == widget_id,
                DashboardWidget.deleted_at.is_(None),
            )
            .first()
        )
        if not widget:
            return False
        widget.soft_delete()
        self.db.commit()
        return True

    # ------------------------------------------------------------------
    # Templates
    # ------------------------------------------------------------------

    def list_templates(
        self, business_id: UUID
    ) -> List[DashboardTemplate]:
        """List available templates (system + business-specific)."""
        return (
            self.db.query(DashboardTemplate)
            .filter(
                (DashboardTemplate.business_id == business_id)
                | (DashboardTemplate.is_system == True)  # noqa: E712
            )
            .order_by(DashboardTemplate.name)
            .all()
        )

    def apply_template(
        self,
        dashboard_id: UUID,
        template_id: UUID,
        business_id: UUID,
    ) -> Optional[Dashboard]:
        """
        Apply a template's layout to an existing dashboard.
        Clears existing widgets and creates new ones from the template.
        """
        dashboard = self.get_dashboard(dashboard_id, business_id)
        template = (
            self.db.query(DashboardTemplate)
            .filter(DashboardTemplate.id == template_id)
            .first()
        )
        if not dashboard or not template:
            return None

        # Clear existing widgets
        existing = self.list_widgets(dashboard_id)
        for widget in existing:
            widget.soft_delete()

        # Create widgets from template layout
        layout = template.layout or {}
        for widget_def in layout.get("widgets", []):
            self.add_widget(
                dashboard_id=dashboard_id,
                widget_type=widget_def.get("type", "chart"),
                title=widget_def.get("title", "Widget"),
                position_x=widget_def.get("x", 0),
                position_y=widget_def.get("y", 0),
            )

        self.db.commit()
        self.db.refresh(dashboard)
        return dashboard

    # ------------------------------------------------------------------
    # Sharing
    # ------------------------------------------------------------------

    def share_dashboard(
        self,
        dashboard_id: UUID,
        shared_with_user_id: UUID,
        permission: str = "view",
    ) -> DashboardShare:
        """Share a dashboard with another user."""
        share = DashboardShare(
            dashboard_id=dashboard_id,
            shared_with_user_id=shared_with_user_id,
            permission=permission,
        )
        self.db.add(share)
        self.db.commit()
        self.db.refresh(share)
        return share

    def list_shares(self, dashboard_id: UUID) -> List[DashboardShare]:
        """List all users a dashboard is shared with."""
        return (
            self.db.query(DashboardShare)
            .filter(DashboardShare.dashboard_id == dashboard_id)
            .all()
        )

    def remove_share(self, share_id: UUID) -> bool:
        """Remove a dashboard share."""
        share = (
            self.db.query(DashboardShare)
            .filter(DashboardShare.id == share_id)
            .first()
        )
        if not share:
            return False
        self.db.delete(share)
        self.db.commit()
        return True

    # ------------------------------------------------------------------
    # Export schedules
    # ------------------------------------------------------------------

    def create_export_schedule(
        self,
        dashboard_id: UUID,
        user_id: UUID,
        format: str = "pdf",
        frequency: str = "weekly",
    ) -> DashboardExportSchedule:
        """Create a scheduled export for a dashboard."""
        schedule = DashboardExportSchedule(
            dashboard_id=dashboard_id,
            user_id=user_id,
            format=format,
            frequency=frequency,
            is_active=True,
        )
        self.db.add(schedule)
        self.db.commit()
        self.db.refresh(schedule)
        return schedule

    def list_export_schedules(
        self, dashboard_id: UUID
    ) -> List[DashboardExportSchedule]:
        """List all export schedules for a dashboard."""
        return (
            self.db.query(DashboardExportSchedule)
            .filter(DashboardExportSchedule.dashboard_id == dashboard_id)
            .all()
        )

    def toggle_export_schedule(
        self, schedule_id: UUID, is_active: bool
    ) -> Optional[DashboardExportSchedule]:
        """Enable or disable an export schedule."""
        schedule = (
            self.db.query(DashboardExportSchedule)
            .filter(DashboardExportSchedule.id == schedule_id)
            .first()
        )
        if not schedule:
            return None
        schedule.is_active = is_active
        self.db.commit()
        self.db.refresh(schedule)
        return schedule
