"""Layby report service for analytics and summaries."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.layby import Layby, LaybyStatus
from app.models.layby_payment import LaybyPayment, PaymentStatus


class LaybyReportService:
    """Service for generating layby reports and analytics."""

    def __init__(self, db: Session):
        self.db = db

    def get_active_laybys(self, business_id: UUID) -> dict:
        """Get summary of all active laybys for a business.

        Returns dict with total_count, total_value, total_paid, total_outstanding.
        """
        query = self.db.query(
            func.count(Layby.id).label("total_count"),
            func.coalesce(func.sum(Layby.total_amount), 0).label("total_value"),
            func.coalesce(func.sum(Layby.amount_paid), 0).label("total_paid"),
            func.coalesce(func.sum(Layby.balance_due), 0).label("total_outstanding"),
        ).filter(
            Layby.business_id == str(business_id),
            Layby.status.in_([LaybyStatus.ACTIVE.value, LaybyStatus.OVERDUE.value]),
            Layby.deleted_at.is_(None),
        )

        row = query.one()
        return {
            "total_count": int(row.total_count),
            "total_value": round(float(row.total_value), 2),
            "total_paid": round(float(row.total_paid), 2),
            "total_outstanding": round(float(row.total_outstanding), 2),
        }

    def get_overdue_laybys(self, business_id: UUID) -> dict:
        """Get overdue laybys — those whose next_payment_date has passed.

        Returns dict with count, total_overdue_amount, and list of overdue layby summaries.
        """
        today = date.today()
        query = self.db.query(Layby).filter(
            Layby.business_id == str(business_id),
            Layby.status.in_([LaybyStatus.ACTIVE.value, LaybyStatus.OVERDUE.value]),
            Layby.next_payment_date < today,
            Layby.deleted_at.is_(None),
        ).order_by(Layby.next_payment_date.asc())

        laybys = query.all()

        overdue_items = []
        total_overdue = Decimal("0.00")
        for lb in laybys:
            days_overdue = (today - lb.next_payment_date).days if lb.next_payment_date else 0
            total_overdue += lb.balance_due
            overdue_items.append({
                "layby_id": str(lb.id),
                "reference_number": lb.reference_number,
                "customer_id": str(lb.customer_id),
                "balance_due": round(float(lb.balance_due), 2),
                "next_payment_date": str(lb.next_payment_date) if lb.next_payment_date else None,
                "days_overdue": days_overdue,
            })

        return {
            "count": len(overdue_items),
            "total_overdue_amount": round(float(total_overdue), 2),
            "laybys": overdue_items,
        }

    def get_aging_report(self, business_id: UUID) -> dict:
        """Get aging report with buckets: 0-30, 31-60, 61-90, 90+ days.

        Ages are calculated from the layby start_date to today.
        """
        today = date.today()

        laybys = (
            self.db.query(Layby)
            .filter(
                Layby.business_id == str(business_id),
                Layby.status.in_([LaybyStatus.ACTIVE.value, LaybyStatus.OVERDUE.value]),
                Layby.deleted_at.is_(None),
            )
            .all()
        )

        buckets = {
            "0_30": {"count": 0, "total_value": 0.0, "total_outstanding": 0.0},
            "31_60": {"count": 0, "total_value": 0.0, "total_outstanding": 0.0},
            "61_90": {"count": 0, "total_value": 0.0, "total_outstanding": 0.0},
            "90_plus": {"count": 0, "total_value": 0.0, "total_outstanding": 0.0},
        }

        for lb in laybys:
            age_days = (today - lb.start_date).days if lb.start_date else 0
            value = float(lb.total_amount)
            outstanding = float(lb.balance_due)

            if age_days <= 30:
                key = "0_30"
            elif age_days <= 60:
                key = "31_60"
            elif age_days <= 90:
                key = "61_90"
            else:
                key = "90_plus"

            buckets[key]["count"] += 1
            buckets[key]["total_value"] = round(buckets[key]["total_value"] + value, 2)
            buckets[key]["total_outstanding"] = round(
                buckets[key]["total_outstanding"] + outstanding, 2
            )

        return {
            "as_of": today.isoformat(),
            "buckets": buckets,
            "total_active": sum(b["count"] for b in buckets.values()),
        }

    def get_summary(
        self,
        business_id: UUID,
        start_date: date,
        end_date: date,
    ) -> dict:
        """Get layby summary statistics for a date range.

        Covers laybys created, completed, cancelled, and payment totals within the period.
        """
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)

        base_filter = [
            Layby.business_id == str(business_id),
            Layby.deleted_at.is_(None),
        ]

        # Laybys created in period
        created_count = (
            self.db.query(func.count(Layby.id))
            .filter(*base_filter, Layby.created_at >= start_dt, Layby.created_at < end_dt)
            .scalar()
        ) or 0

        created_value = (
            self.db.query(func.coalesce(func.sum(Layby.total_amount), 0))
            .filter(*base_filter, Layby.created_at >= start_dt, Layby.created_at < end_dt)
            .scalar()
        )

        # Completed in period
        completed_count = (
            self.db.query(func.count(Layby.id))
            .filter(
                *base_filter,
                Layby.status == LaybyStatus.COMPLETED,
                Layby.collected_at >= start_dt,
                Layby.collected_at < end_dt,
            )
            .scalar()
        ) or 0

        # Cancelled in period
        cancelled_count = (
            self.db.query(func.count(Layby.id))
            .filter(
                *base_filter,
                Layby.status == LaybyStatus.CANCELLED,
                Layby.cancelled_at >= start_dt,
                Layby.cancelled_at < end_dt,
            )
            .scalar()
        ) or 0

        # Payments collected in period
        payments_row = (
            self.db.query(
                func.count(LaybyPayment.id).label("payment_count"),
                func.coalesce(func.sum(LaybyPayment.amount), 0).label("payment_total"),
            )
            .join(Layby, Layby.id == LaybyPayment.layby_id)
            .filter(
                Layby.business_id == str(business_id),
                LaybyPayment.status == PaymentStatus.COMPLETED,
                LaybyPayment.created_at >= start_dt,
                LaybyPayment.created_at < end_dt,
            )
            .one()
        )

        # Refunds in period
        refund_total = (
            self.db.query(func.coalesce(func.sum(LaybyPayment.refund_amount), 0))
            .join(Layby, Layby.id == LaybyPayment.layby_id)
            .filter(
                Layby.business_id == str(business_id),
                LaybyPayment.status == PaymentStatus.REFUNDED,
                LaybyPayment.refunded_at >= start_dt,
                LaybyPayment.refunded_at < end_dt,
            )
            .scalar()
        )

        # Currently active count (snapshot)
        active_count = (
            self.db.query(func.count(Layby.id))
            .filter(
                *base_filter,
                Layby.status.in_([LaybyStatus.ACTIVE.value, LaybyStatus.OVERDUE.value]),
            )
            .scalar()
        ) or 0

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "created": {
                "count": int(created_count),
                "total_value": round(float(created_value), 2),
            },
            "completed": {"count": int(completed_count)},
            "cancelled": {"count": int(cancelled_count)},
            "payments": {
                "count": int(payments_row.payment_count),
                "total": round(float(payments_row.payment_total), 2),
            },
            "refunds": {"total": round(float(refund_total), 2)},
            "active_snapshot": {"count": int(active_count)},
        }
