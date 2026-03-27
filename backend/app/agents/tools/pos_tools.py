"""
backend/app/agents/tools/pos_tools.py

Tool wrappers for POS — cash registers, cashups, shifts.
"""

import asyncio
from datetime import date, datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.agents.tools.common import get_business_id_for_user


async def get_register_status(
    db: Session, user: User, register_id: Optional[str] = None
) -> Dict[str, Any]:
    """Get cash register status and active session info."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.cash_register_service import CashRegisterService

        svc = CashRegisterService(db)

        if register_id:
            session = await asyncio.to_thread(
                svc.get_active_session,
                register_id=register_id,
                business_id=business_id,
            )
            if not session:
                return {"register_id": register_id, "status": "no_active_session"}
            return {
                "register_id": register_id,
                "status": "active",
                "opened_at": str(session.opened_at) if session.opened_at else None,
                "opening_float": float(session.opening_float or 0),
            }
        else:
            # List all registers
            registers = await asyncio.to_thread(
                svc.list_registers, business_id=business_id
            )
            return {
                "total": len(registers),
                "registers": [
                    {
                        "id": str(r.id),
                        "name": r.name,
                        "is_active": r.is_active,
                    }
                    for r in registers
                ],
            }
    except Exception as e:
        return {"error": f"Failed to get register status: {str(e)}"}


async def get_cashup_summary(
    db: Session,
    user: User,
    target_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Get cashup summary for a date."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.cashup_service import CashupService

        svc = CashupService(db)
        dt = datetime.strptime(target_date, "%Y-%m-%d").date() if target_date else date.today()

        summary = await asyncio.to_thread(
            svc.get_daily_summary, business_id=business_id, target_date=dt
        )
        return summary
    except Exception as e:
        return {"error": f"Failed to get cashup summary: {str(e)}"}


async def get_shift_summary(
    db: Session,
    user: User,
    week_start: Optional[str] = None,
) -> Dict[str, Any]:
    """Get shift schedule for a week."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.shift_service import ShiftService

        svc = ShiftService(db)
        start = datetime.strptime(week_start, "%Y-%m-%d").date() if week_start else date.today()

        schedule = await asyncio.to_thread(
            svc.get_schedule, business_id=business_id, week_start_date=start
        )
        # Convert schedule to serializable format
        result = {}
        for day, shifts in schedule.items():
            result[day] = [
                {
                    "id": str(s.id),
                    "user_id": str(s.user_id),
                    "start_time": str(s.start_time),
                    "end_time": str(s.end_time),
                    "status": s.status,
                }
                for s in shifts
            ]
        return {"week_start": str(start), "schedule": result}
    except Exception as e:
        return {"error": f"Failed to get shift summary: {str(e)}"}
