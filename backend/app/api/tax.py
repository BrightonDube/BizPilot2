"""Tax configuration API endpoints."""

from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase, ConfigDict

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.services.tax_service import TaxService

router = APIRouter(prefix="/tax", tags=["Tax"])


# ---- Schemas ----


class TaxRateCreate(PydanticBase):
    name: str
    rate: Decimal
    tax_type: str = "vat"
    code: Optional[str] = None
    description: Optional[str] = None
    is_default: bool = False
    is_inclusive: bool = True


class TaxRateUpdate(PydanticBase):
    name: Optional[str] = None
    rate: Optional[Decimal] = None
    tax_type: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    is_inclusive: Optional[bool] = None


class TaxRateResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    code: Optional[str] = None
    tax_type: Optional[str] = None
    rate: Decimal
    description: Optional[str] = None
    is_default: bool
    is_active: bool
    is_inclusive: bool


class TaxCalculateRequest(PydanticBase):
    amount: Decimal
    product_id: Optional[UUID] = None


class TaxCalculateResponse(PydanticBase):
    tax_amount: float
    net_amount: float
    gross_amount: float
    rates_applied: list


class AssignmentResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    tax_rate_id: UUID


# ---- Endpoints ----


@router.post("/rates", response_model=TaxRateResponse, status_code=status.HTTP_201_CREATED)
async def create_tax_rate(
    data: TaxRateCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a new tax rate."""
    service = TaxService(db)
    tax_rate = service.create_tax_rate(
        business_id=UUID(business_id),
        name=data.name,
        rate=data.rate,
        tax_type=data.tax_type,
        code=data.code,
        description=data.description,
        is_default=data.is_default,
        is_inclusive=data.is_inclusive,
    )
    return tax_rate


@router.get("/rates", response_model=List[TaxRateResponse])
async def list_tax_rates(
    include_inactive: bool = Query(False),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List tax rates for the current business."""
    service = TaxService(db)
    return service.list_tax_rates(UUID(business_id), include_inactive=include_inactive)


@router.get("/rates/{tax_rate_id}", response_model=TaxRateResponse)
async def get_tax_rate(
    tax_rate_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get a specific tax rate."""
    service = TaxService(db)
    tax_rate = service.get_tax_rate(tax_rate_id, UUID(business_id))
    if not tax_rate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax rate not found")
    return tax_rate


@router.put("/rates/{tax_rate_id}", response_model=TaxRateResponse)
async def update_tax_rate(
    tax_rate_id: UUID,
    data: TaxRateUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update a tax rate."""
    service = TaxService(db)
    updates = data.model_dump(exclude_unset=True)
    tax_rate = service.update_tax_rate(tax_rate_id, UUID(business_id), **updates)
    if not tax_rate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax rate not found")
    return tax_rate


@router.delete("/rates/{tax_rate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tax_rate(
    tax_rate_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Soft-delete a tax rate."""
    service = TaxService(db)
    if not service.delete_tax_rate(tax_rate_id, UUID(business_id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax rate not found")


# ---- Product assignments ----


@router.post("/rates/{tax_rate_id}/products/{product_id}", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def assign_to_product(
    tax_rate_id: UUID,
    product_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Assign a tax rate to a product."""
    service = TaxService(db)
    if not service.get_tax_rate(tax_rate_id, UUID(business_id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax rate not found")
    return service.assign_to_product(product_id, tax_rate_id)


@router.delete("/rates/{tax_rate_id}/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_product(
    tax_rate_id: UUID,
    product_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Remove a tax rate from a product."""
    service = TaxService(db)
    if not service.remove_from_product(product_id, tax_rate_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")


# ---- Category assignments ----


@router.post("/rates/{tax_rate_id}/categories/{category_id}", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def assign_to_category(
    tax_rate_id: UUID,
    category_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Assign a tax rate to a category."""
    service = TaxService(db)
    if not service.get_tax_rate(tax_rate_id, UUID(business_id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax rate not found")
    return service.assign_to_category(category_id, tax_rate_id)


@router.delete("/rates/{tax_rate_id}/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_category(
    tax_rate_id: UUID,
    category_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Remove a tax rate from a category."""
    service = TaxService(db)
    if not service.remove_from_category(category_id, tax_rate_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")


# ---- Product tax lookup ----


@router.get("/products/{product_id}/rates", response_model=List[TaxRateResponse])
async def get_product_tax_rates(
    product_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Get applicable tax rates for a product (product > category > default)."""
    service = TaxService(db)
    return service.get_product_tax_rates(product_id)


# ---- Tax calculation ----


@router.post("/calculate", response_model=TaxCalculateResponse)
async def calculate_tax(
    data: TaxCalculateRequest,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Calculate tax for a given amount."""
    service = TaxService(db)
    return service.calculate_tax(UUID(business_id), data.amount, data.product_id)
