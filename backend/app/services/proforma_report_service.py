"""Proforma invoice reporting service.

Provides conversion rate analytics, value reports, aging analysis,
and lost-quotes breakdowns (Requirements 7.1–7.8).
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.proforma import ProformaInvoice, QuoteStatus


class ProformaReportService:
    """Analytics and reporting for proforma invoices."""

    def __init__(self, db: Session):
        self.db = db

    def get_conversion_rate(self, business_id: str) -> dict:
        """Calculate conversion rate metrics for the business.

        Returns counts by status and conversion/approval percentages.
        """
        base = self.db.query(ProformaInvoice).filter(
            ProformaInvoice.business_id == business_id,
            ProformaInvoice.deleted_at.is_(None),
        )

        total = base.count()
        if total == 0:
            return {
                "total_quotes": 0,
                "approved": 0,
                "converted": 0,
                "rejected": 0,
                "expired": 0,
                "cancelled": 0,
                "conversion_rate": 0.0,
                "approval_rate": 0.0,
            }

        approved = base.filter(ProformaInvoice.status == QuoteStatus.APPROVED).count()
        converted = base.filter(ProformaInvoice.status == QuoteStatus.CONVERTED).count()
        rejected = base.filter(ProformaInvoice.status == QuoteStatus.REJECTED).count()
        expired = base.filter(ProformaInvoice.status == QuoteStatus.EXPIRED).count()
        cancelled = base.filter(ProformaInvoice.status == QuoteStatus.CANCELLED).count()

        return {
            "total_quotes": total,
            "approved": approved,
            "converted": converted,
            "rejected": rejected,
            "expired": expired,
            "cancelled": cancelled,
            "conversion_rate": round((converted / total) * 100, 1),
            "approval_rate": round(((approved + converted) / total) * 100, 1),
        }

    def get_value_report(
        self,
        business_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> dict:
        """Aggregate quote value statistics for a date range.

        Defaults to the last 30 days if no range is provided.
        """
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)

        self.db.query(ProformaInvoice).filter(
            ProformaInvoice.business_id == business_id,
            ProformaInvoice.deleted_at.is_(None),
            ProformaInvoice.created_at >= start_dt,
            ProformaInvoice.created_at < end_dt,
        )

        row = self.db.query(
            func.count(ProformaInvoice.id).label("cnt"),
            func.coalesce(func.sum(ProformaInvoice.total), 0).label("total_val"),
            func.coalesce(func.avg(ProformaInvoice.total), 0).label("avg_val"),
            func.coalesce(func.min(ProformaInvoice.total), 0).label("min_val"),
            func.coalesce(func.max(ProformaInvoice.total), 0).label("max_val"),
        ).filter(
            ProformaInvoice.business_id == business_id,
            ProformaInvoice.deleted_at.is_(None),
            ProformaInvoice.created_at >= start_dt,
            ProformaInvoice.created_at < end_dt,
        ).one()

        return {
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "total_quotes": int(row.cnt),
            "total_value": round(float(row.total_val), 2),
            "avg_value": round(float(row.avg_val), 2),
            "min_value": round(float(row.min_val), 2),
            "max_value": round(float(row.max_val), 2),
        }

    def get_aging_report(self, business_id: str) -> dict:
        """Quote aging buckets: 0–7, 8–14, 15–30, 30+ days.

        Ages are calculated from issue_date for active (non-terminal) quotes.
        """
        today = date.today()
        active_statuses = [
            QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.VIEWED, QuoteStatus.APPROVED,
        ]

        quotes = (
            self.db.query(ProformaInvoice)
            .filter(
                ProformaInvoice.business_id == business_id,
                ProformaInvoice.status.in_(active_statuses),
                ProformaInvoice.deleted_at.is_(None),
            )
            .all()
        )

        buckets = {"bucket_0_7": 0, "bucket_8_14": 0, "bucket_15_30": 0, "bucket_30_plus": 0}
        for q in quotes:
            age = (today - q.issue_date).days if q.issue_date else 0
            if age <= 7:
                buckets["bucket_0_7"] += 1
            elif age <= 14:
                buckets["bucket_8_14"] += 1
            elif age <= 30:
                buckets["bucket_15_30"] += 1
            else:
                buckets["bucket_30_plus"] += 1

        buckets["total"] = len(quotes)
        return buckets

    def get_lost_quotes(
        self,
        business_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> dict:
        """Analysis of rejected and expired quotes (Requirement 7.5).

        Returns a list of lost quote summaries and aggregate stats.
        """
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=90)

        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)

        quotes = (
            self.db.query(ProformaInvoice)
            .filter(
                ProformaInvoice.business_id == business_id,
                ProformaInvoice.status.in_([QuoteStatus.REJECTED, QuoteStatus.EXPIRED]),
                ProformaInvoice.deleted_at.is_(None),
                ProformaInvoice.created_at >= start_dt,
                ProformaInvoice.created_at < end_dt,
            )
            .order_by(ProformaInvoice.created_at.desc())
            .all()
        )

        rejected = 0
        expired = 0
        total_value = Decimal("0")
        items = []

        for q in quotes:
            status_val = q.status.value if hasattr(q.status, "value") else str(q.status)
            if status_val == "rejected":
                rejected += 1
                reason = q.rejection_reason
            else:
                expired += 1
                reason = "Expired"

            total_value += q.total or Decimal("0")
            items.append({
                "quote_id": str(q.id),
                "quote_number": q.quote_number,
                "customer_id": str(q.customer_id) if q.customer_id else None,
                "total": float(q.total or 0),
                "status": status_val,
                "reason": reason,
                "created_at": q.created_at.isoformat() if q.created_at else None,
            })

        return {
            "total_lost": len(quotes),
            "total_value": round(float(total_value), 2),
            "rejected_count": rejected,
            "expired_count": expired,
            "items": items,
        }
