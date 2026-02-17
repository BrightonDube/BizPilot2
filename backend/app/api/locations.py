"""Multi-location inventory API endpoints."""

import math
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase, ConfigDict, Field

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.models.location import TransferStatus
from app.models.user import User
from app.services.location_service import LocationService

router = APIRouter(prefix="/locations", tags=["Locations"])


# ── Schemas ───────────────────────────────────────────────────

class LocationCreate(PydanticBase):
    name: str = Field(..., max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    is_warehouse: bool = False
    is_primary: bool = False


class LocationUpdate(PydanticBase):
    name: Optional[str] = Field(None, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None
    is_warehouse: Optional[bool] = None
    is_primary: Optional[bool] = None


class LocationResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    business_id: str
    name: str
    code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool
    is_warehouse: bool
    is_primary: bool
    created_at: datetime
    updated_at: datetime


class StockLevelBody(PydanticBase):
    product_id: str
    quantity: int = Field(..., ge=0)
    min_quantity: int = Field(0, ge=0)
    max_quantity: Optional[int] = None


class StockLevelResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    location_id: str
    product_id: str
    quantity: int
    min_quantity: int
    max_quantity: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class StockLevelListResponse(PydanticBase):
    items: List[StockLevelResponse]
    total: int
    page: int
    per_page: int
    pages: int


class TransferItemCreate(PydanticBase):
    product_id: str
    quantity: int = Field(..., gt=0)


class TransferCreate(PydanticBase):
    from_location_id: str
    to_location_id: str
    items: List[TransferItemCreate]
    notes: Optional[str] = None


class TransferItemResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    product_id: str
    quantity: int
    received_quantity: int


class TransferResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    business_id: str
    from_location_id: str
    to_location_id: str
    status: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    initiated_by: Optional[str] = None
    items: List[TransferItemResponse] = []
    created_at: datetime
    updated_at: datetime


class TransferListResponse(PydanticBase):
    items: List[TransferResponse]
    total: int
    page: int
    per_page: int
    pages: int


class ReceivedItem(PydanticBase):
    product_id: str
    received_quantity: int = Field(..., ge=0)


class ReceiveTransferBody(PydanticBase):
    received_items: List[ReceivedItem]


class LowStockAlertResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    location_id: str
    product_id: str
    quantity: int
    min_quantity: int


# ── Helpers ───────────────────────────────────────────────────

def _str_id(obj):
    """Ensure UUID fields are serialised as strings."""
    data = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    for key in data:
        if isinstance(data[key], UUID):
            data[key] = str(data[key])
    if "status" in data and data["status"] is not None:
        data["status"] = data["status"].value if hasattr(data["status"], "value") else str(data["status"])
    return data


# ── Location endpoints ────────────────────────────────────────

@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    body: LocationCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a new location."""
    svc = LocationService(db)
    location = svc.create_location(business_id=business_id, **body.model_dump())
    return LocationResponse(**_str_id(location))


@router.get("", response_model=List[LocationResponse])
async def list_locations(
    include_inactive: bool = Query(False),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List locations for the current business."""
    svc = LocationService(db)
    locations = svc.list_locations(business_id, include_inactive=include_inactive)
    return [LocationResponse(**_str_id(loc)) for loc in locations]


@router.get("/alerts/low-stock", response_model=List[LowStockAlertResponse])
async def get_low_stock_alerts(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get products below minimum stock at any location."""
    svc = LocationService(db)
    alerts = svc.get_low_stock_alerts(business_id)
    return [LowStockAlertResponse(**_str_id(a)) for a in alerts]


@router.get("/product/{product_id}/stock", response_model=List[StockLevelResponse])
async def get_product_across_locations(
    product_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get stock levels for a product across all locations."""
    svc = LocationService(db)
    levels = svc.get_product_across_locations(business_id, product_id)
    return [StockLevelResponse(**_str_id(s)) for s in levels]


@router.get("/transfers", response_model=TransferListResponse)
async def list_transfers(
    transfer_status: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List stock transfers."""
    svc = LocationService(db)
    status_filter = TransferStatus(transfer_status) if transfer_status else None
    items, total = svc.list_transfers(business_id, status=status_filter, page=page, per_page=per_page)
    return TransferListResponse(
        items=[TransferResponse(**_str_id(t)) for t in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/transfers", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
async def create_transfer(
    body: TransferCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a stock transfer between locations."""
    svc = LocationService(db)
    transfer = svc.create_transfer(
        business_id=business_id,
        from_location_id=body.from_location_id,
        to_location_id=body.to_location_id,
        items=[i.model_dump() for i in body.items],
        notes=body.notes,
        initiated_by=str(current_user.id),
    )
    return TransferResponse(**_str_id(transfer))


@router.get("/transfers/{transfer_id}", response_model=TransferResponse)
async def get_transfer(
    transfer_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get a single transfer."""
    svc = LocationService(db)
    transfer = svc.get_transfer(transfer_id, business_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return TransferResponse(**_str_id(transfer))


@router.patch("/transfers/{transfer_id}/receive", response_model=TransferResponse)
async def receive_transfer(
    transfer_id: str,
    body: ReceiveTransferBody,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Receive a stock transfer and update stock levels."""
    svc = LocationService(db)
    transfer = svc.receive_transfer(
        transfer_id, business_id, [i.model_dump() for i in body.received_items]
    )
    if not transfer:
        raise HTTPException(status_code=400, detail="Transfer cannot be received")
    return TransferResponse(**_str_id(transfer))


@router.patch("/transfers/{transfer_id}/cancel", response_model=TransferResponse)
async def cancel_transfer(
    transfer_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Cancel a pending transfer."""
    svc = LocationService(db)
    transfer = svc.cancel_transfer(transfer_id, business_id)
    if not transfer:
        raise HTTPException(status_code=400, detail="Transfer cannot be cancelled")
    return TransferResponse(**_str_id(transfer))


@router.get("/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get a single location."""
    svc = LocationService(db)
    location = svc.get_location(location_id, business_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return LocationResponse(**_str_id(location))


@router.put("/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: str,
    body: LocationUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update a location."""
    svc = LocationService(db)
    location = svc.update_location(
        location_id, business_id, **body.model_dump(exclude_unset=True)
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return LocationResponse(**_str_id(location))


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Soft-delete a location."""
    svc = LocationService(db)
    if not svc.delete_location(location_id, business_id):
        raise HTTPException(status_code=404, detail="Location not found")


@router.put("/{location_id}/stock", response_model=StockLevelResponse)
async def set_stock_level(
    location_id: str,
    body: StockLevelBody,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Set stock level for a product at a location."""
    svc = LocationService(db)
    # Verify location belongs to business
    location = svc.get_location(location_id, business_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    stock = svc.set_stock_level(
        location_id=location_id,
        product_id=body.product_id,
        quantity=body.quantity,
        min_quantity=body.min_quantity,
        max_quantity=body.max_quantity,
    )
    return StockLevelResponse(**_str_id(stock))


@router.get("/{location_id}/stock", response_model=StockLevelListResponse)
async def get_stock_at_location(
    location_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get stock levels at a location."""
    svc = LocationService(db)
    location = svc.get_location(location_id, business_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    items, total = svc.get_stock_levels(location_id, page=page, per_page=per_page)
    return StockLevelListResponse(
        items=[StockLevelResponse(**_str_id(s)) for s in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )
