"""Pydantic schemas for PMS integration.

Covers connections, charges, reversals, guests, reconciliation, and audit.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Connections
# ---------------------------------------------------------------------------


class PMSConnectionCreate(BaseModel):
    """Create a new PMS connection."""

    adapter_type: str = Field(..., pattern="^(opera|protel|mews|cloudbeds|generic)$")
    connection_name: str = Field(..., min_length=1, max_length=255)
    host_url: str = Field(..., min_length=1, max_length=500)
    config: Optional[dict] = None


class PMSConnectionUpdate(BaseModel):
    """Update a PMS connection."""

    connection_name: Optional[str] = Field(None, min_length=1, max_length=255)
    host_url: Optional[str] = None
    is_active: Optional[bool] = None
    config: Optional[dict] = None


class PMSConnectionResponse(BaseModel):
    """PMS connection response (credentials excluded for security)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    adapter_type: str
    connection_name: str
    host_url: str
    is_active: bool
    last_health_check_at: Optional[datetime]
    health_status: str
    config: Optional[dict]
    created_at: datetime
    updated_at: datetime


class PMSConnectionListResponse(BaseModel):
    """Paginated list of PMS connections."""

    items: List[PMSConnectionResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Charges
# ---------------------------------------------------------------------------


class PMSChargeCreate(BaseModel):
    """Post a charge to a guest folio."""

    connection_id: UUID
    room_number: str = Field(..., min_length=1, max_length=20)
    guest_name: Optional[str] = None
    folio_number: Optional[str] = None
    amount: Decimal = Field(..., gt=0)
    currency: str = "ZAR"
    description: Optional[str] = None
    order_id: Optional[UUID] = None


class PMSChargeResponse(BaseModel):
    """PMS charge response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    connection_id: UUID
    business_id: UUID
    order_id: Optional[UUID]
    room_number: str
    guest_name: Optional[str]
    folio_number: Optional[str]
    amount: Decimal
    currency: str
    description: Optional[str]
    status: str
    pms_transaction_id: Optional[str]
    error_message: Optional[str]
    posted_at: Optional[datetime]
    created_at: datetime


class PMSChargeListResponse(BaseModel):
    """Paginated list of charges."""

    items: List[PMSChargeResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Reversals
# ---------------------------------------------------------------------------


class PMSChargeReversalCreate(BaseModel):
    """Request reversal of a posted charge."""

    charge_id: UUID
    reason: str = Field(..., min_length=1)


class PMSChargeReversalResponse(BaseModel):
    """Charge reversal response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    charge_id: UUID
    reason: str
    status: str
    approved_by: Optional[UUID]
    approved_at: Optional[datetime]
    reversed_at: Optional[datetime]
    created_at: datetime


# ---------------------------------------------------------------------------
# Guest Cache
# ---------------------------------------------------------------------------


class PMSGuestCacheResponse(BaseModel):
    """Cached guest profile response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    connection_id: UUID
    pms_guest_id: str
    guest_name: str
    room_number: Optional[str]
    check_in_date: Optional[date]
    check_out_date: Optional[date]
    folio_number: Optional[str]
    credit_limit: Optional[Decimal]
    cached_at: Optional[datetime]


class PMSGuestListResponse(BaseModel):
    """List of cached guests."""

    items: List[PMSGuestCacheResponse]
    total: int


# ---------------------------------------------------------------------------
# Reconciliation
# ---------------------------------------------------------------------------


class PMSReconciliationStartRequest(BaseModel):
    """Start an EOD reconciliation session."""

    connection_id: UUID
    session_date: date


class PMSReconciliationSessionResponse(BaseModel):
    """Reconciliation session response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    connection_id: UUID
    business_id: UUID
    session_date: date
    status: str
    pos_total: Optional[Decimal]
    pms_total: Optional[Decimal]
    variance: Optional[Decimal]
    completed_at: Optional[datetime]
    created_at: datetime


class PMSReconciliationItemResponse(BaseModel):
    """Reconciliation line item response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    charge_id: Optional[UUID]
    status: str
    pos_amount: Optional[Decimal]
    pms_amount: Optional[Decimal]
    resolution_note: Optional[str]
    resolved_at: Optional[datetime]


class PMSReconciliationResolveRequest(BaseModel):
    """Resolve a reconciliation discrepancy."""

    resolution_note: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------


class PMSAuditLogResponse(BaseModel):
    """PMS audit log entry response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    connection_id: Optional[UUID]
    action: str
    entity_type: str
    entity_id: Optional[UUID]
    user_id: Optional[UUID]
    details: Optional[dict]
    ip_address: Optional[str]
    created_at: datetime


class PMSAuditLogListResponse(BaseModel):
    """Paginated list of audit logs."""

    items: List[PMSAuditLogResponse]
    total: int
    page: int
    per_page: int
    pages: int
