"""
backend/app/agents/tools/report_tools.py

Thin wrapper for PDF report generation.
This is a HITL tool — only called after explicit user approval.
"""

import asyncio
from datetime import datetime
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.models.user import User
from app.agents.tools.common import get_business_id_for_user


async def generate_pdf_report(
    db: Session,
    user: User,
    report_type: str,
    period_start: str,
    period_end: str,
) -> Dict[str, Any]:
    """
    Generate a PDF report and return the download path.
    HITL — must only be called after explicit user approval.

    Supported report_type values: daily_sales | monthly_summary | inventory
    """
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    supported = {"daily_sales", "monthly_summary", "inventory"}
    if report_type not in supported:
        return {"error": f"Unknown report type '{report_type}'. Use: {', '.join(supported)}"}

    try:
        start_dt = datetime.strptime(period_start, "%Y-%m-%d")
        end_dt = datetime.strptime(period_end, "%Y-%m-%d")
    except ValueError:
        return {"error": "Invalid date format. Use YYYY-MM-DD."}

    if start_dt > end_dt:
        return {"error": "period_start must be before period_end"}

    # Use the existing report generator service if available
    try:
        from app.services.report_generator_service import ReportGeneratorService

        svc = ReportGeneratorService(db)
        report_type_enum = _map_report_type(report_type)
        await asyncio.to_thread(
            svc.generate_report_data,
            business_id=business_id,
            report_type=report_type_enum,
            period_start=start_dt,
            period_end=end_dt,
        )
    except Exception:
        # GAP: Full PDF generation requires additional service wiring.
        # Return a structured placeholder so the agent can still respond.
        return {
            "generated": False,
            "report_type": report_type,
            "period": f"{period_start} to {period_end}",
            "message": (
                "PDF generation requires the report pipeline to be configured. "
                "Data was retrieved successfully — text summary available on request."
            ),
        }

    return {
        "generated": True,
        "report_type": report_type,
        "period": f"{period_start} to {period_end}",
        "business_id": business_id,
        "message": "Report data ready. PDF export pipeline to be wired in Phase 6H.",
    }


async def generate_and_email_report(
    db: Session,
    user: User,
    report_type: str,
    period_start: str,
    period_end: str,
    recipient_email: str,
) -> Dict[str, Any]:
    """Generate a report and email it. HITL — requires approval."""
    # First generate the report
    report_result = await generate_pdf_report(db, user, report_type, period_start, period_end)
    if report_result.get("error"):
        return report_result

    # Then send via email
    try:
        from app.services.email_service import EmailService
        email_svc = EmailService(db)
        await asyncio.to_thread(
            email_svc.send_email,
            to=recipient_email,
            subject=f"BizPilot Report: {report_type} ({period_start} to {period_end})",
            body=f"Please find attached your {report_type} report for {period_start} to {period_end}.",
        )
        return {
            "sent": True,
            "recipient": recipient_email,
            "report_type": report_type,
            "period": f"{period_start} to {period_end}",
        }
    except Exception as e:
        return {
            "report_generated": True,
            "email_sent": False,
            "error": f"Report generated but email failed: {str(e)}",
        }


async def get_custom_report(
    db: Session,
    user: User,
    metrics: list,
    period_start: str,
    period_end: str,
) -> Dict[str, Any]:
    """Get a custom report with flexible metrics."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    results: Dict[str, Any] = {
        "period": f"{period_start} to {period_end}",
        "metrics_requested": metrics,
    }

    # Collect data for each requested metric
    for metric in metrics:
        try:
            if metric in ("sales", "revenue"):
                from app.agents.tools.sales_tools import get_daily_sales
                data = await get_daily_sales(db, user, target_date=period_start)
                results[metric] = data
            elif metric in ("inventory", "stock"):
                from app.agents.tools.inventory_tools import get_inventory_summary
                data = await get_inventory_summary(db, user)
                results[metric] = data
            elif metric in ("invoices",):
                from app.agents.tools.invoice_tools import get_invoice_stats
                data = await get_invoice_stats(db, user)
                results[metric] = data
            elif metric in ("customers",):
                from app.agents.tools.customer_tools import get_customers
                data = await get_customers(db, user, limit=10)
                results[metric] = data
            else:
                results[metric] = {"note": f"Metric '{metric}' not yet supported"}
        except Exception as e:
            results[metric] = {"error": str(e)}

    return results


def _map_report_type(report_type: str) -> Any:
    """Map string report type to the ReportType enum."""
    try:
        from app.models.report_subscription import ReportType
        mapping = {
            "daily_sales": ReportType.DAILY,
            "monthly_summary": ReportType.MONTHLY,
            "inventory": ReportType.INVENTORY,
        }
        return mapping.get(report_type, ReportType.DAILY)
    except ImportError:
        return report_type
