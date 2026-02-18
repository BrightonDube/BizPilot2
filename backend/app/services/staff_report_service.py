"""Staff report service for staff analytics and performance tracking."""

from datetime import date, datetime, timedelta
from typing import Dict, Optional
from uuid import UUID

from sqlalchemy import String, func, extract, case
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.business_user import BusinessUser, BusinessUserStatus
from app.models.time_entry import TimeEntry, TimeEntryStatus
from app.models.department import Department
from app.models.audit_log import UserAuditLog, AuditAction
from app.models.order import Order, OrderDirection


class StaffReportService:
    """Service for generating staff reports."""

    def __init__(self, db: Session):
        self.db = db

    def _parse_dates(self, start_date: date, end_date: date):
        """Convert date objects to datetime range."""
        start = datetime.combine(start_date, datetime.min.time())
        end = datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)
        return start, end

    def _get_business_staff(self, business_id) -> list:
        """Get active staff members for a business."""
        return (
            self.db.query(
                BusinessUser.user_id,
                User.first_name,
                User.last_name,
                User.email,
                BusinessUser.department_id,
            )
            .join(User, User.id == BusinessUser.user_id)
            .filter(
                BusinessUser.business_id == str(business_id),
                BusinessUser.status == BusinessUserStatus.ACTIVE,
                User.deleted_at.is_(None),
            )
            .all()
        )

    def get_performance_report(
        self, business_id: UUID, start_date: date, end_date: date
    ) -> dict:
        """Staff performance report based on attendance and time tracking."""
        start, end = self._parse_dates(start_date, end_date)

        # Get staff with their time entry summaries
        rows = (
            self.db.query(
                TimeEntry.user_id,
                User.first_name,
                User.last_name,
                User.email,
                func.coalesce(func.sum(TimeEntry.hours_worked), 0).label("total_hours"),
                func.coalesce(func.sum(TimeEntry.net_hours), 0).label("net_hours"),
                func.coalesce(func.sum(TimeEntry.break_duration), 0).label("total_breaks"),
                func.coalesce(func.sum(TimeEntry.overtime_hours), 0).label("overtime_hours"),
                func.count(TimeEntry.id).label("total_entries"),
                func.count(
                    case(
                        (TimeEntry.status == TimeEntryStatus.COMPLETED, TimeEntry.id),
                    )
                ).label("completed_entries"),
                func.min(TimeEntry.clock_in).label("first_clock_in"),
                func.max(TimeEntry.clock_out).label("last_clock_out"),
            )
            .join(User, User.id == TimeEntry.user_id)
            .filter(
                TimeEntry.business_id == str(business_id),
                TimeEntry.deleted_at.is_(None),
                TimeEntry.clock_in >= start,
                TimeEntry.clock_in < end,
            )
            .group_by(TimeEntry.user_id, User.first_name, User.last_name, User.email)
            .order_by(func.coalesce(func.sum(TimeEntry.net_hours), 0).desc())
            .all()
        )

        total_staff = len(rows)
        total_hours = 0.0
        staff_list = []

        for rank, r in enumerate(rows, 1):
            hours = round(float(r.total_hours or 0), 2)
            net = round(float(r.net_hours or 0), 2)
            overtime = round(float(r.overtime_hours or 0), 2)
            breaks = round(float(r.total_breaks or 0), 2)
            total_hours += net

            staff_name = f"{r.first_name or ''} {r.last_name or ''}".strip() or "Unknown"

            staff_list.append({
                "rank": rank,
                "user_id": str(r.user_id),
                "staff_name": staff_name,
                "email": r.email,
                "total_hours": hours,
                "net_hours": net,
                "break_hours": breaks,
                "overtime_hours": overtime,
                "total_entries": int(r.total_entries or 0),
                "completed_entries": int(r.completed_entries or 0),
                "first_clock_in": r.first_clock_in.isoformat() if r.first_clock_in else None,
                "last_clock_out": r.last_clock_out.isoformat() if r.last_clock_out else None,
            })

        avg_hours = round(total_hours / total_staff, 2) if total_staff > 0 else 0.0

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_staff": total_staff,
            "total_hours": round(total_hours, 2),
            "average_hours_per_staff": avg_hours,
            "staff": staff_list,
        }

    def get_attendance_report(
        self,
        business_id: UUID,
        start_date: date,
        end_date: date,
        user_id: Optional[str] = None,
    ) -> dict:
        """Attendance report with hours worked, breaks, overtime per staff per day."""
        start, end = self._parse_dates(start_date, end_date)

        query = (
            self.db.query(
                TimeEntry.user_id,
                User.first_name,
                User.last_name,
                func.date(TimeEntry.clock_in).label("work_date"),
                func.coalesce(func.sum(TimeEntry.hours_worked), 0).label("hours_worked"),
                func.coalesce(func.sum(TimeEntry.net_hours), 0).label("net_hours"),
                func.coalesce(func.sum(TimeEntry.break_duration), 0).label("break_duration"),
                func.coalesce(func.sum(TimeEntry.overtime_hours), 0).label("overtime_hours"),
                func.sum(
                    case(
                        (TimeEntry.is_overtime == True, 1),  # noqa: E712
                        else_=0,
                    )
                ).label("overtime_entries"),
                func.sum(
                    case(
                        (TimeEntry.is_auto_clocked_out == True, 1),  # noqa: E712
                        else_=0,
                    )
                ).label("auto_clock_outs"),
                func.min(TimeEntry.clock_in).label("first_clock_in"),
                func.max(TimeEntry.clock_out).label("last_clock_out"),
                func.count(TimeEntry.id).label("entry_count"),
            )
            .join(User, User.id == TimeEntry.user_id)
            .filter(
                TimeEntry.business_id == str(business_id),
                TimeEntry.deleted_at.is_(None),
                TimeEntry.clock_in >= start,
                TimeEntry.clock_in < end,
            )
        )

        if user_id:
            query = query.filter(TimeEntry.user_id == user_id)

        rows = (
            query
            .group_by(
                TimeEntry.user_id,
                User.first_name,
                User.last_name,
                func.date(TimeEntry.clock_in),
            )
            .order_by(
                func.date(TimeEntry.clock_in).desc(),
                User.first_name,
            )
            .all()
        )

        # Build per-user summary
        user_summaries: Dict[str, dict] = {}
        daily_records = []

        for r in rows:
            uid = str(r.user_id)
            staff_name = f"{r.first_name or ''} {r.last_name or ''}".strip() or "Unknown"
            hours = round(float(r.hours_worked or 0), 2)
            net = round(float(r.net_hours or 0), 2)
            breaks = round(float(r.break_duration or 0), 2)
            overtime = round(float(r.overtime_hours or 0), 2)

            daily_records.append({
                "user_id": uid,
                "staff_name": staff_name,
                "date": str(r.work_date),
                "hours_worked": hours,
                "net_hours": net,
                "break_duration": breaks,
                "overtime_hours": overtime,
                "overtime_entries": int(r.overtime_entries or 0),
                "auto_clock_outs": int(r.auto_clock_outs or 0),
                "first_clock_in": r.first_clock_in.isoformat() if r.first_clock_in else None,
                "last_clock_out": r.last_clock_out.isoformat() if r.last_clock_out else None,
                "entry_count": int(r.entry_count or 0),
            })

            if uid not in user_summaries:
                user_summaries[uid] = {
                    "user_id": uid,
                    "staff_name": staff_name,
                    "total_hours": 0.0,
                    "total_net_hours": 0.0,
                    "total_breaks": 0.0,
                    "total_overtime": 0.0,
                    "days_worked": 0,
                    "total_auto_clock_outs": 0,
                }

            user_summaries[uid]["total_hours"] = round(
                user_summaries[uid]["total_hours"] + hours, 2
            )
            user_summaries[uid]["total_net_hours"] = round(
                user_summaries[uid]["total_net_hours"] + net, 2
            )
            user_summaries[uid]["total_breaks"] = round(
                user_summaries[uid]["total_breaks"] + breaks, 2
            )
            user_summaries[uid]["total_overtime"] = round(
                user_summaries[uid]["total_overtime"] + overtime, 2
            )
            user_summaries[uid]["days_worked"] += 1
            user_summaries[uid]["total_auto_clock_outs"] += int(r.auto_clock_outs or 0)

        summaries = sorted(
            user_summaries.values(),
            key=lambda x: x["total_net_hours"],
            reverse=True,
        )

        total_hours = sum(s["total_net_hours"] for s in summaries)

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_staff": len(summaries),
            "total_hours": round(total_hours, 2),
            "user_summaries": summaries,
            "daily_records": daily_records,
        }

    def get_department_performance(
        self, business_id: UUID, start_date: date, end_date: date
    ) -> dict:
        """Performance report grouped by department."""
        start, end = self._parse_dates(start_date, end_date)

        rows = (
            self.db.query(
                Department.id.label("department_id"),
                Department.name.label("department_name"),
                func.count(func.distinct(BusinessUser.user_id)).label("staff_count"),
                func.coalesce(func.sum(TimeEntry.hours_worked), 0).label("total_hours"),
                func.coalesce(func.sum(TimeEntry.net_hours), 0).label("net_hours"),
                func.coalesce(func.sum(TimeEntry.overtime_hours), 0).label("overtime_hours"),
                func.count(TimeEntry.id).label("total_entries"),
            )
            .outerjoin(
                BusinessUser,
                (BusinessUser.department_id == Department.id)
                & (BusinessUser.business_id == str(business_id))
                & (BusinessUser.status == BusinessUserStatus.ACTIVE),
            )
            .outerjoin(
                TimeEntry,
                (TimeEntry.user_id == BusinessUser.user_id)
                & (TimeEntry.business_id == str(business_id))
                & (TimeEntry.deleted_at.is_(None))
                & (TimeEntry.clock_in >= start)
                & (TimeEntry.clock_in < end),
            )
            .filter(
                Department.business_id == str(business_id),
                Department.deleted_at.is_(None),
            )
            .group_by(Department.id, Department.name)
            .order_by(func.coalesce(func.sum(TimeEntry.net_hours), 0).desc())
            .all()
        )

        total_hours = 0.0
        departments = []

        for r in rows:
            net = round(float(r.net_hours or 0), 2)
            total_hours += net
            staff_count = int(r.staff_count or 0)
            avg_hours = round(net / staff_count, 2) if staff_count > 0 else 0.0

            departments.append({
                "department_id": str(r.department_id) if r.department_id else None,
                "department_name": r.department_name or "Unassigned",
                "staff_count": staff_count,
                "total_hours": round(float(r.total_hours or 0), 2),
                "net_hours": net,
                "overtime_hours": round(float(r.overtime_hours or 0), 2),
                "total_entries": int(r.total_entries or 0),
                "avg_hours_per_staff": avg_hours,
            })

        # Also get unassigned staff (no department)
        unassigned_row = (
            self.db.query(
                func.count(func.distinct(BusinessUser.user_id)).label("staff_count"),
                func.coalesce(func.sum(TimeEntry.hours_worked), 0).label("total_hours"),
                func.coalesce(func.sum(TimeEntry.net_hours), 0).label("net_hours"),
                func.coalesce(func.sum(TimeEntry.overtime_hours), 0).label("overtime_hours"),
                func.count(TimeEntry.id).label("total_entries"),
            )
            .outerjoin(
                TimeEntry,
                (TimeEntry.user_id == BusinessUser.user_id)
                & (TimeEntry.business_id == str(business_id))
                & (TimeEntry.deleted_at.is_(None))
                & (TimeEntry.clock_in >= start)
                & (TimeEntry.clock_in < end),
            )
            .filter(
                BusinessUser.business_id == str(business_id),
                BusinessUser.status == BusinessUserStatus.ACTIVE,
                BusinessUser.department_id.is_(None),
            )
            .one()
        )

        unassigned_staff = int(unassigned_row.staff_count or 0)
        if unassigned_staff > 0:
            unassigned_net = round(float(unassigned_row.net_hours or 0), 2)
            total_hours += unassigned_net
            departments.append({
                "department_id": None,
                "department_name": "Unassigned",
                "staff_count": unassigned_staff,
                "total_hours": round(float(unassigned_row.total_hours or 0), 2),
                "net_hours": unassigned_net,
                "overtime_hours": round(float(unassigned_row.overtime_hours or 0), 2),
                "total_entries": int(unassigned_row.total_entries or 0),
                "avg_hours_per_staff": round(unassigned_net / unassigned_staff, 2),
            })

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_departments": len(departments),
            "total_hours": round(total_hours, 2),
            "departments": departments,
        }

    def get_productivity_report(
        self, business_id: UUID, start_date: date, end_date: date
    ) -> dict:
        """Productivity analysis based on time entries."""
        start, end = self._parse_dates(start_date, end_date)

        # Per-staff productivity with daily breakdown
        rows = (
            self.db.query(
                TimeEntry.user_id,
                User.first_name,
                User.last_name,
                func.coalesce(func.sum(TimeEntry.hours_worked), 0).label("total_hours"),
                func.coalesce(func.sum(TimeEntry.net_hours), 0).label("net_hours"),
                func.coalesce(func.sum(TimeEntry.break_duration), 0).label("total_breaks"),
                func.coalesce(func.sum(TimeEntry.overtime_hours), 0).label("overtime_hours"),
                func.count(TimeEntry.id).label("total_entries"),
                func.count(func.distinct(func.date(TimeEntry.clock_in))).label("days_worked"),
                func.count(
                    case(
                        (TimeEntry.status == TimeEntryStatus.COMPLETED, TimeEntry.id),
                    )
                ).label("completed_entries"),
                func.count(
                    case(
                        (TimeEntry.is_auto_clocked_out == True, TimeEntry.id),  # noqa: E712
                    )
                ).label("auto_clock_outs"),
            )
            .join(User, User.id == TimeEntry.user_id)
            .filter(
                TimeEntry.business_id == str(business_id),
                TimeEntry.deleted_at.is_(None),
                TimeEntry.clock_in >= start,
                TimeEntry.clock_in < end,
            )
            .group_by(TimeEntry.user_id, User.first_name, User.last_name)
            .order_by(func.coalesce(func.sum(TimeEntry.net_hours), 0).desc())
            .all()
        )

        staff_list = []
        total_net_hours = 0.0
        total_days = 0

        for r in rows:
            net = round(float(r.net_hours or 0), 2)
            days = int(r.days_worked or 0)
            total_net_hours += net
            total_days += days

            avg_daily_hours = round(net / days, 2) if days > 0 else 0.0
            break_ratio = round(
                float(r.total_breaks or 0) / float(r.total_hours or 1) * 100, 1
            ) if float(r.total_hours or 0) > 0 else 0.0
            completion_rate = round(
                int(r.completed_entries or 0) / int(r.total_entries or 1) * 100, 1
            ) if int(r.total_entries or 0) > 0 else 0.0

            staff_name = f"{r.first_name or ''} {r.last_name or ''}".strip() or "Unknown"

            staff_list.append({
                "user_id": str(r.user_id),
                "staff_name": staff_name,
                "net_hours": net,
                "total_hours": round(float(r.total_hours or 0), 2),
                "break_hours": round(float(r.total_breaks or 0), 2),
                "overtime_hours": round(float(r.overtime_hours or 0), 2),
                "days_worked": days,
                "avg_daily_hours": avg_daily_hours,
                "break_ratio_percent": break_ratio,
                "completion_rate_percent": completion_rate,
                "total_entries": int(r.total_entries or 0),
                "auto_clock_outs": int(r.auto_clock_outs or 0),
            })

        # Hourly distribution of clock-ins
        hourly_rows = (
            self.db.query(
                extract("hour", TimeEntry.clock_in).label("hour"),
                func.count(TimeEntry.id).label("count"),
            )
            .filter(
                TimeEntry.business_id == str(business_id),
                TimeEntry.deleted_at.is_(None),
                TimeEntry.clock_in >= start,
                TimeEntry.clock_in < end,
            )
            .group_by(extract("hour", TimeEntry.clock_in))
            .order_by(extract("hour", TimeEntry.clock_in))
            .all()
        )

        hourly_distribution = [
            {"hour": int(r.hour), "clock_ins": int(r.count)}
            for r in hourly_rows
        ]

        total_staff = len(staff_list)
        avg_hours = round(total_net_hours / total_staff, 2) if total_staff > 0 else 0.0
        avg_days = round(total_days / total_staff, 1) if total_staff > 0 else 0.0

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_staff": total_staff,
            "total_net_hours": round(total_net_hours, 2),
            "average_hours_per_staff": avg_hours,
            "average_days_per_staff": avg_days,
            "staff": staff_list,
            "clock_in_distribution": hourly_distribution,
        }

    def get_commission_report(
        self,
        business_id: UUID,
        start_date: date,
        end_date: date,
        commission_rate: float = 5.0,
    ) -> dict:
        """Commission report based on sales attributed to staff via audit logs.

        Uses audit logs to link orders to staff who created them, then
        calculates commissions at the given rate.
        """
        start, end = self._parse_dates(start_date, end_date)

        # Join audit logs (CREATE order) → orders to attribute sales to staff
        rows = (
            self.db.query(
                UserAuditLog.user_id,
                User.first_name,
                User.last_name,
                User.email,
                func.count(func.distinct(Order.id)).label("order_count"),
                func.coalesce(func.sum(Order.total), 0).label("total_sales"),
                func.coalesce(func.sum(Order.discount_amount), 0).label(
                    "total_discounts"
                ),
            )
            .join(User, User.id == UserAuditLog.user_id)
            .join(
                Order,
                (func.cast(Order.id, String) == UserAuditLog.resource_id)
                & (Order.business_id == str(business_id))
                & (Order.direction == OrderDirection.OUTBOUND),
            )
            .filter(
                UserAuditLog.business_id == str(business_id),
                UserAuditLog.action == AuditAction.CREATE,
                UserAuditLog.resource_type == "order",
                UserAuditLog.created_at >= start,
                UserAuditLog.created_at < end,
                UserAuditLog.user_id.isnot(None),
            )
            .group_by(
                UserAuditLog.user_id, User.first_name, User.last_name, User.email
            )
            .order_by(func.coalesce(func.sum(Order.total), 0).desc())
            .all()
        )

        rate = commission_rate / 100.0
        staff_commissions = []
        total_commissions = 0.0
        total_sales = 0.0

        for rank, r in enumerate(rows, 1):
            sales = round(float(r.total_sales or 0), 2)
            commission = round(sales * rate, 2)
            total_commissions += commission
            total_sales += sales

            staff_name = (
                f"{r.first_name or ''} {r.last_name or ''}".strip() or "Unknown"
            )
            staff_commissions.append(
                {
                    "rank": rank,
                    "user_id": str(r.user_id),
                    "staff_name": staff_name,
                    "email": r.email,
                    "order_count": int(r.order_count or 0),
                    "total_sales": sales,
                    "total_discounts": round(float(r.total_discounts or 0), 2),
                    "commission_rate": commission_rate,
                    "commission_amount": commission,
                }
            )

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "commission_rate": commission_rate,
            "total_staff": len(staff_commissions),
            "total_sales": round(total_sales, 2),
            "total_commissions": round(total_commissions, 2),
            "staff": staff_commissions,
        }

    def get_activity_log(
        self,
        business_id: UUID,
        start_date: date,
        end_date: date,
        user_id: Optional[str] = None,
        action_type: Optional[str] = None,
        resource_type: Optional[str] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> dict:
        """Activity log report from audit trail."""
        start, end = self._parse_dates(start_date, end_date)

        query = (
            self.db.query(
                UserAuditLog.id,
                UserAuditLog.user_id,
                User.first_name,
                User.last_name,
                UserAuditLog.action,
                UserAuditLog.resource_type,
                UserAuditLog.resource_id,
                UserAuditLog.description,
                UserAuditLog.ip_address,
                UserAuditLog.created_at,
            )
            .outerjoin(User, User.id == UserAuditLog.user_id)
            .filter(
                UserAuditLog.business_id == str(business_id),
                UserAuditLog.created_at >= start,
                UserAuditLog.created_at < end,
            )
        )

        if user_id:
            query = query.filter(UserAuditLog.user_id == user_id)
        if action_type:
            try:
                action_enum = AuditAction(action_type)
                query = query.filter(UserAuditLog.action == action_enum)
            except ValueError:
                pass
        if resource_type:
            query = query.filter(UserAuditLog.resource_type == resource_type)

        total = query.count()
        rows = (
            query.order_by(UserAuditLog.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        entries = []
        for r in rows:
            staff_name = (
                f"{r.first_name or ''} {r.last_name or ''}".strip() or "System"
            )
            entries.append(
                {
                    "id": str(r.id),
                    "user_id": str(r.user_id) if r.user_id else None,
                    "staff_name": staff_name,
                    "action": r.action.value if r.action else None,
                    "resource_type": r.resource_type,
                    "resource_id": r.resource_id,
                    "description": r.description,
                    "ip_address": r.ip_address,
                    "timestamp": r.created_at.isoformat() if r.created_at else None,
                }
            )

        # Action type summary
        summary_rows = (
            self.db.query(
                UserAuditLog.action,
                func.count(UserAuditLog.id).label("count"),
            )
            .filter(
                UserAuditLog.business_id == str(business_id),
                UserAuditLog.created_at >= start,
                UserAuditLog.created_at < end,
            )
            .group_by(UserAuditLog.action)
            .all()
        )

        action_summary = {
            r.action.value: int(r.count) for r in summary_rows if r.action
        }

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page if per_page > 0 else 0,
            "action_summary": action_summary,
            "entries": entries,
        }
