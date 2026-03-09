"""Delivery management API endpoints.

Provides CRUD for zones, drivers, and deliveries, plus:
- Zone-check and fee calculation
- Auto-assignment and reassignment
- Workload monitoring
- Delivery time, zone performance, cost, and driver reports
"""

import math
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase, ConfigDict, Field

from app.api.deps import get_current_business_id
from app.core.database import get_sync_db
from app.core.rbac import has_permission
from app.models.delivery import DeliveryStatus
from app.models.user import User
from app.services.delivery_service import DeliveryService
from app.services.delivery_fee_service import calculate_fee
from app.services.delivery_zone_service import check_address_in_zone
from app.services.delivery_assign_service import (
    auto_assign,
    get_driver_workload,
    reassign_driver,
)
from app.services.delivery_report_service import DeliveryReportService

router = APIRouter(prefix="/deliveries", tags=["Deliveries"])


# ══════════════════════════════════════════════════════════════════════════════
# Schemas
# ══════════════════════════════════════════════════════════════════════════════

class ZoneCreate(PydanticBase):
    """Schema to create a delivery zone with optional geographic boundary."""

    name: str = Field(..., max_length=100)
    delivery_fee: Decimal
    estimated_minutes: int = Field(..., gt=0)
    description: Optional[str] = None
    zone_type: Optional[str] = Field("flat", pattern="^(flat|polygon|radius|postcode)$")
    boundary: Optional[list] = None
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    radius_km: Optional[float] = None
    postcodes: Optional[list[str]] = None
    fee_type: Optional[str] = Field("flat", pattern="^(flat|distance|order_value|combined)$")
    fee_per_km: Optional[Decimal] = None
    min_order_amount: Optional[Decimal] = None
    free_delivery_threshold: Optional[Decimal] = None
    max_distance_km: Optional[float] = None


class ZoneUpdate(PydanticBase):
    """Schema to update a delivery zone."""

    name: Optional[str] = Field(None, max_length=100)
    delivery_fee: Optional[Decimal] = None
    estimated_minutes: Optional[int] = Field(None, gt=0)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    zone_type: Optional[str] = None
    boundary: Optional[list] = None
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    radius_km: Optional[float] = None
    postcodes: Optional[list[str]] = None
    fee_type: Optional[str] = None
    fee_per_km: Optional[Decimal] = None
    min_order_amount: Optional[Decimal] = None
    free_delivery_threshold: Optional[Decimal] = None
    max_distance_km: Optional[float] = None


class ZoneResponse(PydanticBase):
    """Response schema for a delivery zone."""

    model_config = ConfigDict(from_attributes=True)
    id: str
    business_id: str
    name: str
    description: Optional[str] = None
    delivery_fee: Decimal
    estimated_minutes: int
    is_active: bool
    zone_type: Optional[str] = "flat"
    fee_type: Optional[str] = "flat"
    fee_per_km: Optional[Decimal] = None
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    radius_km: Optional[float] = None
    free_delivery_threshold: Optional[Decimal] = None
    max_distance_km: Optional[float] = None
    created_at: datetime
    updated_at: datetime


class DriverCreate(PydanticBase):
    """Schema to add a new driver."""

    name: str = Field(..., max_length=255)
    phone: str = Field(..., max_length=50)
    user_id: Optional[str] = None
    vehicle_type: Optional[str] = Field(None, max_length=50)
    license_plate: Optional[str] = Field(None, max_length=20)
    max_concurrent: Optional[int] = Field(5, ge=1, le=20)


class DriverResponse(PydanticBase):
    """Response schema for a driver."""

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
    max_concurrent: Optional[int] = 5
    created_at: datetime
    updated_at: datetime


class DeliveryCreate(PydanticBase):
    """Schema to create a delivery."""

    order_id: str
    delivery_address: str
    customer_phone: str = Field(..., max_length=50)
    zone_id: Optional[str] = None
    driver_id: Optional[str] = None
    delivery_fee: Optional[Decimal] = None
    delivery_notes: Optional[str] = None
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    auto_assign_driver: bool = False


class DeliveryResponse(PydanticBase):
    """Response schema for a delivery."""

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
    """Paginated list of deliveries."""

    items: list[DeliveryResponse]
    total: int
    page: int
    per_page: int
    pages: int


class AssignDriverBody(PydanticBase):
    driver_id: str


class ReassignDriverBody(PydanticBase):
    """Schema for driver reassignment with reason."""

    new_driver_id: str
    reason: Optional[str] = None


class UpdateStatusBody(PydanticBase):
    status: DeliveryStatus
    proof_of_delivery: Optional[str] = None


class FeeCalculationRequest(PydanticBase):
    """Request to calculate delivery fee."""

    zone_id: str
    order_total: Decimal = Decimal("0")
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None


class ZoneCheckRequest(PydanticBase):
    """Request to check which zone an address falls in."""

    lat: Optional[float] = None
    lng: Optional[float] = None
    postcode: Optional[str] = None


class DriverStatsResponse(PydanticBase):
    driver_id: str
    total_deliveries: int
    delivered: int
    failed: int
    success_rate: float
    total_fees_collected: float


# ── Helper ────────────────────────────────────────────────────────────────────

def _str_id(obj) -> Dict[str, Any]:
    """Convert UUID fields to strings for Pydantic serialisation."""
    data = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    uuid_keys = ("id", "business_id", "order_id", "driver_id", "zone_id", "user_id")
    for key in uuid_keys:
        if key in data and data[key] is not None:
            data[key] = str(data[key])
    if "status" in data and data["status"] is not None:
        data["status"] = data["status"].value if hasattr(data["status"], "value") else str(data["status"])
    return data


# ══════════════════════════════════════════════════════════════════════════════
# Zone endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/zones", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(
    body: ZoneCreate,
    current_user: User = Depends(has_permission("deliveries:manage")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a delivery zone with optional geographic boundary and fee rules."""
    service = DeliveryService(db)
    zone = service.create_zone(
        business_id=business_id,
        name=body.name,
        delivery_fee=body.delivery_fee,
        estimated_minutes=body.estimated_minutes,
        description=body.description,
    )
    # Set the extended fields
    extra_fields = body.model_dump(
        exclude={"name", "delivery_fee", "estimated_minutes", "description"},
        exclude_unset=True,
    )
    for key, val in extra_fields.items():
        if hasattr(zone, key) and val is not None:
            setattr(zone, key, val)
    db.commit()
    db.refresh(zone)
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


@router.post("/zones/check")
async def check_zone(
    body: ZoneCheckRequest,
    current_user: User = Depends(has_permission("deliveries:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Check which delivery zone an address falls into."""
    zone = check_address_in_zone(
        db, business_id, lat=body.lat, lng=body.lng, postcode=body.postcode
    )
    if not zone:
        return {"matched": False, "zone": None}
    return {"matched": True, "zone": ZoneResponse(**_str_id(zone))}


@router.post("/zones/calculate-fee")
async def calculate_delivery_fee(
    body: FeeCalculationRequest,
    current_user: User = Depends(has_permission("deliveries:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Calculate delivery fee for a zone and order total."""
    from app.models.delivery import DeliveryZone
    zone = (
        db.query(DeliveryZone)
        .filter(
            DeliveryZone.id == body.zone_id,
            DeliveryZone.business_id == business_id,
            DeliveryZone.deleted_at.is_(None),
        )
        .first()
    )
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    result = calculate_fee(
        zone,
        order_total=body.order_total,
        delivery_lat=body.delivery_lat,
        delivery_lng=body.delivery_lng,
    )
    # Convert Decimal fee to float for JSON serialisation
    result["fee"] = float(result["fee"])
    return result


# ══════════════════════════════════════════════════════════════════════════════
# Driver endpoints
# ══════════════════════════════════════════════════════════════════════════════

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
    if body.max_concurrent:
        driver.max_concurrent = body.max_concurrent
        db.commit()
        db.refresh(driver)
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


@router.get("/drivers/workload")
async def driver_workload(
    current_user: User = Depends(has_permission("deliveries:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get workload summary for all active drivers."""
    return get_driver_workload(db, business_id)


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


# ══════════════════════════════════════════════════════════════════════════════
# Delivery endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.post("", response_model=DeliveryResponse, status_code=status.HTTP_201_CREATED)
async def create_delivery(
    body: DeliveryCreate,
    current_user: User = Depends(has_permission("deliveries:manage")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a delivery. Optionally auto-assign a driver."""
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
    if body.auto_assign_driver and not body.driver_id:
        auto_assign(
            db, delivery, business_id,
            delivery_lat=body.delivery_lat,
            delivery_lng=body.delivery_lng,
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
async def assign_driver_endpoint(
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


@router.post("/{delivery_id}/auto-assign", response_model=DeliveryResponse)
async def auto_assign_endpoint(
    delivery_id: str,
    delivery_lat: Optional[float] = None,
    delivery_lng: Optional[float] = None,
    current_user: User = Depends(has_permission("deliveries:manage")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Auto-assign the best available driver to a delivery."""
    service = DeliveryService(db)
    delivery = service.get_delivery(delivery_id, business_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    driver = auto_assign(db, delivery, business_id, delivery_lat, delivery_lng)
    if not driver:
        raise HTTPException(status_code=409, detail="No available drivers")
    return DeliveryResponse(**_str_id(delivery))


@router.post("/{delivery_id}/reassign", response_model=DeliveryResponse)
async def reassign_driver_endpoint(
    delivery_id: str,
    body: ReassignDriverBody,
    current_user: User = Depends(has_permission("deliveries:manage")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Reassign a delivery to a different driver with optional reason."""
    service = DeliveryService(db)
    delivery = service.get_delivery(delivery_id, business_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    reassign_driver(db, delivery, body.new_driver_id, reason=body.reason)
    db.refresh(delivery)
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


# ══════════════════════════════════════════════════════════════════════════════
# Report endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/reports/delivery-times")
async def delivery_times_report(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    current_user: User = Depends(has_permission("deliveries:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get delivery time statistics (avg, fastest, slowest variance)."""
    svc = DeliveryReportService(db)
    return svc.delivery_time_report(business_id, date_from, date_to)


@router.get("/reports/zone-performance")
async def zone_performance_report(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    current_user: User = Depends(has_permission("deliveries:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get delivery performance breakdown per zone."""
    svc = DeliveryReportService(db)
    return svc.zone_performance_report(business_id, date_from, date_to)


@router.get("/reports/cost-analysis")
async def cost_analysis_report(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    current_user: User = Depends(has_permission("deliveries:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get delivery cost analysis (total fees, collected, lost)."""
    svc = DeliveryReportService(db)
    return svc.cost_analysis_report(business_id, date_from, date_to)


@router.get("/reports/driver-comparison")
async def driver_comparison_report(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    current_user: User = Depends(has_permission("deliveries:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Compare driver performance across the team."""
    svc = DeliveryReportService(db)
    return svc.driver_comparison_report(business_id, date_from, date_to)
