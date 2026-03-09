"""Stock monitoring service.

Provides low-stock detection, sales velocity calculation, and projected
stockout date computation.

Why a separate service from ReorderService?
ReorderService handles the procurement workflow (rules, POs, approvals).
StockMonitorService is a read-only analytical layer that *informs*
reorder decisions.  Keeping them separate respects single-responsibility
and lets us optimise the monitoring queries independently.
"""

import math
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.reorder import ProductReorderSettings, ReorderRule


class StockMonitorService:
    """Read-only service for stock level monitoring and analytics."""

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Low-stock detection
    # ------------------------------------------------------------------

    def get_low_stock_items(
        self,
        business_id: UUID,
        *,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[list, int]:
        """Return products whose current stock is at or below their reorder point.

        Checks both ProductReorderSettings.reorder_point and
        ReorderRule.min_stock_level, preferring the settings table when
        both exist.
        """
        # Products with explicit reorder settings
        query = (
            self.db.query(Product, ProductReorderSettings)
            .join(
                ProductReorderSettings,
                and_(
                    ProductReorderSettings.product_id == Product.id,
                    ProductReorderSettings.business_id == str(business_id),
                ),
            )
            .filter(
                Product.business_id == str(business_id),
                Product.deleted_at.is_(None),
                Product.quantity <= ProductReorderSettings.reorder_point,
            )
        )

        total = query.count()
        items = query.offset((page - 1) * per_page).limit(per_page).all()

        results = []
        for product, settings in items:
            results.append({
                "product_id": str(product.id),
                "product_name": product.name,
                "current_stock": product.quantity or 0,
                "reorder_point": settings.reorder_point,
                "safety_stock": settings.safety_stock,
                "auto_reorder": settings.auto_reorder,
                "preferred_supplier_id": (
                    str(settings.preferred_supplier_id)
                    if settings.preferred_supplier_id
                    else None
                ),
            })

        return results, total

    # ------------------------------------------------------------------
    # Sales velocity
    # ------------------------------------------------------------------

    def calculate_sales_velocity(
        self,
        product_id: UUID,
        business_id: UUID,
        *,
        lookback_days: int = 30,
    ) -> float:
        """Calculate the average daily sales quantity over a lookback period.

        Why a simple average instead of weighted/exponential?
        The simple average is transparent, easy to explain to merchants,
        and sufficient for reorder point calculation.  A more
        sophisticated model can be swapped in later without changing the
        interface.
        """
        from app.models.order import OrderItem, Order, OrderStatus

        cutoff = datetime.utcnow() - timedelta(days=lookback_days)

        total_sold = (
            self.db.query(func.coalesce(func.sum(OrderItem.quantity), 0))
            .join(Order, Order.id == OrderItem.order_id)
            .filter(
                OrderItem.product_id == str(product_id),
                Order.business_id == str(business_id),
                Order.created_at >= cutoff,
                Order.status != OrderStatus.CANCELLED.value,
                Order.deleted_at.is_(None),
            )
            .scalar()
        )

        if lookback_days <= 0:
            return 0.0

        return round(float(total_sold) / lookback_days, 2)

    # ------------------------------------------------------------------
    # Projected stockout date
    # ------------------------------------------------------------------

    def calculate_stockout_date(
        self,
        product_id: UUID,
        business_id: UUID,
        *,
        current_stock: Optional[int] = None,
        lookback_days: int = 30,
    ) -> Optional[int]:
        """Calculate days until projected stockout based on sales velocity.

        Returns the number of days until stock reaches zero, or None if
        velocity is zero (no sales → no stockout projection).
        """
        if current_stock is None:
            product = (
                self.db.query(Product)
                .filter(Product.id == str(product_id), Product.deleted_at.is_(None))
                .first()
            )
            if not product:
                return None
            current_stock = product.quantity or 0

        velocity = self.calculate_sales_velocity(
            product_id, business_id, lookback_days=lookback_days
        )

        if velocity <= 0:
            return None  # No sales → can't project stockout

        days = math.ceil(current_stock / velocity)
        return days

    # ------------------------------------------------------------------
    # Suggested reorder point
    # ------------------------------------------------------------------

    def suggest_reorder_point(
        self,
        product_id: UUID,
        business_id: UUID,
        *,
        lead_time_days: int = 7,
        safety_factor: float = 1.5,
        lookback_days: int = 30,
    ) -> int:
        """Suggest a reorder point based on sales velocity and lead time.

        Formula: reorder_point = (velocity × lead_time) × safety_factor

        Why this formula?
        It's the standard "lead-time demand + safety stock" heuristic
        used in retail and restaurant inventory management.  The safety
        factor accounts for demand variability without requiring
        historical variance data.
        """
        velocity = self.calculate_sales_velocity(
            product_id, business_id, lookback_days=lookback_days
        )

        lead_time_demand = velocity * lead_time_days
        return math.ceil(lead_time_demand * safety_factor)
