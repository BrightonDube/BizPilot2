"""Pydantic schemas for commission approval workflow."""

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CommissionGenerateRequest(BaseModel):
    """Request to generate commission records for a period."""

    period_start: date
    period_end: date
    commission_rate: float = Field(5.0, ge=0, le=100)


class CommissionApproveRequest(BaseModel):
    """Request to approve or reject commission records."""

    record_ids: List[UUID]
    action: str = Field(..., pattern="^(approve|reject)$")
    rejection_reason: Optional[str] = None


class CommissionRecordResponse(BaseModel):
    """Single commission record response."""

    id: UUID
    business_id: UUID
    user_id: UUID
    staff_name: str
    email: Optional[str] = None
    period_start: date
    period_end: date
    order_count: int
    total_sales: float
    total_discounts: float
    commission_rate: float
    commission_amount: float
    status: str
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


class CommissionListResponse(BaseModel):
    """List of commission records."""

    items: List[CommissionRecordResponse]
    total: int
    total_commission: float
    total_sales: float


class CommissionApproveResponse(BaseModel):
    """Response after approving/rejecting commissions."""

    updated_count: int
    action: str
