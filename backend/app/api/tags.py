"""API endpoints for product tagging and categorization.

Provides CRUD for tag categories, tags, and product-tag associations,
all scoped to the current business.
"""

import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.schemas.tag import (
    TagCategoryCreate,
    TagCategoryUpdate,
    TagCategoryResponse,
    TagCategoryListResponse,
    TagCreate,
    TagUpdate,
    TagResponse,
    TagListResponse,
    ProductTagCreate,
    ProductTagResponse,
    ProductTagListResponse,
)
from app.services.tag_service import TagService

router = APIRouter(prefix="/tags", tags=["Tags & Categorization"])


# ---------------------------------------------------------------------------
# Tag Categories
# ---------------------------------------------------------------------------


@router.get("/categories", response_model=TagCategoryListResponse)
def list_tag_categories(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List tag categories for the current business."""
    svc = TagService(db)
    items, total = svc.list_categories(business_id, page=page, per_page=per_page)
    return TagCategoryListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/categories", response_model=TagCategoryResponse, status_code=201)
def create_tag_category(
    payload: TagCategoryCreate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Create a new tag category."""
    svc = TagService(db)
    return svc.create_category(
        business_id,
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        color=payload.color,
        icon=payload.icon,
        sort_order=payload.sort_order,
    )


@router.get("/categories/{category_id}", response_model=TagCategoryResponse)
def get_tag_category(
    category_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get a single tag category."""
    svc = TagService(db)
    cat = svc.get_category(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Tag category not found")
    return cat


@router.patch("/categories/{category_id}", response_model=TagCategoryResponse)
def update_tag_category(
    category_id: UUID,
    payload: TagCategoryUpdate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update a tag category."""
    svc = TagService(db)
    cat = svc.update_category(category_id, **payload.model_dump(exclude_unset=True))
    if not cat:
        raise HTTPException(status_code=404, detail="Tag category not found")
    return cat


@router.delete("/categories/{category_id}", status_code=204)
def delete_tag_category(
    category_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Soft-delete a tag category."""
    svc = TagService(db)
    if not svc.delete_category(category_id):
        raise HTTPException(status_code=404, detail="Tag category not found")


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------


@router.get("", response_model=TagListResponse)
def list_tags(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    category_id: Optional[UUID] = None,
    search: Optional[str] = None,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List tags with optional category and search filters."""
    svc = TagService(db)
    items, total = svc.list_tags(
        business_id, category_id=category_id, search=search, page=page, per_page=per_page
    )
    return TagListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("", response_model=TagResponse, status_code=201)
def create_tag(
    payload: TagCreate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    user=Depends(get_current_active_user),
):
    """Create a new tag."""
    svc = TagService(db)
    return svc.create_tag(
        business_id,
        name=payload.name,
        slug=payload.slug,
        category_id=payload.category_id,
        parent_tag_id=payload.parent_tag_id,
        description=payload.description,
        color=payload.color,
        is_system_tag=payload.is_system_tag,
        auto_apply_rules=payload.auto_apply_rules,
    )


@router.get("/{tag_id}", response_model=TagResponse)
def get_tag(
    tag_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get a single tag by ID."""
    svc = TagService(db)
    tag = svc.get_tag(tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag


@router.patch("/{tag_id}", response_model=TagResponse)
def update_tag(
    tag_id: UUID,
    payload: TagUpdate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update a tag."""
    svc = TagService(db)
    tag = svc.update_tag(tag_id, **payload.model_dump(exclude_unset=True))
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag


@router.delete("/{tag_id}", status_code=204)
def delete_tag(
    tag_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Soft-delete a tag."""
    svc = TagService(db)
    if not svc.delete_tag(tag_id):
        raise HTTPException(status_code=404, detail="Tag not found")


# ---------------------------------------------------------------------------
# Product Tags
# ---------------------------------------------------------------------------


@router.post("/products", response_model=ProductTagResponse, status_code=201)
def assign_product_tag(
    payload: ProductTagCreate,
    db: Session = Depends(get_sync_db),
    user=Depends(get_current_active_user),
):
    """Assign a tag to a product."""
    svc = TagService(db)
    return svc.assign_tag(
        payload.product_id,
        payload.tag_id,
        assigned_by=user.id,
        source=payload.assignment_source,
    )


@router.delete("/products/{product_id}/{tag_id}", status_code=204)
def remove_product_tag(
    product_id: UUID,
    tag_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Remove a tag from a product."""
    svc = TagService(db)
    if not svc.remove_tag(product_id, tag_id):
        raise HTTPException(status_code=404, detail="Product-tag association not found")


@router.get("/products/{product_id}", response_model=ProductTagListResponse)
def get_product_tags(
    product_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get all tags for a product."""
    svc = TagService(db)
    items = svc.get_product_tags(product_id)
    return ProductTagListResponse(
        items=items,
        total=len(items),
        page=1,
        per_page=len(items),
        pages=1,
    )
