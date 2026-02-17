"""CRM API endpoints."""

import math
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase, ConfigDict, Field

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.models.crm import InteractionType
from app.models.user import User
from app.services.crm_service import CrmService

router = APIRouter(prefix="/crm", tags=["CRM"])


# ---------- Schemas ----------


class SegmentCreate(PydanticBase):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    color: Optional[str] = Field(None, max_length=20)


class SegmentResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    business_id: str
    name: str
    description: Optional[str] = None
    color: str
    is_auto: bool
    created_at: datetime
    updated_at: datetime


class SegmentWithCountResponse(PydanticBase):
    segment: SegmentResponse
    member_count: int


class SegmentMemberAdd(PydanticBase):
    customer_id: str


class SegmentMemberResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    segment_id: str
    customer_id: str
    created_at: datetime


class SegmentMemberListResponse(PydanticBase):
    items: list[SegmentMemberResponse]
    total: int
    page: int
    per_page: int
    pages: int


class InteractionCreate(PydanticBase):
    customer_id: str
    interaction_type: InteractionType
    subject: str = Field(..., max_length=255)
    content: Optional[str] = None
    follow_up_date: Optional[datetime] = None


class InteractionResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    customer_id: str
    business_id: str
    user_id: Optional[str] = None
    interaction_type: str
    subject: str
    content: Optional[str] = None
    follow_up_date: Optional[datetime] = None
    is_completed: bool
    created_at: datetime
    updated_at: datetime


class InteractionListResponse(PydanticBase):
    items: list[InteractionResponse]
    total: int
    page: int
    per_page: int
    pages: int


class MetricsResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    customer_id: str
    business_id: str
    total_orders: int
    total_spent: Decimal
    average_order_value: Decimal
    last_order_date: Optional[datetime] = None
    first_order_date: Optional[datetime] = None
    days_since_last_order: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class TopCustomerResponse(PydanticBase):
    customer_id: str
    total_orders: int
    total_spent: Decimal
    average_order_value: Decimal
    last_order_date: Optional[datetime] = None
    days_since_last_order: Optional[int] = None


class AtRiskCustomerResponse(PydanticBase):
    customer_id: str
    total_orders: int
    total_spent: Decimal
    days_since_last_order: int
    last_order_date: Optional[datetime] = None


# ---------- Helpers ----------


def _str_id(obj):
    """Ensure UUID fields are serialised as strings."""
    data = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    for key in (
        "id",
        "business_id",
        "customer_id",
        "segment_id",
        "user_id",
    ):
        if key in data and data[key] is not None:
            data[key] = str(data[key])
    if "interaction_type" in data and data["interaction_type"] is not None:
        data["interaction_type"] = (
            data["interaction_type"].value
            if hasattr(data["interaction_type"], "value")
            else str(data["interaction_type"])
        )
    return data


# ---------- Segment endpoints ----------


@router.post(
    "/segments",
    response_model=SegmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_segment(
    body: SegmentCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a customer segment."""
    service = CrmService(db)
    segment = service.create_segment(
        business_id=business_id,
        name=body.name,
        description=body.description,
        color=body.color,
    )
    return SegmentResponse(**_str_id(segment))


@router.get("/segments", response_model=list[SegmentWithCountResponse])
async def list_segments(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List customer segments with member counts."""
    service = CrmService(db)
    results = service.list_segments(business_id)
    return [
        SegmentWithCountResponse(
            segment=SegmentResponse(**_str_id(r["segment"])),
            member_count=r["member_count"],
        )
        for r in results
    ]


@router.post(
    "/segments/{segment_id}/members",
    response_model=SegmentMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_segment_member(
    segment_id: str,
    body: SegmentMemberAdd,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Add a customer to a segment."""
    service = CrmService(db)
    member = service.add_to_segment(segment_id, body.customer_id)
    return SegmentMemberResponse(**_str_id(member))


@router.delete(
    "/segments/{segment_id}/members/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_segment_member(
    segment_id: str,
    customer_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Remove a customer from a segment."""
    service = CrmService(db)
    removed = service.remove_from_segment(segment_id, customer_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Member not found")


@router.get(
    "/segments/{segment_id}/members",
    response_model=SegmentMemberListResponse,
)
async def get_segment_members(
    segment_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get members of a segment."""
    service = CrmService(db)
    items, total = service.get_segment_members(
        segment_id, business_id, page, per_page
    )
    return SegmentMemberListResponse(
        items=[SegmentMemberResponse(**_str_id(m)) for m in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


# ---------- Interaction endpoints ----------


@router.post(
    "/interactions",
    response_model=InteractionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def log_interaction(
    body: InteractionCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Log a customer interaction."""
    service = CrmService(db)
    interaction = service.log_interaction(
        customer_id=body.customer_id,
        business_id=business_id,
        user_id=str(current_user.id),
        interaction_type=body.interaction_type,
        subject=body.subject,
        content=body.content,
        follow_up_date=body.follow_up_date,
    )
    return InteractionResponse(**_str_id(interaction))


@router.get(
    "/customers/{customer_id}/interactions",
    response_model=InteractionListResponse,
)
async def get_interactions(
    customer_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get interaction history for a customer."""
    service = CrmService(db)
    items, total = service.get_interactions(
        customer_id, business_id, page, per_page
    )
    return InteractionListResponse(
        items=[InteractionResponse(**_str_id(i)) for i in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/follow-ups", response_model=list[InteractionResponse])
async def get_follow_ups(
    user_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get pending follow-ups."""
    service = CrmService(db)
    items = service.get_follow_ups(business_id, user_id=user_id)
    return [InteractionResponse(**_str_id(i)) for i in items]


@router.patch(
    "/interactions/{interaction_id}/complete",
    response_model=InteractionResponse,
)
async def complete_follow_up(
    interaction_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Mark a follow-up interaction as completed."""
    service = CrmService(db)
    interaction = service.complete_follow_up(interaction_id, business_id)
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return InteractionResponse(**_str_id(interaction))


# ---------- Metrics endpoints ----------


@router.get(
    "/customers/{customer_id}/metrics", response_model=MetricsResponse
)
async def get_customer_metrics(
    customer_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get pre-computed metrics for a customer."""
    service = CrmService(db)
    metrics = service.get_customer_metrics(customer_id, business_id)
    if not metrics:
        raise HTTPException(status_code=404, detail="Metrics not found")
    return MetricsResponse(**_str_id(metrics))


@router.post(
    "/customers/{customer_id}/metrics/refresh",
    response_model=MetricsResponse,
)
async def refresh_customer_metrics(
    customer_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Recalculate metrics for a customer from orders."""
    service = CrmService(db)
    metrics = service.update_customer_metrics(customer_id, business_id)
    return MetricsResponse(**_str_id(metrics))


@router.get("/top-customers", response_model=list[TopCustomerResponse])
async def get_top_customers(
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get top customers by total spent."""
    service = CrmService(db)
    items = service.get_top_customers(business_id, limit=limit)
    return [
        TopCustomerResponse(
            customer_id=str(m.customer_id),
            total_orders=m.total_orders,
            total_spent=m.total_spent,
            average_order_value=m.average_order_value,
            last_order_date=m.last_order_date,
            days_since_last_order=m.days_since_last_order,
        )
        for m in items
    ]


@router.get("/at-risk-customers", response_model=list[AtRiskCustomerResponse])
async def get_at_risk_customers(
    days_threshold: int = Query(90, ge=1),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get customers who haven't ordered in X days."""
    service = CrmService(db)
    items = service.get_at_risk_customers(
        business_id, days_threshold=days_threshold
    )
    return [
        AtRiskCustomerResponse(
            customer_id=str(m.customer_id),
            total_orders=m.total_orders,
            total_spent=m.total_spent,
            days_since_last_order=m.days_since_last_order,
            last_order_date=m.last_order_date,
        )
        for m in items
    ]
