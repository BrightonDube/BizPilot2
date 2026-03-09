"""Zone matching service for delivery management.

Determines which delivery zone an address/coordinate falls into, supporting:
- **flat**: Always matches (manual zone selection)
- **radius**: Point-in-circle using Haversine distance
- **polygon**: Point-in-polygon using ray-casting algorithm
- **postcode**: Exact postcode lookup
"""

from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.delivery import DeliveryZone
from app.services.delivery_fee_service import _haversine_km


def _point_in_polygon(lat: float, lng: float, polygon: list) -> bool:
    """Ray-casting algorithm for point-in-polygon test.

    ``polygon`` is a list of [lat, lng] pairs forming a closed ring.
    """
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        yi, xi = float(polygon[i][0]), float(polygon[i][1])
        yj, xj = float(polygon[j][0]), float(polygon[j][1])
        if ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / (yj - yi) + xi
        ):
            inside = not inside
        j = i
    return inside


def match_zone_by_coords(
    db: Session,
    business_id: str,
    lat: float,
    lng: float,
) -> Optional[DeliveryZone]:
    """Find the best matching active zone for given coordinates.

    Checks radius zones first (cheapest match by distance), then polygon zones,
    then returns the first flat zone as a fallback.
    """
    zones: List[DeliveryZone] = (
        db.query(DeliveryZone)
        .filter(
            DeliveryZone.business_id == business_id,
            DeliveryZone.is_active.is_(True),
            DeliveryZone.deleted_at.is_(None),
        )
        .all()
    )
    if not zones:
        return None

    radius_matches: List[Tuple[float, DeliveryZone]] = []
    polygon_matches: List[DeliveryZone] = []
    flat_fallback: Optional[DeliveryZone] = None

    for zone in zones:
        zt = (zone.zone_type or "flat").lower()

        if zt == "radius":
            c_lat = float(zone.center_lat or 0)
            c_lng = float(zone.center_lng or 0)
            r_km = float(zone.radius_km or 0)
            if c_lat and c_lng and r_km:
                dist = _haversine_km(c_lat, c_lng, lat, lng)
                if dist <= r_km:
                    radius_matches.append((dist, zone))

        elif zt == "polygon":
            boundary = zone.boundary
            if isinstance(boundary, list) and len(boundary) >= 3:
                if _point_in_polygon(lat, lng, boundary):
                    polygon_matches.append(zone)

        elif zt == "flat" and flat_fallback is None:
            flat_fallback = zone

    # Prefer the closest radius zone
    if radius_matches:
        radius_matches.sort(key=lambda x: x[0])
        return radius_matches[0][1]

    # Then polygon zones (first match)
    if polygon_matches:
        return polygon_matches[0]

    # Fall back to flat
    return flat_fallback


def match_zone_by_postcode(
    db: Session,
    business_id: str,
    postcode: str,
) -> Optional[DeliveryZone]:
    """Find a zone matching the given postcode."""
    zones: List[DeliveryZone] = (
        db.query(DeliveryZone)
        .filter(
            DeliveryZone.business_id == business_id,
            DeliveryZone.is_active.is_(True),
            DeliveryZone.deleted_at.is_(None),
            DeliveryZone.zone_type == "postcode",
        )
        .all()
    )
    clean = postcode.strip()
    for zone in zones:
        if isinstance(zone.postcodes, list) and clean in zone.postcodes:
            return zone
    return None


def check_address_in_zone(
    db: Session,
    business_id: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    postcode: Optional[str] = None,
) -> Optional[DeliveryZone]:
    """Unified entry point: match by coords or postcode.

    Tries coordinate-based matching first, then postcode.
    """
    if lat is not None and lng is not None:
        zone = match_zone_by_coords(db, business_id, lat, lng)
        if zone:
            return zone

    if postcode:
        zone = match_zone_by_postcode(db, business_id, postcode)
        if zone:
            return zone

    return None
