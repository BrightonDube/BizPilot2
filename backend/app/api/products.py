"""Product API endpoints."""

import math
from typing import Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_business_id
from app.core.rbac import has_permission
from app.models.user import User
from app.models.product import Product, ProductStatus
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    ProductBulkCreate,
    ProductBulkDelete,
)
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["Products"])


def _product_to_response(product: Product) -> ProductResponse:
    """Convert a Product model to ProductResponse schema."""
    return ProductResponse(
        id=str(product.id),
        business_id=str(product.business_id),
        name=product.name,
        description=product.description,
        sku=product.sku,
        barcode=product.barcode,
        cost_price=product.cost_price,
        selling_price=product.selling_price,
        compare_at_price=product.compare_at_price,
        is_taxable=product.is_taxable,
        tax_rate=product.tax_rate,
        track_inventory=product.track_inventory,
        quantity=product.quantity,
        low_stock_threshold=product.low_stock_threshold,
        status=product.status,
        image_url=product.image_url,
        category_id=str(product.category_id) if product.category_id else None,
        is_low_stock=product.is_low_stock,
        profit_margin=product.profit_margin,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


@router.get("", response_model=ProductListResponse)
async def list_products(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    status: Optional[ProductStatus] = None,
    min_price: Optional[Decimal] = None,
    max_price: Optional[Decimal] = None,
    low_stock_only: bool = False,
    sort_by: str = Query("created_at", pattern="^(name|selling_price|quantity|created_at|updated_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(has_permission("products:view")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """
    List products with filtering and pagination.
    """
    service = ProductService(db)
    products, total = service.get_products(
        business_id=business_id,
        page=page,
        per_page=per_page,
        search=search,
        category_id=category_id,
        status=status,
        min_price=min_price,
        max_price=max_price,
        low_stock_only=low_stock_only,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    
    return ProductListResponse(
        items=[_product_to_response(p) for p in products],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    current_user: User = Depends(has_permission("products:view")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get a product by ID."""
    service = ProductService(db)
    product = service.get_product(product_id, business_id)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    
    return _product_to_response(product)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    current_user: User = Depends(has_permission("products:create")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Create a new product."""
    service = ProductService(db)
    product = service.create_product(business_id, data)
    
    return _product_to_response(product)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    data: ProductUpdate,
    current_user: User = Depends(has_permission("products:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Update a product."""
    service = ProductService(db)
    product = service.get_product(product_id, business_id)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    
    product = service.update_product(product, data)
    
    return _product_to_response(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: str,
    current_user: User = Depends(has_permission("products:delete")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Delete a product."""
    service = ProductService(db)
    product = service.get_product(product_id, business_id)
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    
    service.delete_product(product)


@router.post("/bulk", response_model=list[ProductResponse], status_code=status.HTTP_201_CREATED)
async def bulk_create_products(
    data: ProductBulkCreate,
    current_user: User = Depends(has_permission("products:create")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Create multiple products at once."""
    service = ProductService(db)
    products = service.bulk_create_products(business_id, data.products)
    
    return [_product_to_response(p) for p in products]


@router.post("/bulk-delete")
async def bulk_delete_products(
    data: ProductBulkDelete,
    current_user: User = Depends(has_permission("products:delete")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Delete multiple products at once."""
    service = ProductService(db)
    deleted_count = service.bulk_delete_products(business_id, data.product_ids)
    
    return {"deleted": deleted_count}
