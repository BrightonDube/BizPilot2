"""Supplier API endpoints."""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.database import get_sync_db
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    service = SupplierService(db)
    supplier = service.get_supplier(supplier_id, business_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    service.delete_supplier(supplier)


@router.get("/{supplier_id}/products")
async def get_supplier_products(
    supplier_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get all products linked to a supplier."""
    from app.models.product_supplier import ProductSupplier
    from app.models.product import Product
    
    service = SupplierService(db)
    supplier = service.get_supplier(supplier_id, business_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    
    # Get product IDs linked to this supplier
    product_links = db.query(ProductSupplier).filter(
        ProductSupplier.supplier_id == supplier.id,
        ProductSupplier.deleted_at.is_(None),
    ).all()
    
    product_ids = [link.product_id for link in product_links]
    
    if not product_ids:
        return []
    
    products = db.query(Product).filter(
        Product.id.in_(product_ids),
        Product.deleted_at.is_(None),
    ).all()
    
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "sku": p.sku,
            "selling_price": float(p.selling_price) if p.selling_price else 0,
            "cost_price": float(p.cost_price) if p.cost_price else None,
            "quantity": p.quantity,
        }
        for p in products
    ]


@router.post("/{supplier_id}/products/{product_id}", status_code=status.HTTP_201_CREATED)
async def link_supplier_product(
    supplier_id: str,
    product_id: str,
    current_user: User = Depends(has_permission("suppliers:edit")),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Link a supplier to a product."""
    from app.models.product_supplier import ProductSupplier
    from app.models.product import Product
    
    service = SupplierService(db)
    supplier = service.get_supplier(supplier_id, business_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    
    # Check product exists
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.business_id == business_id,
        Product.deleted_at.is_(None),
    ).first()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    
    # Check if link already exists
    existing = db.query(ProductSupplier).filter(
        ProductSupplier.product_id == product.id,
        ProductSupplier.supplier_id == supplier.id,
        ProductSupplier.deleted_at.is_(None),
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product is already linked to this supplier",
        )
    
    # Create the link
    link = ProductSupplier(
        product_id=product.id,
        supplier_id=supplier.id,
    )
    db.add(link)
    db.commit()
    
    return {
        "message": f"Supplier '{supplier.name}' linked to product '{product.name}'",
        "product_id": str(product.id),
        "supplier_id": str(supplier.id),
    }
