"""
backend/app/agents/tools/sales_tools.py

Tool wrappers for Sales Report Service.
"""

from typing import Any, Dict, Optional
from datetime import datetime, date
from sqlalchemy.orm import Session
from app.models.user import User
from app.services.sales_report_service import SalesReportService
from app.services.ai_service import AIService

async def get_daily_sales(db: Session, user: User, target_date: Optional[str] = None) -> Dict[str, Any]:
    """Wraps SalesReportService.get_daily_report for the agent."""
    ai_service = AIService(db)
    business = ai_service._get_business_for_user(user.id)
    if not business:
        return {"error": "No business associated with user"}

    if target_date:
        try:
            parsed_date = datetime.strptime(target_date, "%Y-%m-%d").date()
        except ValueError:
            return {"error": f"Invalid date format '{target_date}'. Use YYYY-MM-DD."}
    else:
        parsed_date = date.today()

    service = SalesReportService(db)
    report = service.get_daily_report(business.id, parsed_date)
    
    # Return serializable summary
    return report
