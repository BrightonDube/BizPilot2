"""Pydantic schemas for Xero integration."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class XeroConnectionCreate(BaseModel):
    """Initiate Xero OAuth2 connection."""
    tenant_id: Optional[str] = None
    config: Optional[dict] = None


class XeroConnectionUpdate(BaseModel):
    """Update Xero connection settings."""
    is_active: Optional[bool] = None
    config: Optional[dict] = None


class XeroConnectionResponse(BaseModel):
    """Xero connection response (tokens excluded for security)."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    tenant_id: Optional[str]
    is_active: bool
    last_sync_at: Optional[datetime]
    sync_status: str
    config: Optional[dict]
    created_at: datetime
    updated_at: datetime


class XeroSyncLogResponse(BaseModel):
    """Xero sync log entry response."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    entity_type: str
    entity_id: UUID
    xero_id: Optional[str]
    direction: str
    status: str
    error_message: Optional[str]
    synced_at: Optional[datetime]
    created_at: datetime


class XeroSyncLogListResponse(BaseModel):
    """Paginated list of sync logs."""
    items: List[XeroSyncLogResponse]
    total: int
    page: int
    per_page: int
    pages: int
