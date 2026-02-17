"""Expense tracking API endpoints."""

from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase, ConfigDict, Field

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.expense import ExpenseTrackingStatus
from app.models.user import User
from app.services.expense_service import ExpenseService

router = APIRouter(prefix="/expenses", tags=["Expenses"])


# ---- Schemas ----


class ExpenseCategoryCreate(PydanticBase):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    budget_limit: Optional[Decimal] = Field(None, ge=0)


class ExpenseCategoryUpdate(PydanticBase):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    budget_limit: Optional[Decimal] = Field(None, ge=0)
    is_active: Optional[bool] = None


class ExpenseCategoryResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    description: Optional[str] = None
    budget_limit: Optional[Decimal] = None
    is_active: bool


class ExpenseCreate(PydanticBase):
    amount: Decimal = Field(..., gt=0)
    description: str = Field(..., min_length=1)
    category_id: Optional[UUID] = None
    vendor: Optional[str] = Field(None, max_length=255)
    expense_date: Optional[date] = None
    payment_method: Optional[str] = Field(None, max_length=50)
    receipt_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = None


class ExpenseUpdate(PydanticBase):
    amount: Optional[Decimal] = Field(None, gt=0)
    description: Optional[str] = None
    category_id: Optional[UUID] = None
    vendor: Optional[str] = None
    expense_date: Optional[date] = None
    payment_method: Optional[str] = None
    receipt_url: Optional[str] = None
    notes: Optional[str] = None


class ExpenseResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    category_id: Optional[UUID] = None
    submitted_by: UUID
    approved_by: Optional[UUID] = None
    amount: Decimal
    description: str
    vendor: Optional[str] = None
    receipt_url: Optional[str] = None
    expense_date: date
    status: str
    payment_method: Optional[str] = None
    notes: Optional[str] = None


# ---- Category Endpoints ----


@router.post("/categories", response_model=ExpenseCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: ExpenseCategoryCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create an expense category."""
    service = ExpenseService(db)
    category = service.create_category(
        business_id=UUID(business_id),
        name=data.name,
        description=data.description,
        budget_limit=data.budget_limit,
    )
    return category


@router.get("/categories", response_model=List[ExpenseCategoryResponse])
async def list_categories(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List expense categories."""
    service = ExpenseService(db)
    return service.list_categories(UUID(business_id))


@router.put("/categories/{category_id}", response_model=ExpenseCategoryResponse)
async def update_category(
    category_id: UUID,
    data: ExpenseCategoryUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update an expense category."""
    service = ExpenseService(db)
    updates = data.model_dump(exclude_unset=True)
    category = service.update_category(category_id, UUID(business_id), **updates)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Delete an expense category."""
    service = ExpenseService(db)
    if not service.delete_category(category_id, UUID(business_id)):
        raise HTTPException(status_code=404, detail="Category not found")


# ---- Expense Endpoints ----


@router.post("/", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    data: ExpenseCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Submit a new expense."""
    service = ExpenseService(db)
    expense = service.create_expense(
        business_id=UUID(business_id),
        submitted_by=current_user.id,
        amount=data.amount,
        description=data.description,
        category_id=data.category_id,
        vendor=data.vendor,
        expense_date=data.expense_date,
        payment_method=data.payment_method,
        receipt_url=data.receipt_url,
        notes=data.notes,
    )
    return expense


@router.get("/", response_model=dict)
async def list_expenses(
    category_id: Optional[UUID] = None,
    status_filter: Optional[ExpenseTrackingStatus] = Query(None, alias="status"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List expenses with filtering and pagination."""
    service = ExpenseService(db)
    items, total = service.list_expenses(
        business_id=UUID(business_id),
        category_id=category_id,
        status=status_filter,
        start_date=start_date,
        end_date=end_date,
        page=page,
        per_page=per_page,
    )
    return {
        "items": [ExpenseResponse.model_validate(e) for e in items],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/summary")
async def expense_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get expense summary."""
    service = ExpenseService(db)
    return service.get_summary(
        business_id=UUID(business_id),
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get a single expense."""
    service = ExpenseService(db)
    expense = service.get_expense(expense_id, UUID(business_id))
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: UUID,
    data: ExpenseUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update an expense."""
    service = ExpenseService(db)
    updates = data.model_dump(exclude_unset=True)
    expense = service.update_expense(expense_id, UUID(business_id), **updates)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.patch("/{expense_id}/approve", response_model=ExpenseResponse)
async def approve_expense(
    expense_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Approve an expense."""
    service = ExpenseService(db)
    expense = service.approve_expense(expense_id, UUID(business_id), current_user.id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.patch("/{expense_id}/reject", response_model=ExpenseResponse)
async def reject_expense(
    expense_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Reject an expense."""
    service = ExpenseService(db)
    expense = service.reject_expense(expense_id, UUID(business_id))
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.patch("/{expense_id}/paid", response_model=ExpenseResponse)
async def mark_expense_paid(
    expense_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Mark an expense as paid."""
    service = ExpenseService(db)
    expense = service.mark_paid(expense_id, UUID(business_id))
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Delete an expense."""
    service = ExpenseService(db)
    if not service.delete_expense(expense_id, UUID(business_id)):
        raise HTTPException(status_code=404, detail="Expense not found")
