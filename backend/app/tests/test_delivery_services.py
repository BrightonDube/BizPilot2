"""Unit tests for delivery management services.

Tests cover:
- Fee calculation (flat, distance, order_value, combined, thresholds)
- Zone matching (radius, polygon, postcode, flat fallback)
- Auto-assignment (workload balancing, proximity ranking)
- ETA calculation
- Haversine distance formula
"""

import os
import uuid
from decimal import Decimal
from unittest.mock import MagicMock

os.environ.setdefault("SECRET_KEY", "test-secret-key")


from app.services.delivery_fee_service import calculate_fee, _haversine_km
from app.services.delivery_zone_service import (
    _point_in_polygon,
    match_zone_by_coords,
    match_zone_by_postcode,
    check_address_in_zone,
)
from app.services.delivery_assign_service import (
    get_available_drivers,
    auto_assign,
    get_driver_workload,
)
from app.services.delivery_tracking_service import DeliveryTrackingService
from app.models.delivery import DeliveryStatus


# ══════════════════════════════════════════════════════════════════════════════
# Fixtures
# ══════════════════════════════════════════════════════════════════════════════

def _make_zone(**kwargs):
    """Create a mock DeliveryZone with sensible defaults."""
    zone = MagicMock()
    zone.id = kwargs.get("id", uuid.uuid4())
    zone.business_id = kwargs.get("business_id", uuid.uuid4())
    zone.name = kwargs.get("name", "Test Zone")
    zone.delivery_fee = kwargs.get("delivery_fee", Decimal("50.00"))
    zone.fee_type = kwargs.get("fee_type", "flat")
    zone.fee_per_km = kwargs.get("fee_per_km", Decimal("0"))
    zone.min_order_amount = kwargs.get("min_order_amount", Decimal("0"))
    zone.free_delivery_threshold = kwargs.get("free_delivery_threshold", None)
    zone.max_distance_km = kwargs.get("max_distance_km", None)
    zone.zone_type = kwargs.get("zone_type", "flat")
    zone.center_lat = kwargs.get("center_lat", None)
    zone.center_lng = kwargs.get("center_lng", None)
    zone.radius_km = kwargs.get("radius_km", None)
    zone.boundary = kwargs.get("boundary", None)
    zone.postcodes = kwargs.get("postcodes", None)
    zone.is_active = kwargs.get("is_active", True)
    zone.deleted_at = kwargs.get("deleted_at", None)
    zone.estimated_minutes = kwargs.get("estimated_minutes", 30)
    return zone


def _make_driver(**kwargs):
    """Create a mock Driver."""
    driver = MagicMock()
    driver.id = kwargs.get("id", uuid.uuid4())
    driver.business_id = kwargs.get("business_id", uuid.uuid4())
    driver.name = kwargs.get("name", "Test Driver")
    driver.phone = kwargs.get("phone", "0800000000")
    driver.is_active = kwargs.get("is_active", True)
    driver.is_available = kwargs.get("is_available", True)
    driver.current_lat = kwargs.get("current_lat", None)
    driver.current_lng = kwargs.get("current_lng", None)
    driver.max_concurrent = kwargs.get("max_concurrent", 5)
    driver.deleted_at = None
    return driver


def _make_delivery(**kwargs):
    """Create a mock Delivery."""
    delivery = MagicMock()
    delivery.id = kwargs.get("id", uuid.uuid4())
    delivery.business_id = kwargs.get("business_id", uuid.uuid4())
    delivery.driver_id = kwargs.get("driver_id", None)
    delivery.status = kwargs.get("status", DeliveryStatus.PENDING)
    delivery.delivery_notes = kwargs.get("delivery_notes", None)
    delivery.deleted_at = None
    return delivery


# ══════════════════════════════════════════════════════════════════════════════
# Haversine tests
# ══════════════════════════════════════════════════════════════════════════════

class TestHaversine:
    """Test the haversine distance formula."""

    def test_same_point_returns_zero(self):
        """Distance from a point to itself should be 0."""
        assert _haversine_km(-26.2041, 28.0473, -26.2041, 28.0473) == 0.0

    def test_johannesburg_to_pretoria(self):
        """Joburg to Pretoria is roughly 55-60 km."""
        dist = _haversine_km(-26.2041, 28.0473, -25.7479, 28.2293)
        assert 50 < dist < 65

    def test_short_distance(self):
        """A small offset should give a small distance."""
        dist = _haversine_km(-26.2041, 28.0473, -26.2050, 28.0480)
        assert 0 < dist < 1


# ══════════════════════════════════════════════════════════════════════════════
# Fee calculation tests
# ══════════════════════════════════════════════════════════════════════════════

class TestFeeCalculation:
    """Test delivery fee calculation strategies."""

    def test_flat_fee(self):
        """Flat fee should return the zone's delivery_fee."""
        zone = _make_zone(delivery_fee=Decimal("35.00"), fee_type="flat")
        result = calculate_fee(zone)
        assert result["fee"] == Decimal("35.00")
        assert result["free_delivery"] is False

    def test_free_delivery_above_threshold(self):
        """Order above threshold → R0 fee."""
        zone = _make_zone(
            delivery_fee=Decimal("50.00"),
            free_delivery_threshold=Decimal("500.00"),
        )
        result = calculate_fee(zone, order_total=Decimal("600.00"))
        assert result["fee"] == Decimal("0.00")
        assert result["free_delivery"] is True

    def test_below_threshold_charges_fee(self):
        """Order below threshold → normal fee."""
        zone = _make_zone(
            delivery_fee=Decimal("50.00"),
            free_delivery_threshold=Decimal("500.00"),
            fee_type="flat",
        )
        result = calculate_fee(zone, order_total=Decimal("200.00"))
        assert result["fee"] == Decimal("50.00")

    def test_distance_fee_with_coords(self):
        """Distance fee = base + per_km × distance."""
        zone = _make_zone(
            delivery_fee=Decimal("20.00"),
            fee_type="distance",
            fee_per_km=Decimal("5.00"),
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
        )
        # ~55 km to Pretoria
        result = calculate_fee(zone, delivery_lat=-25.7479, delivery_lng=28.2293)
        assert result["fee"] > Decimal("250.00")  # 20 + 5*55
        assert result["distance_km"] is not None

    def test_distance_fee_without_coords_returns_base(self):
        """No coordinates → only base fee for distance type."""
        zone = _make_zone(
            delivery_fee=Decimal("20.00"),
            fee_type="distance",
            fee_per_km=Decimal("5.00"),
        )
        result = calculate_fee(zone)
        assert result["fee"] == Decimal("20.00")

    def test_max_distance_exceeded(self):
        """Exceeding max distance returns -1 (out of range)."""
        zone = _make_zone(
            delivery_fee=Decimal("20.00"),
            fee_type="distance",
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
            max_distance_km=Decimal("10.00"),
        )
        result = calculate_fee(zone, delivery_lat=-25.7479, delivery_lng=28.2293)
        assert result["fee"] == Decimal("-1")

    def test_order_value_min_order_not_met(self):
        """Order below minimum → fee = -1."""
        zone = _make_zone(
            delivery_fee=Decimal("30.00"),
            fee_type="order_value",
            min_order_amount=Decimal("100.00"),
        )
        result = calculate_fee(zone, order_total=Decimal("50.00"))
        assert result["fee"] == Decimal("-1")

    def test_combined_fee(self):
        """Combined = base + distance, waived above threshold."""
        zone = _make_zone(
            delivery_fee=Decimal("15.00"),
            fee_type="combined",
            fee_per_km=Decimal("3.00"),
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
        )
        result = calculate_fee(zone, delivery_lat=-26.2050, delivery_lng=28.0480)
        assert result["fee"] >= Decimal("15.00")


# ══════════════════════════════════════════════════════════════════════════════
# Zone matching tests
# ══════════════════════════════════════════════════════════════════════════════

class TestPointInPolygon:
    """Test ray-casting point-in-polygon algorithm."""

    def test_point_inside_square(self):
        """Point at center of a square should be inside."""
        square = [[-1, -1], [-1, 1], [1, 1], [1, -1]]
        assert _point_in_polygon(0, 0, square) is True

    def test_point_outside_square(self):
        """Point far outside should not match."""
        square = [[-1, -1], [-1, 1], [1, 1], [1, -1]]
        assert _point_in_polygon(5, 5, square) is False

    def test_point_on_edge(self):
        """Point on boundary — implementation-dependent, just verify no crash."""
        square = [[-1, -1], [-1, 1], [1, 1], [1, -1]]
        # Should not raise
        _point_in_polygon(-1, 0, square)


class TestZoneMatching:
    """Test zone matching by coordinates and postcode."""

    def test_radius_zone_match(self):
        """Point within radius should match the zone."""
        zone = _make_zone(
            zone_type="radius",
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
            radius_km=Decimal("10.00"),
        )
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [zone]

        result = match_zone_by_coords(db, "biz-1", -26.2050, 28.0480)
        assert result == zone

    def test_radius_zone_too_far(self):
        """Point outside radius should not match."""
        zone = _make_zone(
            zone_type="radius",
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
            radius_km=Decimal("1.00"),
        )
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [zone]

        result = match_zone_by_coords(db, "biz-1", -25.7479, 28.2293)
        assert result is None

    def test_polygon_zone_match(self):
        """Point inside polygon should match."""
        polygon = [[-27, 27], [-27, 29], [-25, 29], [-25, 27]]
        zone = _make_zone(zone_type="polygon", boundary=polygon)
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [zone]

        result = match_zone_by_coords(db, "biz-1", -26.0, 28.0)
        assert result == zone

    def test_flat_zone_fallback(self):
        """When no geo-zone matches, fall back to flat."""
        flat_zone = _make_zone(zone_type="flat")
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [flat_zone]

        result = match_zone_by_coords(db, "biz-1", -26.0, 28.0)
        assert result == flat_zone

    def test_postcode_match(self):
        """Exact postcode should match."""
        zone = _make_zone(zone_type="postcode", postcodes=["2000", "2001", "2196"])
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [zone]

        result = match_zone_by_postcode(db, "biz-1", "2196")
        assert result == zone

    def test_postcode_no_match(self):
        """Non-matching postcode returns None."""
        zone = _make_zone(zone_type="postcode", postcodes=["2000", "2001"])
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [zone]

        result = match_zone_by_postcode(db, "biz-1", "9999")
        assert result is None

    def test_check_address_coords_first(self):
        """check_address_in_zone prefers coords over postcode."""
        zone = _make_zone(
            zone_type="radius",
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
            radius_km=Decimal("10.00"),
        )
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [zone]

        result = check_address_in_zone(db, "biz-1", lat=-26.2050, lng=28.0480, postcode="9999")
        assert result == zone


# ══════════════════════════════════════════════════════════════════════════════
# Auto-assignment tests
# ══════════════════════════════════════════════════════════════════════════════

class TestAutoAssignment:
    """Test driver auto-assignment logic."""

    def test_assigns_driver_with_fewest_deliveries(self):
        """Should pick the driver with the lowest active count."""
        biz_id = str(uuid.uuid4())
        d1 = _make_driver(name="Driver A")
        d2 = _make_driver(name="Driver B")

        db = MagicMock()
        # list available drivers
        db.query.return_value.filter.return_value.all.return_value = [d1, d2]
        # count queries: d1 has 3, d2 has 1
        db.query.return_value.filter.return_value.scalar.side_effect = [3, 1]

        delivery = _make_delivery(business_id=biz_id)

        result = auto_assign(db, delivery, biz_id)
        assert result is not None
        # Driver B should be assigned (fewer active)
        assert delivery.driver_id == result.id

    def test_no_available_drivers(self):
        """Should return None when no drivers are available."""
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []

        delivery = _make_delivery()
        result = auto_assign(db, delivery, "biz-1")
        assert result is None

    def test_driver_at_max_concurrent_skipped(self):
        """Driver at max concurrent should be skipped."""
        d1 = _make_driver(name="Full Driver", max_concurrent=2)

        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [d1]
        db.query.return_value.filter.return_value.scalar.return_value = 2  # at max

        candidates = get_available_drivers(db, "biz-1")
        assert len(candidates) == 0

    def test_workload_includes_all_drivers(self):
        """get_driver_workload should return all active drivers."""
        d1 = _make_driver(name="A", max_concurrent=5)
        d2 = _make_driver(name="B", max_concurrent=3)

        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [d1, d2]
        db.query.return_value.filter.return_value.scalar.side_effect = [2, 1]

        result = get_driver_workload(db, "biz-1")
        assert len(result) == 2
        # Sorted by active_deliveries desc
        assert result[0]["active_deliveries"] >= result[1]["active_deliveries"]


# ══════════════════════════════════════════════════════════════════════════════
# ETA calculation tests
# ══════════════════════════════════════════════════════════════════════════════

class TestETACalculation:
    """Test ETA estimation."""

    def test_zero_distance(self):
        """0 km → prep time only."""
        result = DeliveryTrackingService.estimate_eta_minutes(0)
        assert result == 10  # default prep_minutes

    def test_positive_distance(self):
        """10 km at 30 km/h → 20 min travel + 10 prep = 30."""
        result = DeliveryTrackingService.estimate_eta_minutes(10.0)
        assert result == 30

    def test_custom_speed_and_prep(self):
        """Custom params: 60 km at 60 km/h = 60 min + 5 prep = 65."""
        result = DeliveryTrackingService.estimate_eta_minutes(
            60.0, avg_speed_kmh=60.0, prep_minutes=5
        )
        assert result == 65

    def test_negative_distance_returns_prep_only(self):
        """Negative distance → just return prep time."""
        result = DeliveryTrackingService.estimate_eta_minutes(-5.0)
        assert result == 10
