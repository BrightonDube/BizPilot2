"""Supplier API endpoints."""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.core.rbac import has_permission
from app.models.user import User
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse, SupplierListResponse
from app.services.supplier_service import SupplierService

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


def _supplier_to_response(supplier) -> SupplierResponse:
    return SupplierResponse(
        id=str(supplier.id),
        business_id=str(supplier.business_id),
        name=supplier.name,
        contact_name=supplier.contact_name,
        email=supplier.email,
        phone=supplier.phone,
        tax_number=supplier.tax_number,
        website=supplier.website,
        address_line1=supplier.address_line1,
        address_line2=supplier.address_line2,
        city=supplier.city,
        state=supplier.state,
        postal_code=supplier.postal_code,
        country=supplier.country,
        notes=supplier.notes,
        tags=supplier.tags or [],
        display_name=supplier.display_name,
        full_address=supplier.full_address,
        created_at=supplier.created_at,
        updated_at=supplier.updated_at,
    )


@router.get("", response_model=SupplierListResponse)
async def list_suppliers(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    tag: Optional[str] = None,
    sort_by: str = Query("created_at", pattern="^(name|contact_name|email|created_at|updated_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    service = SupplierService(db)
    suppliers, total = service.get_suppliers(
        business_id=business_id,
        page=page,
        per_page=per_page,
        search=search,
        tag=tag,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return SupplierListResponse(
        items=[_supplier_to_response(s) for s in suppliers],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(
    supplier_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    service = SupplierService(db)
    supplier = service.get_supplier(supplier_id, business_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return _supplier_to_response(supplier)


@router.post("", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    data: SupplierCreate,
    current_user: User = Depends(has_permission("suppliers:create")),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    service = SupplierService(db)

    if data.email:
        existing = service.get_supplier_by_email(str(data.email), business_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A supplier with this email already exists",
            )

    supplier = service.create_supplier(business_id, data)
    return _supplier_to_response(supplier)


@router.put("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: str,
    data: SupplierUpdate,
    current_user: User = Depends(has_permission("suppliers:edit")),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    service = SupplierService(db)
    supplier = service.get_supplier(supplier_id, business_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    if data.email and data.email != supplier.email:
        existing = service.get_supplier_by_email(str(data.email), business_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A supplier with this email already exists",
            )

    supplier = service.update_supplier(supplier, data)
    return _supplier_to_response(supplier)


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier(
    supplier_id: str,
    current_user: User = Depends(has_permission("suppliers:delete")),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    service = SupplierService(db)
    supplier = service.get_supplier(supplier_id, business_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    service.delete_supplier(supplier)
