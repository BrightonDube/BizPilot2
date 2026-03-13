"""
backend/app/agents/tools/metrics_tools.py

Thin wrappers around SalesReportService and DashboardService.
"""

import asyncio
from datetime import datetime, date
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.sales_report_service import SalesReportService
from app.agents.tools.common import get_business_id_for_user


def _parse_date(value: Optional[str]) -> date:
    """Parse YYYY-MM-DD string to date, defaulting to today."""
    if value:
        try:
            return datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            pass
    return date.today()


async def get_weekly_report(
    db: Session, user: User, week_start: Optional[str] = None
) -> Dict[str, Any]:
    """Return a weekly sales summary. week_start should be a Monday (YYYY-MM-DD)."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    parsed = _parse_date(week_start)
    svc = SalesReportService(db)
    return await asyncio.to_thread(svc.get_weekly_report, UUID(business_id), parsed)


async def get_monthly_report(
    db: Session, user: User, year: int, month: int
) -> Dict[str, Any]:
    """Return a monthly sales summary."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = SalesReportService(db)
    return await asyncio.to_thread(svc.get_monthly_report, UUID(business_id), year, month)


async def get_product_performance(
    db: Session,
    user: User,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 10,
) -> Dict[str, Any]:
    """Return top and bottom performing products for a date range."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    start = _parse_date(start_date)
    end = _parse_date(end_date)
    svc = SalesReportService(db)
    return await asyncio.to_thread(svc.get_product_performance, UUID(business_id), start, end, limit=limit)


async def get_dashboard_kpis(db: Session, user: User) -> Dict[str, Any]:
    """Return key business KPIs from the dashboard service."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    from app.models.user_settings import AIDataSharingLevel
    from app.services.ai_service import AIService
    ai_svc = AIService(db)
    # Reuse the existing business context builder — it already has all KPIs
    return await asyncio.to_thread(ai_svc.build_business_context, user, AIDataSharingLevel.METRICS_ONLY)
