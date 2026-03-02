"""Pydantic schemas for WooCommerce integration."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WooConnectionCreate(BaseModel):
    """Configure WooCommerce connection."""
    store_url: str = Field(..., min_length=1, max_length=500)
    config: Optional[dict] = None


class WooConnectionUpdate(BaseModel):
    """Update WooCommerce connection."""
    store_url: Optional[str] = None
    is_active: Optional[bool] = None
    config: Optional[dict] = None


class WooConnectionResponse(BaseModel):
    """WooCommerce connection response (keys excluded for security)."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    store_url: str
    is_active: bool
    last_sync_at: Optional[datetime]
    sync_status: str
    config: Optional[dict]
    created_at: datetime
    updated_at: datetime


class WooSyncMapResponse(BaseModel):
    """WooCommerce sync map entry response."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    entity_type: str
    bizpilot_id: UUID
    woo_id: Optional[str]
    direction: str
    status: str
    error_message: Optional[str]
    last_synced_at: Optional[datetime]
    created_at: datetime


class WooSyncMapListResponse(BaseModel):
    """Paginated list of sync map entries."""
    items: List[WooSyncMapResponse]
    total: int
    page: int
    per_page: int
    pages: int
