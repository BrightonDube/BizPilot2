"""Category schemas for API validation."""

from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID


class CategoryBase(BaseModel):
    """Base category schema."""
    
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int = 0


class CategoryCreate(CategoryBase):
    """Schema for creating a category."""
    
    parent_id: Optional[UUID] = None


class CategoryUpdate(BaseModel):
    """Schema for updating a category."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = None
    image_url: Optional[str] = None
    parent_id: Optional[UUID] = None
    sort_order: Optional[int] = None


class CategoryResponse(CategoryBase):
    """Schema for category response."""
    
    id: UUID
    parent_id: Optional[UUID] = None
    product_count: int = 0
    
    model_config = {"from_attributes": True}


class CategoryTreeNode(CategoryResponse):
    """Schema for category tree node with children."""

    children: List["CategoryTreeNode"] = Field(default_factory=list)


class CategoryReorderItem(BaseModel):
    id: UUID
    sort_order: int = 0
    parent_id: Optional[UUID] = None


class CategoryListResponse(BaseModel):
    """Schema for paginated category list."""
    
    items: List[CategoryResponse]
    total: int
    skip: int
    limit: int


class CategoryTreeResponse(BaseModel):
    """Schema for category tree response."""
    
    items: List[CategoryTreeNode]
    total: int
