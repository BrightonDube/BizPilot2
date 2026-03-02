"""Pydantic schemas for proforma invoice revisions."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ProformaRevisionCreate(BaseModel):
    """Create a new revision of a proforma invoice."""

    change_summary: Optional[str] = None


class ProformaRevisionResponse(BaseModel):
    """Response schema for a proforma revision."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    proforma_id: UUID
    revision_number: int
    created_by: Optional[UUID] = None
    change_summary: Optional[str] = None
    snapshot: dict[str, Any]
    created_at: datetime
