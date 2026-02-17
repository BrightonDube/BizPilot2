"""Dashboard service for custom dashboards."""

from typing import List, Optional, Tuple, Any
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi import HTTPException, status

from app.models.custom_dashboard import Dashboard, DashboardWidget
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
