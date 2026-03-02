"""Pydantic schemas for tags, tag categories, and product-tag associations."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Tag Category schemas
# ---------------------------------------------------------------------------


class TagCategoryCreate(BaseModel):
    """Create a tag category (e.g. "Dietary", "Cuisine")."""

    name: str = Field(..., max_length=255)
    slug: str = Field(..., max_length=255)
    description: Optional[str] = None
    color: Optional[str] = Field(None, max_length=7, description="Hex colour")
    icon: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class TagCategoryUpdate(BaseModel):
    """Update a tag category."""

    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class TagCategoryResponse(BaseModel):
    """Response schema for a tag category."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TagCategoryListResponse(BaseModel):
    """Paginated list of tag categories."""

    items: list[TagCategoryResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Tag schemas
# ---------------------------------------------------------------------------


class TagCreate(BaseModel):
    """Create a tag, optionally in a category and/or under a parent tag."""

    name: str = Field(..., max_length=255)
    slug: str = Field(..., max_length=255)
    category_id: Optional[UUID] = None
    parent_tag_id: Optional[UUID] = None
    description: Optional[str] = None
    color: Optional[str] = None
    is_system_tag: bool = False
    is_active: bool = True
    auto_apply_rules: Optional[dict[str, Any]] = None


class TagUpdate(BaseModel):
    """Update a tag."""

    name: Optional[str] = None
    slug: Optional[str] = None
    category_id: Optional[UUID] = None
    parent_tag_id: Optional[UUID] = None
    description: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    auto_apply_rules: Optional[dict[str, Any]] = None


class TagResponse(BaseModel):
    """Response schema for a tag."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    category_id: Optional[UUID] = None
    parent_tag_id: Optional[UUID] = None
    name: str
    slug: str
    description: Optional[str] = None
    color: Optional[str] = None
    hierarchy_level: int
    hierarchy_path: Optional[str] = None
    usage_count: int
    is_system_tag: bool
    is_active: bool
    auto_apply_rules: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class TagListResponse(BaseModel):
    """Paginated list of tags."""

    items: list[TagResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Product Tag schemas
# ---------------------------------------------------------------------------


class ProductTagCreate(BaseModel):
    """Assign a tag to a product."""

    product_id: UUID
    tag_id: UUID
    assignment_source: str = "manual"


class ProductTagResponse(BaseModel):
    """Response schema for a product-tag association."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    tag_id: UUID
    assigned_by: Optional[UUID] = None
    assigned_at: datetime
    assignment_source: str


class ProductTagListResponse(BaseModel):
    """Paginated list of product-tag associations."""

    items: list[ProductTagResponse]
    total: int
    page: int
    per_page: int
    pages: int
