"""Auto-assignment service for delivery management.

Assigns pending deliveries to the best available driver using:
1. Availability and active status checks
2. Workload balancing (fewest active deliveries first)
3. Proximity ranking when driver locations are known
4. Manual reassignment with reason tracking
"""

from typing import Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.delivery import Delivery, DeliveryStatus, Driver
from app.services.delivery_fee_service import _haversine_km


def _active_delivery_count(db: Session, driver_id: str) -> int:
    """Count non-terminal deliveries currently assigned to a driver."""
    terminal = {DeliveryStatus.DELIVERED, DeliveryStatus.FAILED, DeliveryStatus.RETURNED}
    return (
        db.query(func.count(Delivery.id))
        .filter(
            Delivery.driver_id == driver_id,
            Delivery.deleted_at.is_(None),
            ~Delivery.status.in_(terminal),
        )
        .scalar()
        or 0
    )


def get_available_drivers(db: Session, business_id: str) -> List[Dict]:
    """Return available drivers with their current workload, sorted by fewest active.

    Each dict includes: driver (model), active_count, lat, lng.
    """
    drivers = (
        db.query(Driver)
        .filter(
            Driver.business_id == business_id,
            Driver.is_active.is_(True),
            Driver.is_available.is_(True),
            Driver.deleted_at.is_(None),
        )
        .all()
    )
    result = []
    for d in drivers:
        count = _active_delivery_count(db, str(d.id))
        max_c = d.max_concurrent or 5
        if count < max_c:
            result.append({
                "driver": d,
                "active_count": count,
                "lat": float(d.current_lat) if d.current_lat else None,
                "lng": float(d.current_lng) if d.current_lng else None,
            })
    result.sort(key=lambda x: x["active_count"])
    return result


def auto_assign(
    db: Session,
    delivery: Delivery,
    business_id: str,
    delivery_lat: Optional[float] = None,
    delivery_lng: Optional[float] = None,
) -> Optional[Driver]:
    """Assign the best driver to a delivery.

    Selection priority:
    1. Available and under max concurrent limit
    2. Closest to the delivery address (if locations known)
    3. Fewest active deliveries (workload balance)

    Returns the assigned Driver or None if no driver is available.
    """
    candidates = get_available_drivers(db, business_id)
    if not candidates:
        return None

    # Score candidates: lower is better
    def score(c: Dict) -> Tuple[float, int]:
        dist = float("inf")
        if delivery_lat and delivery_lng and c["lat"] and c["lng"]:
            dist = _haversine_km(c["lat"], c["lng"], delivery_lat, delivery_lng)
        return (dist, c["active_count"])

    candidates.sort(key=score)
    best = candidates[0]["driver"]

    delivery.driver_id = best.id
    if delivery.status == DeliveryStatus.PENDING:
        delivery.status = DeliveryStatus.ASSIGNED
    db.commit()
    db.refresh(delivery)
    return best


def reassign_driver(
    db: Session,
    delivery: Delivery,
    new_driver_id: str,
    reason: Optional[str] = None,
) -> Driver:
    """Manually reassign a delivery to a different driver.

    Stores the previous driver and reason in delivery notes.
    """
    old_driver_id = str(delivery.driver_id) if delivery.driver_id else "none"
    note = f"[Reassigned] from {old_driver_id} → {new_driver_id}"
    if reason:
        note += f": {reason}"

    existing_notes = delivery.delivery_notes or ""
    delivery.delivery_notes = (
        f"{existing_notes}\n{note}" if existing_notes else note
    )
    delivery.driver_id = new_driver_id
    if delivery.status == DeliveryStatus.PENDING:
        delivery.status = DeliveryStatus.ASSIGNED
    db.commit()
    db.refresh(delivery)

    return db.query(Driver).filter(Driver.id == new_driver_id).first()


def get_driver_workload(db: Session, business_id: str) -> List[Dict]:
    """Get workload summary for all active drivers in a business.

    Returns a list sorted by active delivery count descending.
    """
    drivers = (
        db.query(Driver)
        .filter(
            Driver.business_id == business_id,
            Driver.is_active.is_(True),
            Driver.deleted_at.is_(None),
        )
        .all()
    )
    result = []
    for d in drivers:
        active = _active_delivery_count(db, str(d.id))
        result.append({
            "driver_id": str(d.id),
            "name": d.name,
            "phone": d.phone,
            "is_available": d.is_available,
            "active_deliveries": active,
            "max_concurrent": d.max_concurrent or 5,
            "utilization_pct": round(active / (d.max_concurrent or 5) * 100, 1),
        })
    result.sort(key=lambda x: x["active_deliveries"], reverse=True)
    return result
