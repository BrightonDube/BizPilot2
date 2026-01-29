"""Favorite products API endpoints."""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.api.deps import get_current_active_user, get_current_business_id, get_db
from app.models import User, FavoriteProduct, Product
from app.schemas.favorite import (
    FavoriteProductCreate,
    FavoriteProductUpdate,
    FavoriteProductResponse,
    ReorderSuggestion,
)

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=List[FavoriteProductResponse])
async def list_favorites(
    db=Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    business_id: UUID = Depends(get_current_business_id),
    user_specific: bool = False,
):
    """List all favorite products for the business or user."""
    query = select(FavoriteProduct).where(
        and_(
            FavoriteProduct.business_id == business_id,
            FavoriteProduct.deleted_at.is_(None),
        )
    ).options(joinedload(FavoriteProduct.product))
    
    if user_specific:
        query = query.where(FavoriteProduct.user_id == current_user.id)
    
    query = query.order_by(FavoriteProduct.sort_order, FavoriteProduct.created_at)
    
    result = await db.execute(query)
    favorites = result.scalars().all()
    
    # Build response with product details
    response = []
    for fav in favorites:
        fav_dict = {
            "id": fav.id,
            "business_id": fav.business_id,
            "product_id": fav.product_id,
            "user_id": fav.user_id,
            "par_level": fav.par_level,
            "auto_reorder": fav.auto_reorder,
            "reorder_quantity": fav.reorder_quantity,
            "sort_order": fav.sort_order,
            "created_at": fav.created_at,
            "updated_at": fav.updated_at,
            "needs_reorder": fav.needs_reorder,
            "quantity_to_order": fav.quantity_to_order,
        }
        
        if fav.product:
            fav_dict.update({
                "product_name": fav.product.name,
                "product_sku": fav.product.sku,
                "product_quantity": fav.product.quantity,
                "product_selling_price": float(fav.product.selling_price) if fav.product.selling_price else None,
                "product_image_url": fav.product.image_url,
            })
        
        response.append(FavoriteProductResponse(**fav_dict))
    
    return response


@router.post("", response_model=FavoriteProductResponse, status_code=status.HTTP_201_CREATED)
async def create_favorite(
    favorite_in: FavoriteProductCreate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    business_id: UUID = Depends(get_current_business_id),
):
    """Add a product to favorites."""
    # Check if product exists and belongs to business
    product_query = select(Product).where(
        and_(
            Product.id == favorite_in.product_id,
            Product.business_id == business_id,
            Product.deleted_at.is_(None),
        )
    )
    result = await db.execute(product_query)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    
    # Check if already favorited
    existing_query = select(FavoriteProduct).where(
        and_(
            FavoriteProduct.business_id == business_id,
            FavoriteProduct.product_id == favorite_in.product_id,
            FavoriteProduct.user_id == current_user.id,
            FavoriteProduct.deleted_at.is_(None),
        )
    )
    result = await db.execute(existing_query)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product already in favorites",
        )
    
    # Create favorite
    favorite = FavoriteProduct(
        business_id=business_id,
        product_id=favorite_in.product_id,
        user_id=current_user.id,
        par_level=favorite_in.par_level,
        auto_reorder=favorite_in.auto_reorder,
        reorder_quantity=favorite_in.reorder_quantity,
        sort_order=favorite_in.sort_order,
    )
    
    db.add(favorite)
    await db.commit()
    await db.refresh(favorite)
    
    # Load product relationship
    await db.refresh(favorite, ["product"])
    
    # Build response
    fav_dict = {
        "id": favorite.id,
        "business_id": favorite.business_id,
        "product_id": favorite.product_id,
        "user_id": favorite.user_id,
        "par_level": favorite.par_level,
        "auto_reorder": favorite.auto_reorder,
        "reorder_quantity": favorite.reorder_quantity,
        "sort_order": favorite.sort_order,
        "created_at": favorite.created_at,
        "updated_at": favorite.updated_at,
        "needs_reorder": favorite.needs_reorder,
        "quantity_to_order": favorite.quantity_to_order,
    }
    
    if favorite.product:
        fav_dict.update({
            "product_name": favorite.product.name,
            "product_sku": favorite.product.sku,
            "product_quantity": favorite.product.quantity,
            "product_selling_price": float(favorite.product.selling_price) if favorite.product.selling_price else None,
            "product_image_url": favorite.product.image_url,
        })
    
    return FavoriteProductResponse(**fav_dict)


@router.get("/{favorite_id}", response_model=FavoriteProductResponse)
async def get_favorite(
    favorite_id: UUID,
    db=Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    business_id: UUID = Depends(get_current_business_id),
):
    """Get a specific favorite product."""
    query = select(FavoriteProduct).where(
        and_(
            FavoriteProduct.id == favorite_id,
            FavoriteProduct.business_id == business_id,
            FavoriteProduct.deleted_at.is_(None),
        )
    ).options(joinedload(FavoriteProduct.product))
    
    result = await db.execute(query)
    favorite = result.scalar_one_or_none()
    
    if not favorite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Favorite not found",
        )
    
    # Build response
    fav_dict = {
        "id": favorite.id,
        "business_id": favorite.business_id,
        "product_id": favorite.product_id,
        "user_id": favorite.user_id,
        "par_level": favorite.par_level,
        "auto_reorder": favorite.auto_reorder,
        "reorder_quantity": favorite.reorder_quantity,
        "sort_order": favorite.sort_order,
        "created_at": favorite.created_at,
        "updated_at": favorite.updated_at,
        "needs_reorder": favorite.needs_reorder,
        "quantity_to_order": favorite.quantity_to_order,
    }
    
    if favorite.product:
        fav_dict.update({
            "product_name": favorite.product.name,
            "product_sku": favorite.product.sku,
            "product_quantity": favorite.product.quantity,
            "product_selling_price": float(favorite.product.selling_price) if favorite.product.selling_price else None,
            "product_image_url": favorite.product.image_url,
        })
    
    return FavoriteProductResponse(**fav_dict)


@router.patch("/{favorite_id}", response_model=FavoriteProductResponse)
async def update_favorite(
    favorite_id: UUID,
    favorite_in: FavoriteProductUpdate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    business_id: UUID = Depends(get_current_business_id),
):
    """Update a favorite product's settings."""
    query = select(FavoriteProduct).where(
        and_(
            FavoriteProduct.id == favorite_id,
            FavoriteProduct.business_id == business_id,
            FavoriteProduct.deleted_at.is_(None),
        )
    ).options(joinedload(FavoriteProduct.product))
    
    result = await db.execute(query)
    favorite = result.scalar_one_or_none()
    
    if not favorite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Favorite not found",
        )
    
    # Update fields
    update_data = favorite_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(favorite, field, value)
    
    await db.commit()
    await db.refresh(favorite)
    
    # Build response
    fav_dict = {
        "id": favorite.id,
        "business_id": favorite.business_id,
        "product_id": favorite.product_id,
        "user_id": favorite.user_id,
        "par_level": favorite.par_level,
        "auto_reorder": favorite.auto_reorder,
        "reorder_quantity": favorite.reorder_quantity,
        "sort_order": favorite.sort_order,
        "created_at": favorite.created_at,
        "updated_at": favorite.updated_at,
        "needs_reorder": favorite.needs_reorder,
        "quantity_to_order": favorite.quantity_to_order,
    }
    
    if favorite.product:
        fav_dict.update({
            "product_name": favorite.product.name,
            "product_sku": favorite.product.sku,
            "product_quantity": favorite.product.quantity,
            "product_selling_price": float(favorite.product.selling_price) if favorite.product.selling_price else None,
            "product_image_url": favorite.product.image_url,
        })
    
    return FavoriteProductResponse(**fav_dict)


@router.delete("/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_favorite(
    favorite_id: UUID,
    db=Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    business_id: UUID = Depends(get_current_business_id),
):
    """Remove a product from favorites (soft delete)."""
    query = select(FavoriteProduct).where(
        and_(
            FavoriteProduct.id == favorite_id,
            FavoriteProduct.business_id == business_id,
            FavoriteProduct.deleted_at.is_(None),
        )
    )
    
    result = await db.execute(query)
    favorite = result.scalar_one_or_none()
    
    if not favorite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Favorite not found",
        )
    
    # Soft delete
    from datetime import datetime
    favorite.deleted_at = datetime.utcnow()
    
    await db.commit()
    return None


@router.get("/reorder/suggestions", response_model=List[ReorderSuggestion])
async def get_reorder_suggestions(
    db=Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    business_id: UUID = Depends(get_current_business_id),
):
    """Get list of products that need reordering based on par levels."""
    query = select(FavoriteProduct).where(
        and_(
            FavoriteProduct.business_id == business_id,
            FavoriteProduct.auto_reorder,
            FavoriteProduct.deleted_at.is_(None),
        )
    ).options(joinedload(FavoriteProduct.product))
    
    result = await db.execute(query)
    favorites = result.scalars().all()
    
    suggestions = []
    for fav in favorites:
        if fav.needs_reorder and fav.product:
            estimated_cost = None
            if fav.product.cost_price:
                estimated_cost = float(fav.product.cost_price * fav.quantity_to_order)
            
            suggestions.append(
                ReorderSuggestion(
                    favorite_id=fav.id,
                    product_id=fav.product_id,
                    product_name=fav.product.name,
                    product_sku=fav.product.sku,
                    current_quantity=fav.product.quantity,
                    par_level=fav.par_level,
                    quantity_to_order=fav.quantity_to_order,
                    estimated_cost=estimated_cost,
                )
            )
    
    return suggestions
