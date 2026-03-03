"""
Smart Collection API endpoints.

Provides CRUD for rule-based product groupings and product membership
management. Collections auto-refresh based on configurable rules.

Why separate from the tags API?
Tags are simple labels; smart collections are complex rule engines.
They have different access patterns (collections need rule evaluation,
product count maintenance, refresh scheduling) that would clutter
the tag endpoints.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel as PydanticBase
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_active_user, get_current_business_id
from app.services.smart_collection_service import SmartCollectionService


router = APIRouter(prefix="/collections", tags=["Smart Collections"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CollectionCreateRequest(PydanticBase):
    """Request to create a smart collection."""
    name: str
    slug: str
    description: Optional[str] = None
    rules: Optional[list] = None
    rule_logic: str = "and"
    auto_update: bool = True


class CollectionUpdateRequest(PydanticBase):
    """Request to update a smart collection."""
    name: Optional[str] = None
    description: Optional[str] = None
    rules: Optional[list] = None
    rule_logic: Optional[str] = None
    is_active: Optional[bool] = None
    auto_update: Optional[bool] = None


class ProductAddRequest(PydanticBase):
    """Request to add a product to a collection."""
    product_id: UUID
    manually_included: bool = False


# ---------------------------------------------------------------------------
# Collection CRUD
# ---------------------------------------------------------------------------

@router.get("")
async def list_collections(
    active_only: bool = Query(True),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """List smart collections for the current business."""
    service = SmartCollectionService(db)
    items, total = service.list_collections(
        business_id=business_id,
        page=page,
        per_page=per_page,
        active_only=active_only,
    )
    pages = (total + per_page - 1) // per_page if per_page > 0 else 0
    return {
        "items": [
            {
                "id": str(c.id),
                "name": c.name,
                "slug": c.slug,
                "description": c.description,
                "rules": c.rules,
                "rule_logic": c.rule_logic,
                "is_active": c.is_active,
                "auto_update": c.auto_update,
                "product_count": c.product_count,
                "last_refresh_at": c.last_refresh_at.isoformat() if c.last_refresh_at else None,
            }
            for c in items
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": pages,
    }


@router.post("")
async def create_collection(
    request: CollectionCreateRequest,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Create a new smart collection."""
    service = SmartCollectionService(db)
    collection = service.create_collection(
        business_id=business_id,
        name=request.name,
        slug=request.slug,
        description=request.description,
        rules=request.rules,
        rule_logic=request.rule_logic,
        auto_update=request.auto_update,
        created_by=current_user.id,
    )
    return {"id": str(collection.id), "name": collection.name}


@router.get("/{collection_id}")
async def get_collection(
    collection_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Get a single collection by ID."""
    service = SmartCollectionService(db)
    collection = service.get_collection(collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return {
        "id": str(collection.id),
        "name": collection.name,
        "slug": collection.slug,
        "description": collection.description,
        "rules": collection.rules,
        "rule_logic": collection.rule_logic,
        "is_active": collection.is_active,
        "auto_update": collection.auto_update,
        "product_count": collection.product_count,
        "last_refresh_at": collection.last_refresh_at.isoformat() if collection.last_refresh_at else None,
    }


@router.put("/{collection_id}")
async def update_collection(
    collection_id: UUID,
    request: CollectionUpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Update a smart collection."""
    service = SmartCollectionService(db)
    collection = service.update_collection(
        collection_id=collection_id,
        name=request.name,
        description=request.description,
        rules=request.rules,
        rule_logic=request.rule_logic,
        is_active=request.is_active,
        auto_update=request.auto_update,
    )
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return {"id": str(collection.id), "name": collection.name}


@router.delete("/{collection_id}")
async def delete_collection(
    collection_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Soft-delete a collection."""
    service = SmartCollectionService(db)
    success = service.delete_collection(collection_id)
    if not success:
        raise HTTPException(status_code=404, detail="Collection not found")
    return {"message": "Collection deleted"}


@router.post("/{collection_id}/refresh")
async def refresh_collection(
    collection_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Trigger a collection refresh (re-evaluate rules)."""
    service = SmartCollectionService(db)
    collection = service.refresh_collection(collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return {
        "message": "Collection refreshed",
        "product_count": collection.product_count,
    }


# ---------------------------------------------------------------------------
# Product membership
# ---------------------------------------------------------------------------

@router.get("/{collection_id}/products")
async def list_collection_products(
    collection_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """List products in a collection."""
    service = SmartCollectionService(db)
    products = service.list_products(collection_id)
    return [
        {
            "id": str(p.id),
            "product_id": str(p.product_id),
            "manually_included": p.manually_included,
            "manually_excluded": p.manually_excluded,
            "added_at": p.added_at.isoformat() if p.added_at else None,
        }
        for p in products
    ]


@router.post("/{collection_id}/products")
async def add_product_to_collection(
    collection_id: UUID,
    request: ProductAddRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Add a product to a collection."""
    service = SmartCollectionService(db)
    membership = service.add_product(
        collection_id=collection_id,
        product_id=request.product_id,
        manually_included=request.manually_included,
    )
    return {"id": str(membership.id), "product_id": str(membership.product_id)}


@router.delete("/{collection_id}/products/{product_id}")
async def remove_product_from_collection(
    collection_id: UUID,
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Remove a product from a collection."""
    service = SmartCollectionService(db)
    success = service.remove_product(collection_id, product_id)
    if not success:
        raise HTTPException(status_code=404, detail="Product not found in collection")
    return {"message": "Product removed"}


@router.post("/{collection_id}/products/{product_id}/exclude")
async def exclude_product(
    collection_id: UUID,
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Mark a product as excluded from auto-rules."""
    service = SmartCollectionService(db)
    success = service.exclude_product(collection_id, product_id)
    if not success:
        raise HTTPException(status_code=404, detail="Product not found in collection")
    return {"message": "Product excluded"}
