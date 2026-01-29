"""Category API endpoints."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db, get_sync_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    CategoryListResponse,
    CategoryTreeResponse,
    CategoryTreeNode,
    CategoryReorderItem,
)
from app.services.category_service import CategoryService

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=CategoryListResponse)
async def list_categories(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    parent_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """List all categories with pagination."""
    category_service = CategoryService(db)
    categories, total = category_service.list_categories(
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        parent_id=parent_id,
    )
    return CategoryListResponse(items=categories, total=total, skip=skip, limit=limit)


@router.get("/tree", response_model=CategoryTreeResponse)
async def get_category_tree(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Get hierarchical category tree."""
    category_service = CategoryService(db)
    tree = category_service.get_category_tree(current_user.id)
    
    # Count total categories
    def count_nodes(nodes: List[CategoryTreeNode]) -> int:
        count = len(nodes)
        for node in nodes:
            count += count_nodes(node.children)
        return count
    
    return CategoryTreeResponse(items=tree, total=count_nodes(tree))


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Create a new category."""
    category_service = CategoryService(db)
    try:
        category = category_service.create_category(category_data, current_user.id)
        return category
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Get a specific category by ID."""
    category_service = CategoryService(db)
    category = category_service.get_category(category_id, current_user.id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    category_data: CategoryUpdate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Update a category."""
    category_service = CategoryService(db)
    try:
        category = category_service.update_category(category_id, category_data, current_user.id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found",
            )
        return category
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Delete a category. Children will be moved to the deleted category's parent."""
    category_service = CategoryService(db)
    if not category_service.delete_category(category_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )


@router.post("/reorder", status_code=status.HTTP_200_OK)
async def reorder_categories(
    category_orders: List[CategoryReorderItem],
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """
    Reorder categories by updating sort_order and optionally parent_id.
    
    Expected format: [{"id": "uuid", "sort_order": 0, "parent_id": "uuid or null"}]
    """
    category_service = CategoryService(db)
    if not category_service.reorder_categories(category_orders, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to reorder categories",
        )
    return {"message": "Categories reordered successfully"}
