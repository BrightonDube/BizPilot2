"""
backend/app/agents/tools/staff_tools.py

Thin wrappers around TimeEntryService and StaffReportService.
"""

from datetime import date, datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.ai_service import AIService
from app.services.time_entry_service import TimeEntryService
from app.services.staff_report_service import StaffReportService


def _get_business_id(db: Session, user: User) -> Optional[str]:
    ai_svc = AIService(db)
    business = ai_svc._get_business_for_user(user.id)
    return str(business.id) if business else None


def _parse_date(value: Optional[str]) -> date:
    if value:
        try:
            return datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            pass
    return date.today()


async def get_staff_summary(
    db: Session,
    user: User,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Return a staff performance and attendance summary for a period."""
    business_id = _get_business_id(db, user)
    if not business_id:
        return {"error": "No business found for user"}

    start = _parse_date(start_date)
    end = _parse_date(end_date)

    try:
        svc = StaffReportService(db)
        report = svc.get_performance_report(
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
    business_id = _get_business_id(db, user)
    if not business_id:
        return {"error": "No business found for user"}

    start = _parse_date(start_date)
    end = _parse_date(end_date)

    svc = TimeEntryService(db)
    entries = svc.get_entries(
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
