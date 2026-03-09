"""Fee calculation service for delivery management.

Supports multiple fee strategies:
- **flat**: Fixed fee per zone
- **distance**: Base fee + per-km charge
- **order_value**: Percentage of order total or free above threshold
- **combined**: Base fee + distance surcharge, waived above threshold
"""

import math
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional

from app.models.delivery import DeliveryZone


TWO_PLACES = Decimal("0.01")


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate the great-circle distance between two lat/lng points (km).

    Uses the Haversine formula. Accurate enough for delivery-range distances.
    """
    R = 6371.0  # Earth radius in kilometres
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def calculate_fee(
    zone: DeliveryZone,
    order_total: Decimal = Decimal("0"),
    delivery_lat: Optional[float] = None,
    delivery_lng: Optional[float] = None,
) -> Dict:
    """Calculate delivery fee for a zone, order total, and optional coordinates.

    Returns a dict with:
      - fee: Final delivery fee (Decimal)
      - distance_km: Calculated distance or None
      - free_delivery: Whether the fee was waived
      - breakdown: Human-readable explanation
    """
    fee_type = (zone.fee_type or "flat").lower()
    base_fee = Decimal(str(zone.delivery_fee or 0))
    distance_km: Optional[float] = None
    free_delivery = False
    breakdown_parts = []

    # Check free-delivery threshold first (applies to all fee types)
    threshold = zone.free_delivery_threshold
    if threshold and order_total >= Decimal(str(threshold)):
        return {
            "fee": Decimal("0.00"),
            "distance_km": None,
            "free_delivery": True,
            "breakdown": f"Free delivery (order ≥ R{threshold})",
        }

    # Calculate distance if coordinates are provided
    if delivery_lat is not None and delivery_lng is not None:
        center_lat = float(zone.center_lat or 0)
        center_lng = float(zone.center_lng or 0)
        if center_lat and center_lng:
            distance_km = _haversine_km(center_lat, center_lng, delivery_lat, delivery_lng)

            # Enforce max distance
            max_dist = zone.max_distance_km
            if max_dist and distance_km > float(max_dist):
                return {
                    "fee": Decimal("-1"),
                    "distance_km": round(distance_km, 2),
                    "free_delivery": False,
                    "breakdown": f"Outside delivery range ({distance_km:.1f} km > {max_dist} km max)",
                }

    # ── Fee strategies ────────────────────────────────────────────
    if fee_type == "flat":
        fee = base_fee
        breakdown_parts.append(f"Flat fee R{base_fee}")

    elif fee_type == "distance":
        fee = base_fee
        breakdown_parts.append(f"Base fee R{base_fee}")
        if distance_km is not None:
            per_km = Decimal(str(zone.fee_per_km or 0))
            km_charge = (per_km * Decimal(str(round(distance_km, 2)))).quantize(
                TWO_PLACES, rounding=ROUND_HALF_UP
            )
            fee += km_charge
            breakdown_parts.append(f"+ R{per_km}/km × {distance_km:.1f} km = R{km_charge}")

    elif fee_type == "order_value":
        # Free above threshold (already handled above). Otherwise flat fee.
        fee = base_fee
        breakdown_parts.append(f"Standard fee R{base_fee}")
        min_order = Decimal(str(zone.min_order_amount or 0))
        if min_order and order_total < min_order:
            return {
                "fee": Decimal("-1"),
                "distance_km": distance_km,
                "free_delivery": False,
                "breakdown": f"Minimum order R{min_order} not met (order: R{order_total})",
            }

    elif fee_type == "combined":
        fee = base_fee
        breakdown_parts.append(f"Base fee R{base_fee}")
        if distance_km is not None:
            per_km = Decimal(str(zone.fee_per_km or 0))
            km_charge = (per_km * Decimal(str(round(distance_km, 2)))).quantize(
                TWO_PLACES, rounding=ROUND_HALF_UP
            )
            fee += km_charge
            breakdown_parts.append(f"+ R{per_km}/km × {distance_km:.1f} km = R{km_charge}")

    else:
        # Unknown fee type — fall back to flat
        fee = base_fee
        breakdown_parts.append(f"Flat fee R{base_fee}")

    fee = fee.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

    return {
        "fee": fee,
        "distance_km": round(distance_km, 2) if distance_km is not None else None,
        "free_delivery": free_delivery,
        "breakdown": " ".join(breakdown_parts),
    }
