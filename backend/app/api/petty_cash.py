"""Petty cash API endpoints."""

import math
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.models.petty_cash import ExpenseStatus
from app.models.user import User
from app.schemas.petty_cash import (
    CategoryCreate,
    CategoryResponse,
    ExpenseCreate,
    ExpenseListResponse,
    ExpenseReport,
    ExpenseResponse,
    FundCreate,
    FundListResponse,
    FundResponse,
    FundSummary,
    RejectRequest,
    ReplenishmentResponse,
    ReplenishRequest,
)
from app.services.petty_cash_service import PettyCashService

router = APIRouter(prefix="/petty-cash", tags=["Petty Cash"])


# ---- Funds ----


@router.post("/funds", response_model=FundResponse, status_code=status.HTTP_201_CREATED)
async def create_fund(
    data: FundCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create a new petty cash fund."""
    service = PettyCashService(db)
    fund = service.create_fund(
        business_id=business_id,
        name=data.name,
        initial_amount=data.initial_amount,
        custodian_id=str(data.custodian_id) if data.custodian_id else None,
    )
    return fund


@router.get("/funds", response_model=FundListResponse)
async def list_funds(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List petty cash funds."""
    service = PettyCashService(db)
    items, total = service.list_funds(business_id, page, per_page)
    return FundListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/funds/{fund_id}", response_model=FundResponse)
async def get_fund(
    fund_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get a petty cash fund by ID."""
    service = PettyCashService(db)
    fund = service.get_fund(fund_id, business_id)
    if not fund:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fund not found")
    return fund


# ---- Categories ----


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create an expense category."""
    service = PettyCashService(db)
    category = service.create_category(
        business_id=business_id,
        name=data.name,
        description=data.description,
        gl_account_code=data.gl_account_code,
    )
    return category


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List expense categories."""
    service = PettyCashService(db)
    return service.list_categories(business_id)


# ---- Expenses ----


@router.post(
    "/funds/{fund_id}/expenses",
    response_model=ExpenseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_expense(
    fund_id: str,
    data: ExpenseCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Submit a petty cash expense."""
    service = PettyCashService(db)
    try:
        expense = service.submit_expense(
            fund_id=fund_id,
            business_id=business_id,
            user_id=str(current_user.id),
            amount=data.amount,
            description=data.description,
            category_id=str(data.category_id) if data.category_id else None,
            vendor=data.vendor,
            receipt_number=data.receipt_number,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return expense


@router.get("/funds/{fund_id}/expenses", response_model=ExpenseListResponse)
async def list_expenses(
    fund_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    expense_status: Optional[ExpenseStatus] = Query(None, alias="status"),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List expenses for a fund."""
    service = PettyCashService(db)
    items, total = service.list_expenses(fund_id, business_id, expense_status, page, per_page)
    return ExpenseListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.patch("/expenses/{expense_id}/approve", response_model=ExpenseResponse)
async def approve_expense(
    expense_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Approve a pending expense."""
    service = PettyCashService(db)
    try:
        expense = service.approve_expense(expense_id, business_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return expense


@router.patch("/expenses/{expense_id}/reject", response_model=ExpenseResponse)
async def reject_expense(
    expense_id: str,
    data: RejectRequest,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Reject a pending expense."""
    service = PettyCashService(db)
    try:
        expense = service.reject_expense(
            expense_id, business_id, str(current_user.id), data.reason
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return expense


# ---- Replenishment ----


@router.post(
    "/funds/{fund_id}/replenish",
    response_model=ReplenishmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def replenish_fund(
    fund_id: str,
    data: ReplenishRequest,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Replenish a petty cash fund."""
    service = PettyCashService(db)
    try:
        replenishment = service.replenish_fund(
            fund_id=fund_id,
            business_id=business_id,
            amount=data.amount,
            user_id=str(current_user.id),
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return replenishment


# ---- Summaries / Reports ----


@router.get("/funds/{fund_id}/summary", response_model=FundSummary)
async def get_fund_summary(
    fund_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get a fund summary with totals."""
    service = PettyCashService(db)
    try:
        summary = service.get_fund_summary(fund_id, business_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return summary


@router.get("/expense-report", response_model=ExpenseReport)
async def get_expense_report(
    date_from: datetime = Query(...),
    date_to: datetime = Query(...),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get an expense report grouped by category for a date range."""
    service = PettyCashService(db)
    report = service.get_expense_report(business_id, date_from, date_to)
    return report
