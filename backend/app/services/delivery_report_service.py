"""Delivery reporting service.

Provides aggregate analytics for delivery operations:
- Delivery time statistics per zone
- Zone performance (volume, revenue, success rate)
- Cost analysis (fees collected vs estimates)
- Driver performance comparison
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy import and_, case, func, extract
from sqlalchemy.orm import Session

from app.models.delivery import Delivery, DeliveryStatus, DeliveryZone, Driver


class DeliveryReportService:
    """Generate delivery management reports."""

    def __init__(self, db: Session):
        self.db = db

    def delivery_time_report(
        self,
        business_id: str,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> Dict:
        """Delivery time statistics: average, median-like, fastest, slowest.

        Only considers completed deliveries with both estimated and actual times.
        """
        filters = [
            Delivery.business_id == business_id,
            Delivery.deleted_at.is_(None),
            Delivery.status == DeliveryStatus.DELIVERED,
            Delivery.estimated_delivery_time.isnot(None),
            Delivery.actual_delivery_time.isnot(None),
        ]
        if date_from:
            filters.append(Delivery.created_at >= date_from)
        if date_to:
            filters.append(Delivery.created_at <= date_to)

        # Calculate minutes between estimated and actual
        diff_expr = extract(
            "epoch",
            Delivery.actual_delivery_time - Delivery.estimated_delivery_time,
        ) / 60

        row = (
            self.db.query(
                func.count(Delivery.id).label("total"),
                func.avg(diff_expr).label("avg_diff_min"),
                func.min(diff_expr).label("min_diff_min"),
                func.max(diff_expr).label("max_diff_min"),
            )
            .filter(and_(*filters))
            .first()
        )

        total = row.total or 0
        return {
            "total_delivered": total,
            "avg_diff_minutes": round(float(row.avg_diff_min or 0), 1),
            "fastest_diff_minutes": round(float(row.min_diff_min or 0), 1),
            "slowest_diff_minutes": round(float(row.max_diff_min or 0), 1),
        }

    def zone_performance_report(
        self,
        business_id: str,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> List[Dict]:
        """Performance breakdown per delivery zone.

        Returns: zone name, total deliveries, delivered count, failed count,
        success rate, total fees collected.
        """
        filters = [
            Delivery.business_id == business_id,
            Delivery.deleted_at.is_(None),
            Delivery.zone_id.isnot(None),
        ]
        if date_from:
            filters.append(Delivery.created_at >= date_from)
        if date_to:
            filters.append(Delivery.created_at <= date_to)

        rows = (
            self.db.query(
                DeliveryZone.name.label("zone_name"),
                func.count(Delivery.id).label("total"),
                func.sum(
                    case(
                        (Delivery.status == DeliveryStatus.DELIVERED, 1),
                        else_=0,
                    )
                ).label("delivered"),
                func.sum(
                    case(
                        (Delivery.status == DeliveryStatus.FAILED, 1),
                        else_=0,
                    )
                ).label("failed"),
                func.coalesce(func.sum(Delivery.delivery_fee), 0).label("total_fees"),
            )
            .join(DeliveryZone, Delivery.zone_id == DeliveryZone.id)
            .filter(and_(*filters))
            .group_by(DeliveryZone.name)
            .all()
        )

        result = []
        for r in rows:
            total = r.total or 0
            delivered = r.delivered or 0
            result.append({
                "zone_name": r.zone_name,
                "total_deliveries": total,
                "delivered": delivered,
                "failed": r.failed or 0,
                "success_rate": round(delivered / total * 100, 1) if total else 0,
                "total_fees": float(r.total_fees),
            })
        return result

    def cost_analysis_report(
        self,
        business_id: str,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> Dict:
        """Cost analysis: total fees collected, average fee, fee by status."""
        filters = [
            Delivery.business_id == business_id,
            Delivery.deleted_at.is_(None),
        ]
        if date_from:
            filters.append(Delivery.created_at >= date_from)
        if date_to:
            filters.append(Delivery.created_at <= date_to)

        row = (
            self.db.query(
                func.count(Delivery.id).label("total"),
                func.coalesce(func.sum(Delivery.delivery_fee), 0).label("total_fees"),
                func.avg(Delivery.delivery_fee).label("avg_fee"),
                func.sum(
                    case(
                        (Delivery.status == DeliveryStatus.DELIVERED, Delivery.delivery_fee),
                        else_=Decimal("0"),
                    )
                ).label("collected_fees"),
                func.sum(
                    case(
                        (Delivery.status.in_([DeliveryStatus.FAILED, DeliveryStatus.RETURNED]), Delivery.delivery_fee),
                        else_=Decimal("0"),
                    )
                ).label("lost_fees"),
            )
            .filter(and_(*filters))
            .first()
        )

        return {
            "total_deliveries": row.total or 0,
            "total_fees": float(row.total_fees or 0),
            "avg_fee": round(float(row.avg_fee or 0), 2),
            "collected_fees": float(row.collected_fees or 0),
            "lost_fees": float(row.lost_fees or 0),
        }

    def driver_comparison_report(
        self,
        business_id: str,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> List[Dict]:
        """Compare driver performance across the team.

        Returns sorted by success rate descending.
        """
        filters = [
            Delivery.business_id == business_id,
            Delivery.deleted_at.is_(None),
            Delivery.driver_id.isnot(None),
        ]
        if date_from:
            filters.append(Delivery.created_at >= date_from)
        if date_to:
            filters.append(Delivery.created_at <= date_to)

        rows = (
            self.db.query(
                Driver.name.label("driver_name"),
                func.count(Delivery.id).label("total"),
                func.sum(
                    case(
                        (Delivery.status == DeliveryStatus.DELIVERED, 1),
                        else_=0,
                    )
                ).label("delivered"),
                func.sum(
                    case(
                        (Delivery.status == DeliveryStatus.FAILED, 1),
                        else_=0,
                    )
                ).label("failed"),
                func.coalesce(func.sum(Delivery.delivery_fee), 0).label("total_fees"),
            )
            .join(Driver, Delivery.driver_id == Driver.id)
            .filter(and_(*filters))
            .group_by(Driver.name)
            .all()
        )

        result = []
        for r in rows:
            total = r.total or 0
            delivered = r.delivered or 0
            result.append({
                "driver_name": r.driver_name,
                "total_deliveries": total,
                "delivered": delivered,
                "failed": r.failed or 0,
                "success_rate": round(delivered / total * 100, 1) if total else 0,
                "total_fees": float(r.total_fees),
            })
        result.sort(key=lambda x: x["success_rate"], reverse=True)
        return result
