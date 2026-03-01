"""Custom report builder service."""

from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import String, func
from sqlalchemy.orm import Session

from app.models.report_template import ReportTemplate
from app.models.user import User
from app.models.business_user import BusinessUser
from app.models.time_entry import TimeEntry
from app.models.audit_log import UserAuditLog, AuditAction
from app.models.order import Order, OrderDirection


# Available metrics that can be selected for custom reports
AVAILABLE_METRICS = {
    "total_sales": "Total sales amount",
    "order_count": "Number of orders",
    "discount_amount": "Total discounts given",
    "hours_worked": "Total hours worked",
    "void_count": "Number of voids",
    "refund_count": "Number of refunds",
    "avg_order_value": "Average order value",
}

AVAILABLE_GROUP_BY = ["user", "department", "day", "week", "month"]
AVAILABLE_FILTERS = ["user_id", "department_id", "date_range"]


class CustomReportService:
    """Service for building and executing custom staff reports."""

    def __init__(self, db: Session):
        self.db = db

    # ── Template CRUD ──────────────────────────────────────────────────

    def create_template(
        self,
        business_id: UUID,
        user_id: UUID,
        name: str,
        metrics: list,
        filters: dict,
        group_by: list,
        description: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_direction: str = "desc",
        is_scheduled: bool = False,
        schedule_cron: Optional[str] = None,
        schedule_recipients: Optional[list] = None,
        is_public: bool = False,
    ) -> ReportTemplate:
        template = ReportTemplate(
            business_id=business_id,
            created_by=user_id,
            name=name,
            description=description,
            metrics=metrics,
            filters=filters,
            group_by=group_by,
            sort_by=sort_by,
            sort_direction=sort_direction,
            is_scheduled=is_scheduled,
            schedule_cron=schedule_cron,
            schedule_recipients=schedule_recipients or [],
            is_public=is_public,
        )
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        return template

    def list_templates(
        self,
        business_id: UUID,
        user_id: Optional[UUID] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[dict], int]:
        query = self.db.query(ReportTemplate).filter(
            ReportTemplate.business_id == business_id,
        )
        if user_id:
            query = query.filter(
                (ReportTemplate.created_by == user_id) | (ReportTemplate.is_public.is_(True))
            )

        total = query.count()
        templates = (
            query.order_by(ReportTemplate.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        items = []
        for t in templates:
            owner_name = "Unknown"
            if t.owner:
                owner_name = f"{t.owner.first_name or ''} {t.owner.last_name or ''}".strip() or "Unknown"
            items.append({
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "report_type": t.report_type,
                "metrics": t.metrics,
                "filters": t.filters,
                "group_by": t.group_by,
                "sort_by": t.sort_by,
                "sort_direction": t.sort_direction,
                "is_scheduled": t.is_scheduled,
                "schedule_cron": t.schedule_cron,
                "schedule_recipients": t.schedule_recipients,
                "is_public": t.is_public,
                "created_by_name": owner_name,
                "created_at": t.created_at,
            })

        return items, total

    def get_template(self, business_id: UUID, template_id: UUID) -> Optional[ReportTemplate]:
        return (
            self.db.query(ReportTemplate)
            .filter(
                ReportTemplate.id == template_id,
                ReportTemplate.business_id == business_id,
            )
            .first()
        )

    def update_template(self, template: ReportTemplate, **kwargs) -> ReportTemplate:
        for key, value in kwargs.items():
            if hasattr(template, key) and value is not None:
                setattr(template, key, value)
        self.db.commit()
        self.db.refresh(template)
        return template

    def delete_template(self, template: ReportTemplate) -> None:
        self.db.delete(template)
        self.db.commit()

    # ── Report Execution ───────────────────────────────────────────────

    def execute_report(
        self,
        business_id: UUID,
        metrics: list,
        filters: dict,
        group_by: list,
        sort_by: Optional[str] = None,
        sort_direction: str = "desc",
    ) -> dict:
        """Execute a custom report with selected metrics, filters, and grouping."""
        from datetime import date, datetime, timedelta

        start_date = filters.get("start_date")
        end_date = filters.get("end_date")
        user_id = filters.get("user_id")

        if start_date:
            start_dt = datetime.combine(date.fromisoformat(start_date), datetime.min.time())
        else:
            start_dt = datetime.combine(date.today() - timedelta(days=30), datetime.min.time())
        if end_date:
            end_dt = datetime.combine(date.fromisoformat(end_date), datetime.min.time()) + timedelta(days=1)
        else:
            end_dt = datetime.combine(date.today(), datetime.min.time()) + timedelta(days=1)

        # Build metric flags
        metric_cols = {}

        if "total_sales" in metrics or "avg_order_value" in metrics or "order_count" in metrics:
            # Need to join orders via audit logs
            metric_cols["_needs_orders"] = True
        if "hours_worked" in metrics:
            metric_cols["_needs_time"] = True
        if "void_count" in metrics or "refund_count" in metrics:
            metric_cols["_needs_audit"] = True

        results = []

        # Get staff for this business
        staff_query = (
            self.db.query(User.id, User.first_name, User.last_name, User.email)
            .join(BusinessUser, BusinessUser.user_id == User.id)
            .filter(BusinessUser.business_id == str(business_id))
        )
        if user_id:
            staff_query = staff_query.filter(User.id == user_id)
        staff_rows = staff_query.all()

        for staff in staff_rows:
            row = {
                "user_id": str(staff.id),
                "staff_name": f"{staff.first_name or ''} {staff.last_name or ''}".strip() or "Unknown",
                "email": staff.email,
            }

            if "total_sales" in metrics or "order_count" in metrics or "avg_order_value" in metrics or "discount_amount" in metrics:
                order_data = (
                    self.db.query(
                        func.count(func.distinct(Order.id)).label("order_count"),
                        func.coalesce(func.sum(Order.total), 0).label("total_sales"),
                        func.coalesce(func.sum(Order.discount_amount), 0).label("discount_amount"),
                    )
                    .join(
                        UserAuditLog,
                        (func.cast(Order.id, String) == UserAuditLog.resource_id)
                        & (UserAuditLog.user_id == staff.id)
                        & (UserAuditLog.action == AuditAction.CREATE)
                        & (UserAuditLog.resource_type == "order"),
                    )
                    .filter(
                        Order.business_id == str(business_id),
                        Order.direction == OrderDirection.OUTBOUND,
                        UserAuditLog.created_at >= start_dt,
                        UserAuditLog.created_at < end_dt,
                    )
                    .first()
                )
                if "total_sales" in metrics:
                    row["total_sales"] = round(float(order_data.total_sales or 0), 2)
                if "order_count" in metrics:
                    row["order_count"] = int(order_data.order_count or 0)
                if "avg_order_value" in metrics:
                    cnt = int(order_data.order_count or 0)
                    total = float(order_data.total_sales or 0)
                    row["avg_order_value"] = round(total / cnt, 2) if cnt > 0 else 0
                if "discount_amount" in metrics:
                    row["discount_amount"] = round(float(order_data.discount_amount or 0), 2)

            if "hours_worked" in metrics:
                hours = (
                    self.db.query(
                        func.coalesce(
                            func.sum(func.extract("epoch", TimeEntry.clock_out - TimeEntry.clock_in) / 3600),
                            0,
                        ).label("hours")
                    )
                    .filter(
                        TimeEntry.business_id == str(business_id),
                        TimeEntry.user_id == staff.id,
                        TimeEntry.clock_in >= start_dt,
                        TimeEntry.clock_in < end_dt,
                        TimeEntry.clock_out.isnot(None),
                    )
                    .scalar()
                )
                row["hours_worked"] = round(float(hours or 0), 2)

            if "void_count" in metrics:
                void_count = (
                    self.db.query(func.count(UserAuditLog.id))
                    .filter(
                        UserAuditLog.business_id == str(business_id),
                        UserAuditLog.user_id == staff.id,
                        UserAuditLog.action == AuditAction.VOID,
                        UserAuditLog.created_at >= start_dt,
                        UserAuditLog.created_at < end_dt,
                    )
                    .scalar()
                )
                row["void_count"] = int(void_count or 0)

            if "refund_count" in metrics:
                refund_count = (
                    self.db.query(func.count(UserAuditLog.id))
                    .filter(
                        UserAuditLog.business_id == str(business_id),
                        UserAuditLog.user_id == staff.id,
                        UserAuditLog.action == AuditAction.REFUND,
                        UserAuditLog.created_at >= start_dt,
                        UserAuditLog.created_at < end_dt,
                    )
                    .scalar()
                )
                row["refund_count"] = int(refund_count or 0)

            results.append(row)

        # Sort
        if sort_by and results and sort_by in results[0]:
            reverse = sort_direction != "asc"
            results.sort(key=lambda x: x.get(sort_by, 0), reverse=reverse)

        return {
            "metrics": metrics,
            "filters": filters,
            "group_by": group_by,
            "total_staff": len(results),
            "data": results,
        }
