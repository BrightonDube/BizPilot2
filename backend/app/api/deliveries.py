"""Delivery management API endpoints."""

import math
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase, ConfigDict, Field

from app.api.deps import get_current_business_id
from app.core.database import get_sync_db
from app.core.rbac import has_permission
from app.models.delivery import DeliveryStatus
from app.models.user import User
from app.services.delivery_service import DeliveryService

router = APIRouter(prefix="/deliveries", tags=["Deliveries"])


# ---------- Schemas ----------

class ZoneCreate(PydanticBase):
    name: str = Field(..., max_length=100)
    delivery_fee: Decimal
    estimated_minutes: int = Field(..., gt=0)
    description: Optional[str] = None


class ZoneUpdate(PydanticBase):
    name: Optional[str] = Field(None, max_length=100)
    delivery_fee: Optional[Decimal] = None
    estimated_minutes: Optional[int] = Field(None, gt=0)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ZoneResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    business_id: str
    name: str
    description: Optional[str] = None
    delivery_fee: Decimal
    estimated_minutes: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class DriverCreate(PydanticBase):
    name: str = Field(..., max_length=255)
    phone: str = Field(..., max_length=50)
    user_id: Optional[str] = None
    vehicle_type: Optional[str] = Field(None, max_length=50)
    license_plate: Optional[str] = Field(None, max_length=20)


class DriverResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    business_id: str
    user_id: Optional[str] = None
    name: str
    phone: str
    vehicle_type: Optional[str] = None
    license_plate: Optional[str] = None
    is_available: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class DeliveryCreate(PydanticBase):
    order_id: str
    delivery_address: str
    customer_phone: str = Field(..., max_length=50)
    zone_id: Optional[str] = None
    driver_id: Optional[str] = None
    delivery_fee: Optional[Decimal] = None
    delivery_notes: Optional[str] = None


class DeliveryResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    business_id: str
    order_id: str
    driver_id: Optional[str] = None
    zone_id: Optional[str] = None
    status: str
    delivery_address: str
    customer_phone: str
    delivery_fee: Decimal
    estimated_delivery_time: Optional[datetime] = None
    actual_delivery_time: Optional[datetime] = None
    delivery_notes: Optional[str] = None
    proof_of_delivery: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DeliveryListResponse(PydanticBase):
    items: list[DeliveryResponse]
    total: int
    page: int
    per_page: int
    pages: int


class AssignDriverBody(PydanticBase):
    driver_id: str


class UpdateStatusBody(PydanticBase):
    status: DeliveryStatus
    proof_of_delivery: Optional[str] = None


class DriverStatsResponse(PydanticBase):
    driver_id: str
    total_deliveries: int
    delivered: int
    failed: int
    success_rate: float
    total_fees_collected: float


# ---------- Helper ----------

def _str_id(obj):
    """Ensure UUID fields are serialised as strings."""
    data = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    for key in ("id", "business_id", "order_id", "driver_id", "zone_id", "user_id"):
        if key in data and data[key] is not None:
            data[key] = str(data[key])
    if "status" in data and data["status"] is not None:
        data["status"] = data["status"].value if hasattr(data["status"], "value") else str(data["status"])
    return data


# ---------- Zone endpoints ----------

@router.post("/zones", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(
    body: ZoneCreate,
    current_user: User = Depends(has_permission("deliveries:manage")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a delivery zone."""
    service = DeliveryService(db)
    zone = service.create_zone(
        business_id=business_id,
        name=body.name,
        delivery_fee=body.delivery_fee,
        estimated_minutes=body.estimated_minutes,
        description=body.description,
    )
    return ZoneResponse(**_str_id(zone))


@router.get("/zones", response_model=list[ZoneResponse])
async def list_zones(
    current_user: User = Depends(has_permission("deliveries:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List active delivery zones."""
    service = DeliveryService(db)
    zones = service.list_zones(business_id)
    return [ZoneResponse(**_str_id(z)) for z in zones]


@router.put("/zones/{zone_id}", response_model=ZoneResponse)
async def update_zone(
    zone_id: str,
    body: ZoneUpdate,
    current_user: User = Depends(has_permission("deliveries:manage")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update a delivery zone."""
    service = DeliveryService(db)
    updates = body.model_dump(exclude_unset=True)
    zone = service.update_zone(zone_id, business_id, **updates)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    return ZoneResponse(**_str_id(zone))


# ---------- Driver endpoints ----------

@router.post("/drivers", response_model=DriverResponse, status_code=status.HTTP_201_CREATED)
async def create_driver(
    body: DriverCreate,
    current_user: User = Depends(has_permission("deliveries:manage")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Add a driver."""
    service = DeliveryService(db)
    driver = service.create_driver(
        business_id=business_id,
        name=body.name,
        phone=body.phone,
        user_id=body.user_id,
        vehicle_type=body.vehicle_type,
        license_plate=body.license_plate,
    )
    return DriverResponse(**_str_id(driver))


@router.get("/drivers", response_model=list[DriverResponse])
async def list_drivers(
    available_only: bool = Query(False),
    current_user: User = Depends(has_permission("deliveries:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List drivers."""
    service = DeliveryService(db)
    drivers = service.list_drivers(business_id, available_only=available_only)
    return [DriverResponse(**_str_id(d)) for d in drivers]


@router.patch("/drivers/{driver_id}/availability", response_model=DriverResponse)
async def toggle_driver_availability(
    driver_id: str,
    current_user: User = Depends(has_permission("deliveries:manage")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Toggle driver availability."""
    service = DeliveryService(db)
    driver = service.toggle_driver_availability(driver_id, business_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return DriverResponse(**_str_id(driver))


# ---------- Delivery endpoints ----------

@router.post("", response_model=DeliveryResponse, status_code=status.HTTP_201_CREATED)
async def create_delivery(
    body: DeliveryCreate,
    current_user: User = Depends(has_permission("deliveries:manage")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a delivery."""
    service = DeliveryService(db)
    delivery = service.create_delivery(
        business_id=business_id,
        order_id=body.order_id,
        address=body.delivery_address,
        phone=body.customer_phone,
        zone_id=body.zone_id,
        driver_id=body.driver_id,
        delivery_fee=body.delivery_fee,
        notes=body.delivery_notes,
    )
    return DeliveryResponse(**_str_id(delivery))


@router.get("", response_model=DeliveryListResponse)
async def list_deliveries(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[DeliveryStatus] = Query(None, alias="status"),
    driver_id: Optional[str] = None,
    current_user: User = Depends(has_permission("deliveries:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List deliveries with filters and pagination."""
    service = DeliveryService(db)
    items, total = service.list_deliveries(
        business_id, status=status_filter, driver_id=driver_id, page=page, per_page=per_page
    )
    return DeliveryListResponse(
        items=[DeliveryResponse(**_str_id(d)) for d in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/active", response_model=list[DeliveryResponse])
async def active_deliveries(
    current_user: User = Depends(has_permission("deliveries:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get active (in-progress) deliveries."""
    service = DeliveryService(db)
    items = service.get_active_deliveries(business_id)
    return [DeliveryResponse(**_str_id(d)) for d in items]


@router.get("/{delivery_id}", response_model=DeliveryResponse)
async def get_delivery(
    delivery_id: str,
    current_user: User = Depends(has_permission("deliveries:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get a single delivery."""
    service = DeliveryService(db)
    delivery = service.get_delivery(delivery_id, business_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return DeliveryResponse(**_str_id(delivery))


@router.post("/{delivery_id}/assign", response_model=DeliveryResponse)
async def assign_driver(
    delivery_id: str,
    body: AssignDriverBody,
    current_user: User = Depends(has_permission("deliveries:manage")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Assign a driver to a delivery."""
    service = DeliveryService(db)
    delivery = service.assign_driver(delivery_id, body.driver_id, business_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return DeliveryResponse(**_str_id(delivery))


@router.patch("/{delivery_id}/status", response_model=DeliveryResponse)
async def update_delivery_status(
    delivery_id: str,
    body: UpdateStatusBody,
    current_user: User = Depends(has_permission("deliveries:manage")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update delivery status."""
    service = DeliveryService(db)
    delivery = service.update_status(
        delivery_id, business_id, body.status, proof=body.proof_of_delivery
    )
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return DeliveryResponse(**_str_id(delivery))


@router.get("/drivers/{driver_id}/stats", response_model=DriverStatsResponse)
async def driver_stats(
    driver_id: str,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    current_user: User = Depends(has_permission("deliveries:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get driver performance statistics."""
    service = DeliveryService(db)
    stats = service.get_driver_stats(driver_id, business_id, date_from, date_to)
    return DriverStatsResponse(**stats)
