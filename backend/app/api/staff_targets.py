"""Staff targets and performance API endpoints."""

from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase, ConfigDict

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.models.user import User
from app.services.staff_target_service import StaffTargetService

router = APIRouter(prefix="/staff-targets", tags=["Staff Targets"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class TargetCreate(PydanticBase):
    user_id: Optional[UUID] = None
    team_id: Optional[UUID] = None
    target_type: str
    period_type: str
    period_start: date
    period_end: date
    target_value: Decimal


class TargetUpdate(PydanticBase):
    target_value: Optional[Decimal] = None
    status: Optional[str] = None
    achieved_value: Optional[Decimal] = None


class TargetResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    business_id: UUID
    user_id: Optional[UUID] = None
    team_id: Optional[UUID] = None
    target_type: str
    period_type: str
    period_start: date
    period_end: date
    target_value: Decimal
    achieved_value: Decimal
    status: str
    created_at: Optional[str] = None


class TemplateCreate(PydanticBase):
    name: str
    role_id: Optional[UUID] = None
    target_type: str
    period_type: str
    default_value: Decimal


class TemplateResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    business_id: UUID
    name: str
    role_id: Optional[UUID] = None
    target_type: str
    period_type: str
    default_value: Decimal
    is_active: bool


class CommissionRuleCreate(PydanticBase):
    name: str
    rule_type: str
    rate: Decimal
    min_threshold: Optional[Decimal] = None
    max_threshold: Optional[Decimal] = None
    cap_amount: Optional[Decimal] = None
    product_category_id: Optional[UUID] = None
    tiers: Optional[list[dict]] = None


class CommissionRuleUpdate(PydanticBase):
    name: Optional[str] = None
    rate: Optional[Decimal] = None
    is_active: Optional[bool] = None
    cap_amount: Optional[Decimal] = None


class CommissionRuleResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    business_id: UUID
    name: str
    rule_type: str
    rate: Decimal
    min_threshold: Optional[Decimal] = None
    max_threshold: Optional[Decimal] = None
    cap_amount: Optional[Decimal] = None
    is_active: bool


class IncentiveCreate(PydanticBase):
    name: str
    description: Optional[str] = None
    incentive_type: str
    target_type: str
    target_value: Decimal
    reward_type: str
    reward_value: Decimal
    start_date: date
    end_date: date
    is_team: bool = False


class IncentiveResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    business_id: UUID
    name: str
    description: Optional[str] = None
    incentive_type: str
    target_type: str
    target_value: Decimal
    reward_type: str
    reward_value: Decimal
    start_date: date
    end_date: date
    is_team: bool
    is_active: bool


# ── Targets CRUD ─────────────────────────────────────────────────────────────


@router.post("", response_model=TargetResponse, status_code=status.HTTP_201_CREATED)
async def create_target(
    data: TargetCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a staff performance target."""
    service = StaffTargetService(db)
    target = service.create_target(
        business_id=business_id,
        user_id=str(data.user_id) if data.user_id else None,
        team_id=str(data.team_id) if data.team_id else None,
        target_type=data.target_type,
        period_type=data.period_type,
        period_start=data.period_start,
        period_end=data.period_end,
        target_value=data.target_value,
    )
    return target


@router.get("")
async def list_targets(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user_id: Optional[UUID] = None,
    target_status: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List targets with filtering."""
    service = StaffTargetService(db)
    items, total = service.list_targets(
        business_id=business_id,
        user_id=str(user_id) if user_id else None,
        status=target_status,
        page=page,
        per_page=per_page,
    )
    pages = (total + per_page - 1) // per_page
    return {"items": items, "total": total, "page": page, "per_page": per_page, "pages": pages}


@router.get("/{target_id}", response_model=TargetResponse)
async def get_target(
    target_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get target details."""
    service = StaffTargetService(db)
    target = service.get_target(str(target_id), business_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")
    return target


@router.put("/{target_id}", response_model=TargetResponse)
async def update_target(
    target_id: UUID,
    data: TargetUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update a target."""
    service = StaffTargetService(db)
    target = service.update_target(
        str(target_id),
        business_id,
        **data.model_dump(exclude_unset=True),
    )
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")
    return target


@router.delete("/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_target(
    target_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Delete a target."""
    service = StaffTargetService(db)
    if not service.delete_target(str(target_id), business_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")


@router.get("/{target_id}/progress")
async def get_target_progress(
    target_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get progress toward a target."""
    service = StaffTargetService(db)
    progress = service.get_progress(str(target_id), business_id)
    if not progress:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")
    return progress


# ── Templates ────────────────────────────────────────────────────────────────


@router.post("/templates", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: TemplateCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a target template."""
    service = StaffTargetService(db)
    tmpl = service.create_template(
        business_id=business_id,
        name=data.name,
        target_type=data.target_type,
        period_type=data.period_type,
        default_value=data.default_value,
        role_id=str(data.role_id) if data.role_id else None,
    )
    return tmpl


@router.get("/templates", response_model=list[TemplateResponse])
async def list_templates(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List target templates."""
    service = StaffTargetService(db)
    return service.list_templates(business_id)


# ── Commission Rules ─────────────────────────────────────────────────────────


@router.post("/commissions/rules", response_model=CommissionRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_commission_rule(
    data: CommissionRuleCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a commission rule."""
    service = StaffTargetService(db)
    rule = service.create_commission_rule(
        business_id=business_id,
        name=data.name,
        rule_type=data.rule_type,
        rate=data.rate,
        min_threshold=data.min_threshold,
        max_threshold=data.max_threshold,
        cap_amount=data.cap_amount,
        product_category_id=str(data.product_category_id) if data.product_category_id else None,
        tiers=data.tiers,
    )
    return rule


@router.get("/commissions/rules", response_model=list[CommissionRuleResponse])
async def list_commission_rules(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List commission rules."""
    service = StaffTargetService(db)
    return service.list_commission_rules(business_id)


@router.put("/commissions/rules/{rule_id}", response_model=CommissionRuleResponse)
async def update_commission_rule(
    rule_id: UUID,
    data: CommissionRuleUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update a commission rule."""
    service = StaffTargetService(db)
    rule = service.update_commission_rule(str(rule_id), business_id, **data.model_dump(exclude_unset=True))
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    return rule


@router.post("/commissions/calculate")
async def calculate_commission(
    user_id: UUID = Query(...),
    total_sales: Decimal = Query(...),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Calculate commission for given sales amount."""
    service = StaffTargetService(db)
    amount = service.calculate_commission(business_id, str(user_id), total_sales)
    return {"user_id": str(user_id), "total_sales": float(total_sales), "commission_amount": float(amount)}


@router.get("/commissions/report")
async def commission_report(
    period_start: date = Query(...),
    period_end: date = Query(...),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get commission report for a period."""
    service = StaffTargetService(db)
    return service.get_commission_report(business_id, period_start, period_end)


@router.get("/commissions")
async def list_staff_commissions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user_id: Optional[UUID] = None,
    commission_status: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List staff commissions."""
    service = StaffTargetService(db)
    items, total = service.list_staff_commissions(
        business_id=business_id,
        user_id=str(user_id) if user_id else None,
        status=commission_status,
        page=page,
        per_page=per_page,
    )
    pages = (total + per_page - 1) // per_page
    return {"items": items, "total": total, "page": page, "per_page": per_page, "pages": pages}


# ── Incentive Programs ───────────────────────────────────────────────────────


@router.post("/incentives", response_model=IncentiveResponse, status_code=status.HTTP_201_CREATED)
async def create_incentive(
    data: IncentiveCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create an incentive program."""
    service = StaffTargetService(db)
    prog = service.create_incentive(
        business_id=business_id,
        name=data.name,
        description=data.description,
        incentive_type=data.incentive_type,
        target_type=data.target_type,
        target_value=data.target_value,
        reward_type=data.reward_type,
        reward_value=data.reward_value,
        start_date=data.start_date,
        end_date=data.end_date,
        is_team=data.is_team,
    )
    return prog


@router.get("/incentives", response_model=list[IncentiveResponse])
async def list_incentives(
    active_only: bool = Query(True),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List incentive programs."""
    service = StaffTargetService(db)
    return service.list_incentives(business_id, active_only)


@router.get("/incentives/{incentive_id}/eligibility")
async def check_eligibility(
    incentive_id: UUID,
    user_id: UUID = Query(...),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Check staff eligibility for an incentive."""
    service = StaffTargetService(db)
    return service.check_eligibility(str(incentive_id), str(user_id), business_id)


# ── Leaderboards ─────────────────────────────────────────────────────────────


@router.get("/leaderboard")
async def get_leaderboard(
    metric: str = Query("sales"),
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get staff leaderboard by metric."""
    service = StaffTargetService(db)
    return service.get_leaderboard(
        business_id=business_id,
        metric=metric,
        period_start=period_start,
        period_end=period_end,
        limit=limit,
    )


# ── Performance ──────────────────────────────────────────────────────────────


@router.get("/performance/summary")
async def performance_summary(
    user_id: UUID = Query(...),
    period_start: date = Query(...),
    period_end: date = Query(...),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get performance summary for a staff member."""
    service = StaffTargetService(db)
    return service.get_performance_summary(business_id, str(user_id), period_start, period_end)


@router.get("/performance/trends")
async def performance_trends(
    user_id: UUID = Query(...),
    period_start: date = Query(...),
    period_end: date = Query(...),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get daily performance trends for a staff member."""
    service = StaffTargetService(db)
    return service.get_performance_trends(business_id, str(user_id), period_start, period_end)
