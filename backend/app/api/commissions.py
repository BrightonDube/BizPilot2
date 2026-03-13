"""
Commissions API — endpoints for managing staff commission records.

Exposes the CommissionService for generating, listing, approving/rejecting
commission records, and exporting for payroll integration.

Why a separate commissions API?
Commission management is a distinct workflow: generate from sales data,
review, approve/reject, then export to payroll. Keeping it separate from
the staff or sales APIs makes each module's responsibility clear.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.services.commission_service import CommissionService

router = APIRouter(prefix="/commissions", tags=["Commissions"])


# ------------------------------------------------------------------
# Schemas
# ------------------------------------------------------------------

class CommissionRecordResponse(BaseModel):
    """Response schema for a single commission record."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    user_id: UUID
    period_start: str
    period_end: str
    commission_amount: float
    status: str
    created_at: str


class CommissionListResponse(BaseModel):
    """Paginated list of commission records."""
    items: list
    total: int
    page: int
    per_page: int


class GenerateCommissionsRequest(BaseModel):
    """Request to generate commission records for a date range."""
    period_start: str
    period_end: str


class ApproveRejectRequest(BaseModel):
    """Request to approve or reject commission records."""
    record_ids: list[UUID]
    reason: Optional[str] = None


class PayrollExportResponse(BaseModel):
    """Payroll export grouped by staff member."""
    items: list
    total_amount: float
    period_start: str
    period_end: str


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------

@router.get("", response_model=CommissionListResponse)
async def list_commissions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    user_id: Optional[UUID] = None,
    business_id: UUID = Depends(get_current_business_id),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
):
    """
    List commission records with optional filtering.
    Supports filtering by status (pending/approved/rejected) and staff member.
    """
    service = CommissionService(db)
    items, total = service.list_records(
        business_id=business_id,
        status=status,
        user_id=user_id,
        page=page,
        per_page=per_page,
    )
    return CommissionListResponse(
        items=items, total=total, page=page, per_page=per_page,
    )


@router.post("/generate")
async def generate_commissions(
    body: GenerateCommissionsRequest,
    business_id: UUID = Depends(get_current_business_id),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
):
    """
    Generate commission records from sales data for a date range.
    Creates pending records for each staff member with qualifying sales.
    """
    service = CommissionService(db)
    records = service.generate_records(
        business_id=business_id,
        period_start=body.period_start,
        period_end=body.period_end,
    )
    return {"message": "Commission records generated", "count": len(records)}


@router.post("/approve")
async def approve_commissions(
    body: ApproveRejectRequest,
    business_id: UUID = Depends(get_current_business_id),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
):
    """
    Approve pending commission records.
    Approved records become eligible for payroll export.
    """
    service = CommissionService(db)
    count = service.approve_records(record_ids=body.record_ids)
    return {"message": f"Approved {count} commission records"}


@router.post("/reject")
async def reject_commissions(
    body: ApproveRejectRequest,
    business_id: UUID = Depends(get_current_business_id),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
):
    """
    Reject pending commission records with an optional reason.
    Rejected records are excluded from payroll export.
    """
    service = CommissionService(db)
    count = service.reject_records(
        record_ids=body.record_ids,
        reason=body.reason,
    )
    return {"message": f"Rejected {count} commission records"}


@router.get("/payroll-export", response_model=PayrollExportResponse)
async def get_payroll_export(
    period_start: str = Query(...),
    period_end: str = Query(...),
    business_id: UUID = Depends(get_current_business_id),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
):
    """
    Export approved commissions grouped by staff for payroll integration.
    Only includes approved records within the specified date range.
    """
    service = CommissionService(db)
    export = service.get_payroll_export(
        business_id=business_id,
        period_start=period_start,
        period_end=period_end,
    )
    return PayrollExportResponse(
        items=export.get("items", []),
        total_amount=export.get("total_amount", 0),
        period_start=period_start,
        period_end=period_end,
    )
