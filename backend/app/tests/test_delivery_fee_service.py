"""Tests for delivery fee calculation service."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.models.delivery import DeliveryZone
from app.services.delivery_fee_service import _haversine_km, calculate_fee

BIZ = uuid4()


def _mock_zone(**kw):
    """Build a MagicMock that behaves like a DeliveryZone row."""
    z = MagicMock(spec=DeliveryZone)
    z.id = kw.get("id", uuid4())
    z.business_id = kw.get("business_id", BIZ)
    z.name = kw.get("name", "Test Zone")
    z.fee_type = kw.get("fee_type", "flat")
    z.delivery_fee = kw.get("delivery_fee", Decimal("50.00"))
    z.fee_per_km = kw.get("fee_per_km", Decimal("0"))
    z.min_order_amount = kw.get("min_order_amount", Decimal("0"))
    z.free_delivery_threshold = kw.get("free_delivery_threshold", None)
    z.max_distance_km = kw.get("max_distance_km", None)
    z.center_lat = kw.get("center_lat", None)
    z.center_lng = kw.get("center_lng", None)
    z.is_active = kw.get("is_active", True)
    return z


# ── Haversine tests ─────────────────────────────────────────────


class TestHaversineKm:
    """Tests for the _haversine_km helper."""

    def test_same_point_returns_zero(self):
        assert _haversine_km(-26.2041, 28.0473, -26.2041, 28.0473) == 0.0

    def test_joburg_to_pretoria(self):
        """Johannesburg CBD to Pretoria CBD is roughly 55-60 km."""
        dist = _haversine_km(-26.2041, 28.0473, -25.7479, 28.2293)
        assert 50 < dist < 65, f"Expected ~58 km, got {dist:.1f} km"

    def test_antipodal_points(self):
        """North Pole to South Pole ≈ half Earth circumference ≈ 20 015 km."""
        dist = _haversine_km(90, 0, -90, 0)
        assert 20_000 < dist < 20_050

    def test_equatorial_quarter(self):
        """0,0 to 0,90 is roughly a quarter of the equator ≈ 10 018 km."""
        dist = _haversine_km(0, 0, 0, 90)
        assert 10_000 < dist < 10_050

    def test_symmetry(self):
        """Distance A→B should equal B→A."""
        d1 = _haversine_km(-26.2041, 28.0473, -25.7479, 28.2293)
        d2 = _haversine_km(-25.7479, 28.2293, -26.2041, 28.0473)
        assert d1 == pytest.approx(d2)

    def test_short_distance(self):
        """Two points ~1.1 km apart in Joburg."""
        dist = _haversine_km(-26.2041, 28.0473, -26.1941, 28.0473)
        assert 1.0 < dist < 1.2


# ── Flat fee tests ───────────────────────────────────────────────


class TestCalculateFeeFlatStrategy:
    """Tests for fee_type='flat'."""

    def test_returns_base_fee(self):
        zone = _mock_zone(fee_type="flat", delivery_fee=Decimal("35.00"))
        result = calculate_fee(zone)
        assert result["fee"] == Decimal("35.00")
        assert result["free_delivery"] is False
        assert result["distance_km"] is None
        assert "Flat fee" in result["breakdown"]

    def test_handles_none_delivery_fee(self):
        zone = _mock_zone(fee_type="flat", delivery_fee=None)
        result = calculate_fee(zone)
        assert result["fee"] == Decimal("0.00")

    def test_breakdown_text(self):
        zone = _mock_zone(fee_type="flat", delivery_fee=Decimal("25.50"))
        result = calculate_fee(zone)
        assert "R25.50" in result["breakdown"]


# ── Free delivery threshold tests ────────────────────────────────


class TestFreeDeliveryThreshold:
    """Threshold check is fee-type-agnostic."""

    def test_order_above_threshold_is_free(self):
        zone = _mock_zone(
            fee_type="flat",
            delivery_fee=Decimal("50.00"),
            free_delivery_threshold=Decimal("500.00"),
        )
        result = calculate_fee(zone, order_total=Decimal("600.00"))
        assert result["fee"] == Decimal("0.00")
        assert result["free_delivery"] is True
        assert "Free delivery" in result["breakdown"]

    def test_order_equal_to_threshold_is_free(self):
        zone = _mock_zone(
            fee_type="distance",
            delivery_fee=Decimal("30.00"),
            free_delivery_threshold=Decimal("500.00"),
        )
        result = calculate_fee(zone, order_total=Decimal("500.00"))
        assert result["fee"] == Decimal("0.00")
        assert result["free_delivery"] is True

    def test_order_below_threshold_not_free(self):
        zone = _mock_zone(
            fee_type="flat",
            delivery_fee=Decimal("50.00"),
            free_delivery_threshold=Decimal("500.00"),
        )
        result = calculate_fee(zone, order_total=Decimal("499.99"))
        assert result["fee"] == Decimal("50.00")
        assert result["free_delivery"] is False

    def test_none_threshold_never_free(self):
        zone = _mock_zone(
            fee_type="flat",
            delivery_fee=Decimal("50.00"),
            free_delivery_threshold=None,
        )
        result = calculate_fee(zone, order_total=Decimal("99999.00"))
        assert result["fee"] == Decimal("50.00")
        assert result["free_delivery"] is False


# ── Distance fee tests ───────────────────────────────────────────


class TestCalculateFeeDistanceStrategy:
    """Tests for fee_type='distance'."""

    def test_base_plus_per_km(self):
        zone = _mock_zone(
            fee_type="distance",
            delivery_fee=Decimal("20.00"),
            fee_per_km=Decimal("5.00"),
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
        )
        result = calculate_fee(
            zone,
            delivery_lat=-26.1041,
            delivery_lng=28.0473,
        )
        assert result["fee"] > Decimal("20.00")
        assert result["distance_km"] is not None
        assert result["distance_km"] > 0

    def test_no_coordinates_returns_base_only(self):
        zone = _mock_zone(
            fee_type="distance",
            delivery_fee=Decimal("20.00"),
            fee_per_km=Decimal("5.00"),
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
        )
        result = calculate_fee(zone)
        assert result["fee"] == Decimal("20.00")
        assert result["distance_km"] is None

    def test_zero_center_coords_skips_distance(self):
        """If center_lat/center_lng are 0, distance should not be calculated."""
        zone = _mock_zone(
            fee_type="distance",
            delivery_fee=Decimal("20.00"),
            fee_per_km=Decimal("5.00"),
            center_lat=Decimal("0"),
            center_lng=Decimal("0"),
        )
        result = calculate_fee(
            zone,
            delivery_lat=-26.2041,
            delivery_lng=28.0473,
        )
        assert result["fee"] == Decimal("20.00")
        assert result["distance_km"] is None

    def test_fee_quantized_to_two_decimal_places(self):
        zone = _mock_zone(
            fee_type="distance",
            delivery_fee=Decimal("10.00"),
            fee_per_km=Decimal("3.33"),
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
        )
        result = calculate_fee(
            zone,
            delivery_lat=-26.1041,
            delivery_lng=28.0473,
        )
        fee_str = str(result["fee"])
        assert "." in fee_str
        decimals = fee_str.split(".")[1]
        assert len(decimals) <= 2

    def test_breakdown_includes_per_km_info(self):
        zone = _mock_zone(
            fee_type="distance",
            delivery_fee=Decimal("10.00"),
            fee_per_km=Decimal("5.00"),
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
        )
        result = calculate_fee(
            zone,
            delivery_lat=-26.1041,
            delivery_lng=28.0473,
        )
        assert "/km" in result["breakdown"]
        assert "Base fee" in result["breakdown"]


# ── Order value fee tests ────────────────────────────────────────


class TestCalculateFeeOrderValueStrategy:
    """Tests for fee_type='order_value'."""

    def test_min_order_not_met_returns_negative_one(self):
        zone = _mock_zone(
            fee_type="order_value",
            delivery_fee=Decimal("30.00"),
            min_order_amount=Decimal("100.00"),
        )
        result = calculate_fee(zone, order_total=Decimal("50.00"))
        assert result["fee"] == Decimal("-1")
        assert "Minimum order" in result["breakdown"]

    def test_standard_fee_when_above_min(self):
        zone = _mock_zone(
            fee_type="order_value",
            delivery_fee=Decimal("30.00"),
            min_order_amount=Decimal("100.00"),
        )
        result = calculate_fee(zone, order_total=Decimal("150.00"))
        assert result["fee"] == Decimal("30.00")
        assert "Standard fee" in result["breakdown"]

    def test_order_equal_to_min_passes(self):
        zone = _mock_zone(
            fee_type="order_value",
            delivery_fee=Decimal("30.00"),
            min_order_amount=Decimal("100.00"),
        )
        result = calculate_fee(zone, order_total=Decimal("100.00"))
        assert result["fee"] == Decimal("30.00")

    def test_zero_min_order_always_passes(self):
        zone = _mock_zone(
            fee_type="order_value",
            delivery_fee=Decimal("25.00"),
            min_order_amount=Decimal("0"),
        )
        result = calculate_fee(zone, order_total=Decimal("10.00"))
        assert result["fee"] == Decimal("25.00")


# ── Combined fee tests ───────────────────────────────────────────


class TestCalculateFeeCombinedStrategy:
    """Tests for fee_type='combined'."""

    def test_base_plus_distance_surcharge(self):
        zone = _mock_zone(
            fee_type="combined",
            delivery_fee=Decimal("15.00"),
            fee_per_km=Decimal("4.00"),
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
        )
        result = calculate_fee(
            zone,
            delivery_lat=-26.1041,
            delivery_lng=28.0473,
        )
        assert result["fee"] > Decimal("15.00")
        assert result["distance_km"] is not None
        assert "Base fee" in result["breakdown"]
        assert "/km" in result["breakdown"]

    def test_combined_no_coords_returns_base(self):
        zone = _mock_zone(
            fee_type="combined",
            delivery_fee=Decimal("15.00"),
            fee_per_km=Decimal("4.00"),
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
        )
        result = calculate_fee(zone)
        assert result["fee"] == Decimal("15.00")
        assert result["distance_km"] is None


# ── Max distance exceeded ────────────────────────────────────────


class TestMaxDistanceExceeded:
    """When delivery point is beyond the zone's max_distance_km."""

    def test_returns_negative_one_fee(self):
        zone = _mock_zone(
            fee_type="flat",
            delivery_fee=Decimal("50.00"),
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
            max_distance_km=Decimal("5.00"),
        )
        # ~11 km away
        result = calculate_fee(
            zone,
            delivery_lat=-26.1041,
            delivery_lng=28.0473,
        )
        assert result["fee"] == Decimal("-1")
        assert result["free_delivery"] is False
        assert "Outside delivery range" in result["breakdown"]
        assert result["distance_km"] is not None

    def test_within_max_distance_is_ok(self):
        zone = _mock_zone(
            fee_type="flat",
            delivery_fee=Decimal("50.00"),
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
            max_distance_km=Decimal("100.00"),
        )
        result = calculate_fee(
            zone,
            delivery_lat=-26.1941,
            delivery_lng=28.0473,
        )
        assert result["fee"] == Decimal("50.00")


# ── Unknown / fallback fee type ──────────────────────────────────


class TestUnknownFeeType:
    """Unknown fee_type falls back to flat."""

    def test_unknown_type_uses_flat(self):
        zone = _mock_zone(fee_type="banana", delivery_fee=Decimal("42.00"))
        result = calculate_fee(zone)
        assert result["fee"] == Decimal("42.00")
        assert "Flat fee" in result["breakdown"]

    def test_none_fee_type_defaults_to_flat(self):
        zone = _mock_zone(fee_type=None, delivery_fee=Decimal("42.00"))
        result = calculate_fee(zone)
        assert result["fee"] == Decimal("42.00")
        assert "Flat fee" in result["breakdown"]


# ── Edge cases ───────────────────────────────────────────────────


class TestEdgeCases:
    """Miscellaneous edge cases."""

    def test_default_order_total_is_zero(self):
        zone = _mock_zone(fee_type="flat", delivery_fee=Decimal("10.00"))
        result = calculate_fee(zone)
        assert result["fee"] == Decimal("10.00")

    def test_fee_always_quantized(self):
        """Even flat fees get quantized to 2 decimal places."""
        zone = _mock_zone(fee_type="flat", delivery_fee=Decimal("10.999"))
        result = calculate_fee(zone)
        assert result["fee"] == Decimal("11.00")

    def test_free_delivery_threshold_as_zero_does_not_trigger(self):
        """A threshold of 0 is falsy, so free delivery should not apply."""
        zone = _mock_zone(
            fee_type="flat",
            delivery_fee=Decimal("50.00"),
            free_delivery_threshold=Decimal("0"),
        )
        result = calculate_fee(zone, order_total=Decimal("100.00"))
        assert result["fee"] == Decimal("50.00")
        assert result["free_delivery"] is False

    def test_partial_coords_ignored(self):
        """Only lat provided (no lng) — distance not calculated."""
        zone = _mock_zone(
            fee_type="distance",
            delivery_fee=Decimal("20.00"),
            fee_per_km=Decimal("5.00"),
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
        )
        result = calculate_fee(zone, delivery_lat=-26.1041)
        assert result["fee"] == Decimal("20.00")
        assert result["distance_km"] is None

    def test_none_fee_per_km_treated_as_zero(self):
        zone = _mock_zone(
            fee_type="distance",
            delivery_fee=Decimal("20.00"),
            fee_per_km=None,
            center_lat=Decimal("-26.2041"),
            center_lng=Decimal("28.0473"),
        )
        result = calculate_fee(
            zone,
            delivery_lat=-26.1041,
            delivery_lng=28.0473,
        )
        assert result["fee"] == Decimal("20.00")

    def test_result_dict_has_required_keys(self):
        zone = _mock_zone(fee_type="flat", delivery_fee=Decimal("10.00"))
        result = calculate_fee(zone)
        assert set(result.keys()) == {"fee", "distance_km", "free_delivery", "breakdown"}
