"""
backend/app/agents/tools/staff_tools.py

Thin wrappers around TimeEntryService and StaffReportService.
"""

import asyncio
import logging
from datetime import date, datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.time_entry_service import TimeEntryService
from app.services.staff_report_service import StaffReportService
from app.agents.tools.common import get_business_id_for_user

logger = logging.getLogger("bizpilot.agents")


def _parse_date(value: Optional[str]) -> Optional[date]:
    """Parse YYYY-MM-DD string into a date object. Returns None on failure."""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        logger.warning(f"Invalid date format: {value}. Expected YYYY-MM-DD.")
        return None


async def get_staff_summary(
    db: Session,
    user: User,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Return a staff performance and attendance summary for a period."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    start = _parse_date(start_date) or date.today()
    end = _parse_date(end_date) or date.today()

    if start_date and not _parse_date(start_date):
        return {"error": f"Invalid start_date format: {start_date}. Use YYYY-MM-DD."}
    if end_date and not _parse_date(end_date):
        return {"error": f"Invalid end_date format: {end_date}. Use YYYY-MM-DD."}

    try:
        svc = StaffReportService(db)
        report = await asyncio.to_thread(
            svc.get_performance_report,
            business_id=business_id,
            start_date=start,
            end_date=end,
        )
        return report if isinstance(report, dict) else {"summary": str(report)}
    except Exception as exc:
        return {"error": f"Could not retrieve staff summary: {str(exc)}"}


async def get_time_entries(
    db: Session,
    user: User,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 50,
) -> Dict[str, Any]:
    """Return clock-in/clock-out entries for the business in a date range."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    start = _parse_date(start_date) or date.today()
    end = _parse_date(end_date) or date.today()

    svc = TimeEntryService(db)
    entries = await asyncio.to_thread(
        svc.get_entries,
        business_id=business_id,
        start_date=datetime.combine(start, datetime.min.time()),
        end_date=datetime.combine(end, datetime.max.time()),
    )

    return {
        "total": len(entries),
        "entries": [
            {
                "user_id": str(e.user_id),
                "clock_in": e.clock_in.isoformat() if e.clock_in else None,
                "clock_out": e.clock_out.isoformat() if e.clock_out else None,
                "duration_hours": round(
                    (e.clock_out - e.clock_in).total_seconds() / 3600, 2
                ) if e.clock_in and e.clock_out else None,
            }
            for e in entries[:limit]
        ],
    }
