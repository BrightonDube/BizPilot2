"""Favorite product schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class FavoriteProductBase(BaseModel):
    """Base favorite product schema."""

    par_level: int = Field(default=0, ge=0, description="Desired stock level")
    auto_reorder: bool = Field(default=False, description="Enable automatic reorder suggestions")
    reorder_quantity: Optional[int] = Field(default=None, ge=1, description="Quantity to reorder")
    sort_order: int = Field(default=0, description="Display order")


class FavoriteProductCreate(FavoriteProductBase):
    """Schema for creating a favorite product."""

    product_id: UUID


class FavoriteProductUpdate(BaseModel):
    """Schema for updating a favorite product."""

    par_level: Optional[int] = Field(default=None, ge=0)
    auto_reorder: Optional[bool] = None
    reorder_quantity: Optional[int] = Field(default=None, ge=1)
    sort_order: Optional[int] = None


class FavoriteProductResponse(FavoriteProductBase):
    """Schema for favorite product response."""

    id: UUID
    business_id: UUID
    product_id: UUID
    user_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    
    # Product details (from joined relationship)
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    product_quantity: Optional[int] = None
    product_selling_price: Optional[float] = None
    product_image_url: Optional[str] = None
    
    # Computed fields
    needs_reorder: bool = False
    quantity_to_order: int = 0

    class Config:
        from_attributes = True


class ReorderSuggestion(BaseModel):
    """Schema for reorder suggestion."""

    favorite_id: UUID
    product_id: UUID
    product_name: str
    product_sku: Optional[str]
    current_quantity: int
    par_level: int
    quantity_to_order: int
    estimated_cost: Optional[float] = None
