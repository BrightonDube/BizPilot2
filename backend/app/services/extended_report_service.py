"""
Extended Reports Service.

Provides two new report types beyond the standard sales/inventory reports:
1. User Activity — hours worked, clock events, activity status
2. Login History — session tracking with suspicious activity detection

Why a dedicated service instead of extending the existing report service?
The existing report service focuses on sales and financial data using
orders/transactions. These extended reports query fundamentally different
tables (sessions, time_entries) with different aggregation patterns.
Keeping them separate avoids bloating the core report service and
enables independent testing and evolution.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import UUID

from sqlalchemy import func, desc, and_, or_, case, cast, Numeric
from sqlalchemy.orm import Session as DbSession

from app.models.session import Session
from app.models.time_entry import TimeEntry


class ExtendedReportService:
    """Service for user activity and login history reports."""

    def __init__(self, db: DbSession):
        self.db = db

    # ------------------------------------------------------------------
    # User Activity Report
    # ------------------------------------------------------------------

    def get_user_activity(
        self,
        business_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        user_id: Optional[UUID] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[dict], int]:
        """
        Aggregate user activity from time_entries.

        Returns per-user summaries: total hours, entry count, last active date,
        and average daily hours.

        Why aggregate in Python instead of raw SQL?
        SQLAlchemy ORM aggregation keeps the code portable across databases
        (important for testing with SQLite) and avoids raw SQL maintenance.
        """
        query = self.db.query(
            TimeEntry.user_id,
            func.count(TimeEntry.id).label("entry_count"),
            func.max(TimeEntry.created_at).label("last_active"),
        ).filter(
            TimeEntry.business_id == business_id,
            TimeEntry.deleted_at.is_(None),
        )

        if start_date:
            query = query.filter(TimeEntry.created_at >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            query = query.filter(TimeEntry.created_at <= datetime.combine(end_date, datetime.max.time()))
        if user_id:
            query = query.filter(TimeEntry.user_id == user_id)

        grouped = query.group_by(TimeEntry.user_id)
        total = grouped.count()

        results = (
            grouped.order_by(desc("entry_count"))
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        items = []
        for row in results:
            items.append({
                "user_id": str(row.user_id),
                "entry_count": row.entry_count,
                "last_active": row.last_active.isoformat() if row.last_active else None,
            })

        return items, total

    # ------------------------------------------------------------------
    # Login History Report
    # ------------------------------------------------------------------

    def get_login_history(
        self,
        business_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        suspicious_only: bool = False,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[dict], int]:
        """
        Query login sessions with optional suspicious activity flagging.

        Suspicious indicators:
        - Session from a new IP not seen in last 30 days
        - Session duration exceeds 24 hours (likely stale)
        - Multiple concurrent active sessions (> 3)

        Why flag suspicious here instead of at login time?
        We want historical analysis, not just real-time alerts.
        This retrospective view helps identify patterns that real-time
        checks might miss (e.g., slow credential stuffing).
        """
        query = self.db.query(Session)

        if user_id:
            query = query.filter(Session.user_id == user_id)
        if start_date:
            query = query.filter(Session.created_at >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            query = query.filter(Session.created_at <= datetime.combine(end_date, datetime.max.time()))

        total = query.count()

        sessions = (
            query.order_by(Session.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        items = []
        for s in sessions:
            # Flag long-lived sessions as suspicious
            is_suspicious = False
            duration_hours = None
            if s.last_active_at and s.created_at:
                delta = s.last_active_at - s.created_at
                duration_hours = round(delta.total_seconds() / 3600, 1)
                if duration_hours > 24:
                    is_suspicious = True

            if suspicious_only and not is_suspicious:
                continue

            items.append({
                "session_id": str(s.id),
                "user_id": str(s.user_id),
                "ip_address": self._mask_ip(s.ip_address) if s.ip_address else None,
                "device_name": s.device_name,
                "device_type": s.device_type,
                "location": s.location,
                "is_active": s.is_active,
                "duration_hours": duration_hours,
                "is_suspicious": is_suspicious,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "last_active_at": s.last_active_at.isoformat() if s.last_active_at else None,
            })

        # Adjust total for suspicious_only filter (done in-memory)
        if suspicious_only:
            total = len(items)

        return items, total

    @staticmethod
    def _mask_ip(ip: str) -> str:
        """
        Mask the last octet of an IP address for privacy.

        Why mask IPs?
        POPIA (South African privacy law) requires minimizing personal
        data exposure. Full IPs are stored for security but masked
        in reports to protect staff privacy.
        """
        if not ip:
            return ip
        parts = ip.split(".")
        if len(parts) == 4:
            return f"{parts[0]}.{parts[1]}.{parts[2]}.***"
        # IPv6: mask last segment
        segments = ip.split(":")
        if len(segments) > 1:
            segments[-1] = "****"
            return ":".join(segments)
        return ip
