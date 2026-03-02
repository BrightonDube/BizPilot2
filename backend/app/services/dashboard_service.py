"""Dashboard service for custom dashboards.

Provides CRUD for dashboards, widgets, templates, shares, and export
schedules.  Also fetches real-time widget data from the underlying
business data models (orders, products, customers).
"""

from typing import List, Optional, Tuple, Any
from datetime import datetime, timedelta, timezone
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi import HTTPException, status

from app.models.custom_dashboard import (
    Dashboard, DashboardWidget, DashboardTemplate,
    DashboardShare, DashboardExportSchedule,
)
from app.models.order import Order, OrderItem, OrderDirection
from app.models.product import Product
from app.models.customer import Customer
from app.models.base import utc_now


class DashboardService:
    """Service for custom dashboard operations."""

    def __init__(self, db: Session):
        self.db = db

    def create_dashboard(
        self,
        business_id: str,
        user_id: str,
        name: str,
        description: Optional[str] = None,
    ) -> Dashboard:
        """Create a new dashboard."""
        dashboard = Dashboard(
            business_id=business_id,
            user_id=user_id,
            name=name,
            description=description,
        )
        self.db.add(dashboard)
        self.db.commit()
        self.db.refresh(dashboard)
        return dashboard

    def list_dashboards(
        self, business_id: str, user_id: str
    ) -> Tuple[List[Dashboard], int]:
        """List user's dashboards and shared dashboards."""
        query = self.db.query(Dashboard).filter(
            Dashboard.business_id == business_id,
            Dashboard.deleted_at.is_(None),
            or_(
                Dashboard.user_id == user_id,
                Dashboard.is_shared.is_(True),
            ),
        )
        total = query.count()
        items = query.order_by(Dashboard.created_at.desc()).all()
        return items, total

    def get_dashboard(self, dashboard_id: str, business_id: str) -> Dashboard:
        """Get a dashboard with widgets."""
        dashboard = (
            self.db.query(Dashboard)
            .filter(
                Dashboard.id == dashboard_id,
                Dashboard.business_id == business_id,
                Dashboard.deleted_at.is_(None),
            )
            .first()
        )
        if not dashboard:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dashboard not found",
            )
        return dashboard

    def update_dashboard(
        self, dashboard_id: str, business_id: str, **kwargs
    ) -> Dashboard:
        """Update a dashboard."""
        dashboard = self.get_dashboard(dashboard_id, business_id)
        for key, value in kwargs.items():
            if value is not None and hasattr(dashboard, key):
                setattr(dashboard, key, value)
        dashboard.updated_at = utc_now()
        self.db.commit()
        self.db.refresh(dashboard)
        return dashboard

    def delete_dashboard(self, dashboard_id: str, business_id: str) -> None:
        """Soft delete a dashboard."""
        dashboard = self.get_dashboard(dashboard_id, business_id)
        dashboard.soft_delete()
        self.db.commit()

    def add_widget(
        self,
        dashboard_id: str,
        widget_type: str,
        title: str,
        config: Optional[dict] = None,
        pos_x: int = 0,
        pos_y: int = 0,
        width: int = 4,
        height: int = 3,
    ) -> DashboardWidget:
        """Add a widget to a dashboard."""
        widget = DashboardWidget(
            dashboard_id=dashboard_id,
            widget_type=widget_type,
            title=title,
            config=config,
            position_x=pos_x,
            position_y=pos_y,
            width=width,
            height=height,
        )
        self.db.add(widget)
        self.db.commit()
        self.db.refresh(widget)
        return widget

    def update_widget(self, widget_id: str, **kwargs) -> DashboardWidget:
        """Update a widget's position or config."""
        widget = (
            self.db.query(DashboardWidget)
            .filter(
                DashboardWidget.id == widget_id,
                DashboardWidget.deleted_at.is_(None),
            )
            .first()
        )
        if not widget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Widget not found",
            )
        for key, value in kwargs.items():
            if value is not None and hasattr(widget, key):
                setattr(widget, key, value)
        widget.updated_at = utc_now()
        self.db.commit()
        self.db.refresh(widget)
        return widget

    def remove_widget(self, widget_id: str) -> None:
        """Remove a widget."""
        widget = (
            self.db.query(DashboardWidget)
            .filter(
                DashboardWidget.id == widget_id,
                DashboardWidget.deleted_at.is_(None),
            )
            .first()
        )
        if not widget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Widget not found",
            )
        widget.soft_delete()
        self.db.commit()

    def get_widget_data(
        self, widget_type: str, config: Optional[dict], business_id: str
    ) -> Any:
        """Fetch actual data for a widget based on its type."""
        handlers = {
            "kpi_total_sales": self._kpi_total_sales,
            "kpi_total_orders": self._kpi_total_orders,
            "kpi_total_customers": self._kpi_total_customers,
            "kpi_total_products": self._kpi_total_products,
            "kpi_total_revenue": self._kpi_total_revenue,
            "chart_sales_trend": self._chart_sales_trend,
            "chart_top_products": self._chart_top_products,
            "chart_order_status": self._chart_order_status,
            "list_recent_orders": self._list_recent_orders,
            "list_low_stock": self._list_low_stock,
        }
        handler = handlers.get(widget_type)
        if not handler:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown widget type: {widget_type}",
            )
        return handler(business_id, config)

    def _sales_query(self, business_id: str):
        """Base query for inbound (sales) orders."""
        return self.db.query(Order).filter(
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
            Order.direction == OrderDirection.INBOUND,
        )

    def _kpi_total_sales(self, business_id: str, config: Optional[dict]) -> dict:
        total = (
            self._sales_query(business_id)
            .with_entities(func.coalesce(func.sum(Order.total), 0))
            .scalar()
        )
        return {"value": float(total)}

    def _kpi_total_orders(self, business_id: str, config: Optional[dict]) -> dict:
        count = self._sales_query(business_id).count()
        return {"value": count}

    def _kpi_total_customers(self, business_id: str, config: Optional[dict]) -> dict:
        count = (
            self.db.query(Customer)
            .filter(
                Customer.business_id == business_id,
                Customer.deleted_at.is_(None),
            )
            .count()
        )
        return {"value": count}

    def _kpi_total_products(self, business_id: str, config: Optional[dict]) -> dict:
        count = (
            self.db.query(Product)
            .filter(
                Product.business_id == business_id,
                Product.deleted_at.is_(None),
            )
            .count()
        )
        return {"value": count}

    def _kpi_total_revenue(self, business_id: str, config: Optional[dict]) -> dict:
        total = (
            self._sales_query(business_id)
            .with_entities(func.coalesce(func.sum(Order.total), 0))
            .scalar()
        )
        return {"value": float(total)}

    def _chart_sales_trend(self, business_id: str, config: Optional[dict]) -> dict:
        since = datetime.now(timezone.utc) - timedelta(days=30)
        rows = (
            self._sales_query(business_id)
            .filter(Order.created_at >= since)
            .with_entities(
                func.date(Order.created_at).label("date"),
                func.coalesce(func.sum(Order.total), 0).label("total"),
            )
            .group_by(func.date(Order.created_at))
            .order_by(func.date(Order.created_at))
            .all()
        )
        return {
            "labels": [str(r.date) for r in rows],
            "values": [float(r.total) for r in rows],
        }

    def _chart_top_products(self, business_id: str, config: Optional[dict]) -> dict:
        rows = (
            self.db.query(
                OrderItem.name,
                func.sum(OrderItem.quantity).label("qty"),
            )
            .join(Order, Order.id == OrderItem.order_id)
            .filter(
                Order.business_id == business_id,
                Order.deleted_at.is_(None),
                Order.direction == OrderDirection.INBOUND,
            )
            .group_by(OrderItem.name)
            .order_by(func.sum(OrderItem.quantity).desc())
            .limit(10)
            .all()
        )
        return {
            "labels": [r.name for r in rows],
            "values": [int(r.qty) for r in rows],
        }

    def _chart_order_status(self, business_id: str, config: Optional[dict]) -> dict:
        rows = (
            self._sales_query(business_id)
            .with_entities(Order.status, func.count().label("count"))
            .group_by(Order.status)
            .all()
        )
        return {
            "labels": [r.status.value if hasattr(r.status, "value") else str(r.status) for r in rows],
            "values": [r.count for r in rows],
        }

    def _list_recent_orders(self, business_id: str, config: Optional[dict]) -> dict:
        orders = (
            self._sales_query(business_id)
            .order_by(Order.created_at.desc())
            .limit(10)
            .all()
        )
        return {
            "items": [
                {
                    "id": str(o.id),
                    "order_number": o.order_number,
                    "total": float(o.total),
                    "status": o.status.value if hasattr(o.status, "value") else str(o.status),
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                }
                for o in orders
            ]
        }

    def _list_low_stock(self, business_id: str, config: Optional[dict]) -> dict:
        products = (
            self.db.query(Product)
            .filter(
                Product.business_id == business_id,
                Product.deleted_at.is_(None),
                Product.track_inventory.is_(True),
                Product.quantity <= Product.low_stock_threshold,
            )
            .order_by(Product.quantity.asc())
            .limit(10)
            .all()
        )
        return {
            "items": [
                {
                    "id": str(p.id),
                    "name": p.name,
                    "quantity": p.quantity,
                    "low_stock_threshold": p.low_stock_threshold,
                }
                for p in products
            ]
        }

    # ── Dashboard Duplication ────────────────────────────────────────────

    def duplicate_dashboard(
        self, dashboard_id: str, business_id: str, user_id: str, new_name: Optional[str] = None,
    ) -> Dashboard:
        """Deep-copy a dashboard including all its widgets.

        Why deep-copy?  Users want to experiment with layouts without
        altering the original.  A shallow reference would couple them.
        """
        source = self.get_dashboard(dashboard_id, business_id)
        clone = Dashboard(
            business_id=business_id,
            user_id=user_id,
            name=new_name or f"{source.name} (Copy)",
            description=source.description,
            layout=source.layout,
            is_default=False,
            is_shared=False,
        )
        self.db.add(clone)
        self.db.flush()

        for w in source.widgets:
            if w.deleted_at is not None:
                continue
            self.db.add(DashboardWidget(
                dashboard_id=clone.id,
                widget_type=w.widget_type,
                title=w.title,
                config=w.config,
                position_x=w.position_x,
                position_y=w.position_y,
                width=w.width,
                height=w.height,
            ))

        self.db.commit()
        self.db.refresh(clone)
        return clone

    # ── Templates ────────────────────────────────────────────────────────

    def create_template(
        self, business_id: str, name: str, **kwargs,
    ) -> DashboardTemplate:
        """Create a business-specific dashboard template."""
        tpl = DashboardTemplate(
            business_id=business_id,
            name=name,
            description=kwargs.get("description"),
            category=kwargs.get("category"),
            layout=kwargs.get("layout", {}),
            widgets_config=kwargs.get("widgets_config", []),
            thumbnail_url=kwargs.get("thumbnail_url"),
        )
        self.db.add(tpl)
        self.db.commit()
        self.db.refresh(tpl)
        return tpl

    def list_templates(
        self, business_id: str,
    ) -> Tuple[List[DashboardTemplate], int]:
        """Return system templates + business-specific templates."""
        query = self.db.query(DashboardTemplate).filter(
            DashboardTemplate.deleted_at.is_(None),
            or_(
                DashboardTemplate.business_id == business_id,
                DashboardTemplate.is_system.is_(True),
            ),
        )
        total = query.count()
        items = query.order_by(DashboardTemplate.name).all()
        return items, total

    def get_template(self, template_id: str) -> DashboardTemplate:
        tpl = self.db.query(DashboardTemplate).filter(
            DashboardTemplate.id == template_id,
            DashboardTemplate.deleted_at.is_(None),
        ).first()
        if not tpl:
            raise HTTPException(status_code=404, detail="Template not found")
        return tpl

    def apply_template(
        self, template_id: str, business_id: str, user_id: str, name: Optional[str] = None,
    ) -> Dashboard:
        """Create a new dashboard from a template.

        Why materialise rather than reference?  Once applied, the user's
        dashboard is independent of the template — future template edits
        must not silently change existing dashboards.
        """
        tpl = self.get_template(template_id)
        import json
        layout_str = json.dumps(tpl.layout) if isinstance(tpl.layout, dict) else str(tpl.layout)

        dashboard = Dashboard(
            business_id=business_id,
            user_id=user_id,
            name=name or tpl.name,
            description=tpl.description,
            layout=layout_str,
        )
        self.db.add(dashboard)
        self.db.flush()

        for wc in (tpl.widgets_config or []):
            self.db.add(DashboardWidget(
                dashboard_id=dashboard.id,
                widget_type=wc.get("widget_type", "kpi_total_sales"),
                title=wc.get("title", "Widget"),
                config=wc.get("config"),
                position_x=wc.get("position_x", 0),
                position_y=wc.get("position_y", 0),
                width=wc.get("width", 4),
                height=wc.get("height", 3),
            ))

        self.db.commit()
        self.db.refresh(dashboard)
        return dashboard

    def delete_template(self, template_id: str, business_id: str) -> None:
        tpl = self.get_template(template_id)
        if tpl.is_system:
            raise HTTPException(status_code=403, detail="Cannot delete system templates")
        if str(tpl.business_id) != str(business_id):
            raise HTTPException(status_code=403, detail="Template belongs to another business")
        tpl.soft_delete()
        self.db.commit()

    # ── Sharing ──────────────────────────────────────────────────────────

    def share_dashboard(
        self, dashboard_id: str, business_id: str, shared_with_user_id: str, permission: str = "view",
    ) -> DashboardShare:
        """Share a dashboard with another user."""
        self.get_dashboard(dashboard_id, business_id)  # validate exists
        existing = self.db.query(DashboardShare).filter(
            DashboardShare.dashboard_id == dashboard_id,
            DashboardShare.shared_with_user_id == shared_with_user_id,
            DashboardShare.deleted_at.is_(None),
        ).first()
        if existing:
            existing.permission = permission
            existing.updated_at = utc_now()
            self.db.commit()
            self.db.refresh(existing)
            return existing

        share = DashboardShare(
            dashboard_id=dashboard_id,
            shared_with_user_id=shared_with_user_id,
            permission=permission,
        )
        self.db.add(share)
        self.db.commit()
        self.db.refresh(share)
        return share

    def list_shares(self, dashboard_id: str) -> Tuple[List[DashboardShare], int]:
        query = self.db.query(DashboardShare).filter(
            DashboardShare.dashboard_id == dashboard_id,
            DashboardShare.deleted_at.is_(None),
        )
        total = query.count()
        items = query.all()
        return items, total

    def revoke_share(self, share_id: str) -> None:
        share = self.db.query(DashboardShare).filter(
            DashboardShare.id == share_id,
            DashboardShare.deleted_at.is_(None),
        ).first()
        if not share:
            raise HTTPException(status_code=404, detail="Share not found")
        share.soft_delete()
        self.db.commit()

    # ── Export Schedules ─────────────────────────────────────────────────

    def create_export_schedule(
        self, dashboard_id: str, business_id: str, user_id: str, **kwargs,
    ) -> DashboardExportSchedule:
        self.get_dashboard(dashboard_id, business_id)
        schedule = DashboardExportSchedule(
            dashboard_id=dashboard_id,
            user_id=user_id,
            format=kwargs.get("format", "pdf"),
            frequency=kwargs.get("frequency", "weekly"),
            recipients=kwargs.get("recipients", []),
        )
        self.db.add(schedule)
        self.db.commit()
        self.db.refresh(schedule)
        return schedule

    def list_export_schedules(self, dashboard_id: str) -> Tuple[List[DashboardExportSchedule], int]:
        query = self.db.query(DashboardExportSchedule).filter(
            DashboardExportSchedule.dashboard_id == dashboard_id,
            DashboardExportSchedule.deleted_at.is_(None),
        )
        total = query.count()
        items = query.all()
        return items, total

    def update_export_schedule(self, schedule_id: str, **kwargs) -> DashboardExportSchedule:
        schedule = self.db.query(DashboardExportSchedule).filter(
            DashboardExportSchedule.id == schedule_id,
            DashboardExportSchedule.deleted_at.is_(None),
        ).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Export schedule not found")
        for key, value in kwargs.items():
            if value is not None and hasattr(schedule, key):
                setattr(schedule, key, value)
        schedule.updated_at = utc_now()
        self.db.commit()
        self.db.refresh(schedule)
        return schedule

    def delete_export_schedule(self, schedule_id: str) -> None:
        schedule = self.db.query(DashboardExportSchedule).filter(
            DashboardExportSchedule.id == schedule_id,
            DashboardExportSchedule.deleted_at.is_(None),
        ).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Export schedule not found")
        schedule.soft_delete()
        self.db.commit()
