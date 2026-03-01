"""Commission approval workflow service."""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.commission import CommissionRecord, CommissionStatus
from app.models.user import User


class CommissionService:
    """Manages commission record generation, approval, and payroll export."""

    def __init__(self, db: Session):
        self.db = db

    def generate_records(
        self,
        business_id: UUID,
        period_start: date,
        period_end: date,
        commission_rate: float,
        staff_data: list[dict],
    ) -> list[CommissionRecord]:
        """Create commission records from computed staff sales data.

        `staff_data` is the `staff` list from StaffReportService.get_commission_report().
        """
        records = []
        for item in staff_data:
            record = CommissionRecord(
                business_id=business_id,
                user_id=item["user_id"],
                period_start=period_start,
                period_end=period_end,
                order_count=item.get("order_count", 0),
                total_sales=Decimal(str(item.get("total_sales", 0))),
                total_discounts=Decimal(str(item.get("total_discounts", 0))),
                commission_rate=Decimal(str(commission_rate)),
                commission_amount=Decimal(str(item.get("commission_amount", 0))),
                status=CommissionStatus.PENDING,
            )
            self.db.add(record)
            records.append(record)

        self.db.commit()
        for r in records:
            self.db.refresh(r)
        return records

    def list_records(
        self,
        business_id: UUID,
        status: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[list[dict], int]:
        """List commission records with staff names."""
        query = (
            self.db.query(CommissionRecord)
            .filter(CommissionRecord.business_id == business_id)
        )
        if status:
            query = query.filter(CommissionRecord.status == status)

        total = query.count()
        records = (
            query.order_by(CommissionRecord.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        items = []
        for r in records:
            staff_name = "Unknown"
            email = None
            if r.staff:
                staff_name = f"{r.staff.first_name or ''} {r.staff.last_name or ''}".strip() or "Unknown"
                email = r.staff.email

            approved_by_name = None
            if r.approver:
                approved_by_name = f"{r.approver.first_name or ''} {r.approver.last_name or ''}".strip()

            items.append({
                "id": r.id,
                "business_id": r.business_id,
                "user_id": r.user_id,
                "staff_name": staff_name,
                "email": email,
                "period_start": r.period_start,
                "period_end": r.period_end,
                "order_count": int(r.order_count or 0),
                "total_sales": float(r.total_sales or 0),
                "total_discounts": float(r.total_discounts or 0),
                "commission_rate": float(r.commission_rate),
                "commission_amount": float(r.commission_amount),
                "status": r.status.value if isinstance(r.status, CommissionStatus) else r.status,
                "approved_by_name": approved_by_name,
                "approved_at": r.approved_at,
                "rejection_reason": r.rejection_reason,
                "notes": r.notes,
                "created_at": r.created_at,
            })

        return items, total

    def approve_records(
        self,
        business_id: UUID,
        record_ids: List[UUID],
        approver_id: UUID,
    ) -> int:
        """Approve pending commission records."""
        now = datetime.now(timezone.utc)
        count = (
            self.db.query(CommissionRecord)
            .filter(
                CommissionRecord.id.in_(record_ids),
                CommissionRecord.business_id == business_id,
                CommissionRecord.status == CommissionStatus.PENDING,
            )
            .update(
                {
                    CommissionRecord.status: CommissionStatus.APPROVED,
                    CommissionRecord.approved_by: approver_id,
                    CommissionRecord.approved_at: now,
                },
                synchronize_session="fetch",
            )
        )
        self.db.commit()
        return count

    def reject_records(
        self,
        business_id: UUID,
        record_ids: List[UUID],
        approver_id: UUID,
        reason: Optional[str] = None,
    ) -> int:
        """Reject pending commission records."""
        now = datetime.now(timezone.utc)
        count = (
            self.db.query(CommissionRecord)
            .filter(
                CommissionRecord.id.in_(record_ids),
                CommissionRecord.business_id == business_id,
                CommissionRecord.status == CommissionStatus.PENDING,
            )
            .update(
                {
                    CommissionRecord.status: CommissionStatus.REJECTED,
                    CommissionRecord.approved_by: approver_id,
                    CommissionRecord.approved_at: now,
                    CommissionRecord.rejection_reason: reason,
                },
                synchronize_session="fetch",
            )
        )
        self.db.commit()
        return count

    def get_payroll_export(
        self,
        business_id: UUID,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None,
    ) -> list[dict]:
        """Get approved commissions grouped by staff for payroll export."""
        query = (
            self.db.query(
                CommissionRecord.user_id,
                User.first_name,
                User.last_name,
                User.email,
                func.sum(CommissionRecord.commission_amount).label("total_commission"),
                func.sum(CommissionRecord.total_sales).label("total_sales"),
                func.sum(CommissionRecord.order_count).label("total_orders"),
            )
            .join(User, User.id == CommissionRecord.user_id)
            .filter(
                CommissionRecord.business_id == business_id,
                CommissionRecord.status == CommissionStatus.APPROVED,
            )
        )
        if period_start:
            query = query.filter(CommissionRecord.period_start >= period_start)
        if period_end:
            query = query.filter(CommissionRecord.period_end <= period_end)

        rows = (
            query.group_by(
                CommissionRecord.user_id, User.first_name, User.last_name, User.email
            )
            .order_by(func.sum(CommissionRecord.commission_amount).desc())
            .all()
        )

        return [
            {
                "user_id": str(r.user_id),
                "staff_name": f"{r.first_name or ''} {r.last_name or ''}".strip() or "Unknown",
                "email": r.email,
                "total_commission": float(r.total_commission or 0),
                "total_sales": float(r.total_sales or 0),
                "total_orders": int(r.total_orders or 0),
            }
            for r in rows
        ]
