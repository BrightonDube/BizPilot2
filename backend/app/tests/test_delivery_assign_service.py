"""Comprehensive unit tests for delivery_assign_service module."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from unittest.mock import MagicMock, call, patch

import pytest

from app.models.delivery import Delivery, DeliveryStatus, Driver
from app.services.delivery_assign_service import (
    _active_delivery_count,
    auto_assign,
    get_available_drivers,
    get_driver_workload,
    reassign_driver,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_driver(**overrides):
    """Create a MagicMock Driver with sensible defaults."""
    d = MagicMock(spec=Driver)
    d.id = overrides.get("id", uuid.uuid4())
    d.business_id = overrides.get("business_id", uuid.uuid4())
    d.name = overrides.get("name", "Test Driver")
    d.phone = overrides.get("phone", "0821234567")
    d.is_active = overrides.get("is_active", True)
    d.is_available = overrides.get("is_available", True)
    d.max_concurrent = overrides.get("max_concurrent", 5)
    d.current_lat = overrides.get("current_lat", None)
    d.current_lng = overrides.get("current_lng", None)
    d.deleted_at = overrides.get("deleted_at", None)
    return d


def _make_delivery(**overrides):
    """Create a MagicMock Delivery with sensible defaults."""
    d = MagicMock(spec=Delivery)
    d.id = overrides.get("id", uuid.uuid4())
    d.business_id = overrides.get("business_id", uuid.uuid4())
    d.driver_id = overrides.get("driver_id", None)
    d.status = overrides.get("status", DeliveryStatus.PENDING)
    d.delivery_notes = overrides.get("delivery_notes", None)
    d.deleted_at = overrides.get("deleted_at", None)
    return d


def _mock_chain(terminal_value, terminal_method="scalar"):
    """Build a fluent mock chain: .query().filter().scalar() / .all() / .first()."""
    chain = MagicMock()
    chain.filter.return_value = chain
    setattr(chain, terminal_method, MagicMock(return_value=terminal_value))
    return chain


# ---------------------------------------------------------------------------
# _active_delivery_count
# ---------------------------------------------------------------------------

class TestActiveDeliveryCount:
    def test_returns_count(self):
        db = MagicMock()
        chain = _mock_chain(3, "scalar")
        db.query.return_value = chain

        assert _active_delivery_count(db, "driver-1") == 3

    def test_returns_zero_when_scalar_is_none(self):
        db = MagicMock()
        chain = _mock_chain(None, "scalar")
        db.query.return_value = chain

        assert _active_delivery_count(db, "driver-1") == 0

    def test_returns_zero_when_scalar_is_zero(self):
        db = MagicMock()
        chain = _mock_chain(0, "scalar")
        db.query.return_value = chain

        # 0 or 0 == 0
        assert _active_delivery_count(db, "driver-1") == 0

    def test_calls_query_with_filter(self):
        db = MagicMock()
        chain = _mock_chain(2, "scalar")
        db.query.return_value = chain

        _active_delivery_count(db, "driver-1")

        db.query.assert_called_once()
        chain.filter.assert_called_once()


# ---------------------------------------------------------------------------
# get_available_drivers
# ---------------------------------------------------------------------------

class TestGetAvailableDrivers:
    def _setup_db(self, drivers, counts):
        """Set up db.query so the first call returns drivers, subsequent calls
        return active-delivery counts via the scalar chain."""
        db = MagicMock()

        driver_chain = _mock_chain(drivers, "all")
        count_chains = [_mock_chain(c, "scalar") for c in counts]

        db.query.side_effect = [driver_chain] + count_chains
        return db

    def test_returns_sorted_by_active_count(self):
        d1 = _make_driver(name="Alice", current_lat=None, current_lng=None)
        d2 = _make_driver(name="Bob", current_lat=None, current_lng=None)
        db = self._setup_db([d1, d2], [3, 1])

        result = get_available_drivers(db, "biz-1")

        assert len(result) == 2
        assert result[0]["driver"] is d2  # Bob has fewer (1)
        assert result[0]["active_count"] == 1
        assert result[1]["driver"] is d1
        assert result[1]["active_count"] == 3

    def test_excludes_drivers_at_max_capacity(self):
        d1 = _make_driver(name="Full", max_concurrent=2)
        db = self._setup_db([d1], [2])  # at capacity

        result = get_available_drivers(db, "biz-1")

        assert result == []

    def test_includes_driver_under_max_capacity(self):
        d1 = _make_driver(name="Available", max_concurrent=3)
        db = self._setup_db([d1], [2])

        result = get_available_drivers(db, "biz-1")

        assert len(result) == 1
        assert result[0]["active_count"] == 2

    def test_default_max_concurrent_is_five(self):
        d1 = _make_driver(max_concurrent=None)
        db = self._setup_db([d1], [4])  # 4 < 5 default

        result = get_available_drivers(db, "biz-1")

        assert len(result) == 1

    def test_default_max_concurrent_excludes_at_five(self):
        d1 = _make_driver(max_concurrent=None)
        db = self._setup_db([d1], [5])  # 5 >= 5 default

        result = get_available_drivers(db, "biz-1")

        assert result == []

    def test_returns_empty_list_when_no_drivers(self):
        db = self._setup_db([], [])

        result = get_available_drivers(db, "biz-1")

        assert result == []

    def test_converts_lat_lng_to_float(self):
        from decimal import Decimal

        d1 = _make_driver(current_lat=Decimal("-26.1234567"), current_lng=Decimal("28.0567890"))
        db = self._setup_db([d1], [0])

        result = get_available_drivers(db, "biz-1")

        assert result[0]["lat"] == pytest.approx(-26.1234567)
        assert result[0]["lng"] == pytest.approx(28.0567890)

    def test_none_lat_lng_stays_none(self):
        d1 = _make_driver(current_lat=None, current_lng=None)
        db = self._setup_db([d1], [0])

        result = get_available_drivers(db, "biz-1")

        assert result[0]["lat"] is None
        assert result[0]["lng"] is None


# ---------------------------------------------------------------------------
# auto_assign
# ---------------------------------------------------------------------------

@patch("app.services.delivery_assign_service._haversine_km")
class TestAutoAssign:
    def _setup_db_for_auto_assign(self, drivers, counts):
        """Mirrors get_available_drivers DB setup."""
        db = MagicMock()
        driver_chain = _mock_chain(drivers, "all")
        count_chains = [_mock_chain(c, "scalar") for c in counts]
        db.query.side_effect = [driver_chain] + count_chains
        return db

    def test_returns_none_when_no_candidates(self, mock_haversine):
        db = self._setup_db_for_auto_assign([], [])
        delivery = _make_delivery()

        result = auto_assign(db, delivery, "biz-1")

        assert result is None
        mock_haversine.assert_not_called()

    def test_assigns_best_driver_by_workload(self, mock_haversine):
        d1 = _make_driver(name="Busy", current_lat=None, current_lng=None)
        d2 = _make_driver(name="Free", current_lat=None, current_lng=None)
        db = self._setup_db_for_auto_assign([d1, d2], [4, 1])
        delivery = _make_delivery(status=DeliveryStatus.PENDING)

        result = auto_assign(db, delivery, "biz-1")

        assert result is d2
        assert delivery.driver_id == d2.id
        assert delivery.status == DeliveryStatus.ASSIGNED
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(delivery)

    def test_assigns_closest_driver_with_location(self, mock_haversine):
        d_far = _make_driver(name="Far", current_lat=-26.0, current_lng=28.0)
        d_near = _make_driver(name="Near", current_lat=-26.1, current_lng=28.1)
        db = self._setup_db_for_auto_assign([d_far, d_near], [1, 1])

        # Far driver is 50km away, near driver is 5km
        mock_haversine.side_effect = lambda lat1, lng1, lat2, lng2: (
            5.0 if lat1 == pytest.approx(-26.1) else 50.0
        )
        delivery = _make_delivery(status=DeliveryStatus.PENDING)

        result = auto_assign(db, delivery, "biz-1", delivery_lat=-26.2, delivery_lng=28.2)

        assert result is d_near

    def test_prefers_closer_driver_over_less_busy(self, mock_haversine):
        d_close_busy = _make_driver(name="CloseBusy", current_lat=-26.1, current_lng=28.1)
        d_far_free = _make_driver(name="FarFree", current_lat=-30.0, current_lng=25.0)
        db = self._setup_db_for_auto_assign([d_close_busy, d_far_free], [3, 0])

        mock_haversine.side_effect = lambda lat1, lng1, lat2, lng2: (
            2.0 if lat1 == pytest.approx(-26.1) else 100.0
        )
        delivery = _make_delivery(status=DeliveryStatus.PENDING)

        result = auto_assign(db, delivery, "biz-1", delivery_lat=-26.2, delivery_lng=28.2)

        # Distance takes priority in tuple sort (2.0, 3) < (100.0, 0)
        assert result is d_close_busy

    def test_does_not_change_status_if_not_pending(self, mock_haversine):
        d1 = _make_driver(current_lat=None, current_lng=None)
        db = self._setup_db_for_auto_assign([d1], [0])
        delivery = _make_delivery(status=DeliveryStatus.ASSIGNED)

        result = auto_assign(db, delivery, "biz-1")

        assert result is d1
        assert delivery.driver_id == d1.id
        # Status should remain ASSIGNED, not changed
        assert delivery.status == DeliveryStatus.ASSIGNED

    def test_no_location_uses_inf_distance(self, mock_haversine):
        """When delivery has no lat/lng, haversine is not called and distance is inf."""
        d1 = _make_driver(name="A", current_lat=-26.0, current_lng=28.0)
        d2 = _make_driver(name="B", current_lat=-26.1, current_lng=28.1)
        db = self._setup_db_for_auto_assign([d1, d2], [2, 1])
        delivery = _make_delivery(status=DeliveryStatus.PENDING)

        result = auto_assign(db, delivery, "biz-1")  # no lat/lng

        # Without location, all distances are inf, so sort by active_count
        mock_haversine.assert_not_called()
        assert result is d2  # fewer active deliveries

    def test_driver_without_location_gets_inf_distance(self, mock_haversine):
        """Driver with no lat/lng should get inf distance even when delivery has location."""
        d_no_loc = _make_driver(name="NoLoc", current_lat=None, current_lng=None)
        d_with_loc = _make_driver(name="WithLoc", current_lat=-26.1, current_lng=28.1)
        db = self._setup_db_for_auto_assign([d_no_loc, d_with_loc], [0, 0])

        mock_haversine.return_value = 5.0
        delivery = _make_delivery(status=DeliveryStatus.PENDING)

        result = auto_assign(db, delivery, "biz-1", delivery_lat=-26.2, delivery_lng=28.2)

        # d_with_loc has finite distance (5.0), d_no_loc has inf
        assert result is d_with_loc

    def test_single_candidate_selected(self, mock_haversine):
        d1 = _make_driver(current_lat=None, current_lng=None)
        db = self._setup_db_for_auto_assign([d1], [0])
        delivery = _make_delivery(status=DeliveryStatus.PENDING)

        result = auto_assign(db, delivery, "biz-1")

        assert result is d1
        assert delivery.driver_id == d1.id


# ---------------------------------------------------------------------------
# reassign_driver
# ---------------------------------------------------------------------------

class TestReassignDriver:
    def _setup_db(self, returned_driver):
        db = MagicMock()
        query_chain = _mock_chain(returned_driver, "first")
        db.query.return_value = query_chain
        return db

    def test_reassign_with_reason(self):
        new_driver = _make_driver(name="New")
        db = self._setup_db(new_driver)
        old_id = uuid.uuid4()
        delivery = _make_delivery(driver_id=old_id, delivery_notes=None, status=DeliveryStatus.ASSIGNED)

        new_id = str(uuid.uuid4())
        result = reassign_driver(db, delivery, new_id, reason="closer to customer")

        assert result is new_driver
        assert delivery.driver_id == new_id
        assert "[Reassigned]" in delivery.delivery_notes
        assert "closer to customer" in delivery.delivery_notes
        assert str(old_id) in delivery.delivery_notes
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(delivery)

    def test_reassign_without_reason(self):
        new_driver = _make_driver(name="New")
        db = self._setup_db(new_driver)
        delivery = _make_delivery(driver_id=None, delivery_notes=None, status=DeliveryStatus.PENDING)

        new_id = str(uuid.uuid4())
        result = reassign_driver(db, delivery, new_id)

        assert result is new_driver
        assert delivery.driver_id == new_id
        assert "[Reassigned]" in delivery.delivery_notes
        assert "none" in delivery.delivery_notes  # old driver was None -> "none"
        # No reason suffix
        assert ":" not in delivery.delivery_notes.split("→")[1]

    def test_reassign_appends_to_existing_notes(self):
        new_driver = _make_driver()
        db = self._setup_db(new_driver)
        delivery = _make_delivery(
            delivery_notes="Previous note here",
            driver_id=uuid.uuid4(),
            status=DeliveryStatus.ASSIGNED,
        )

        new_id = str(uuid.uuid4())
        reassign_driver(db, delivery, new_id, reason="schedule change")

        assert delivery.delivery_notes.startswith("Previous note here\n")
        assert "[Reassigned]" in delivery.delivery_notes

    def test_reassign_sets_assigned_if_pending(self):
        new_driver = _make_driver()
        db = self._setup_db(new_driver)
        delivery = _make_delivery(status=DeliveryStatus.PENDING, delivery_notes=None)

        reassign_driver(db, delivery, str(uuid.uuid4()))

        assert delivery.status == DeliveryStatus.ASSIGNED

    def test_reassign_does_not_change_non_pending_status(self):
        new_driver = _make_driver()
        db = self._setup_db(new_driver)
        delivery = _make_delivery(status=DeliveryStatus.IN_TRANSIT, delivery_notes=None)
        # Keep status as IN_TRANSIT since spec doesn't use MagicMock auto-tracking
        delivery.status = DeliveryStatus.IN_TRANSIT

        reassign_driver(db, delivery, str(uuid.uuid4()))

        assert delivery.status == DeliveryStatus.IN_TRANSIT

    def test_reassign_queries_new_driver(self):
        new_driver = _make_driver()
        db = self._setup_db(new_driver)
        delivery = _make_delivery(delivery_notes=None, status=DeliveryStatus.ASSIGNED)
        new_id = str(uuid.uuid4())

        reassign_driver(db, delivery, new_id)

        db.query.assert_called_with(Driver)


# ---------------------------------------------------------------------------
# get_driver_workload
# ---------------------------------------------------------------------------

class TestGetDriverWorkload:
    def _setup_db(self, drivers, counts):
        db = MagicMock()
        driver_chain = _mock_chain(drivers, "all")
        count_chains = [_mock_chain(c, "scalar") for c in counts]
        db.query.side_effect = [driver_chain] + count_chains
        return db

    def test_returns_workload_for_all_active_drivers(self):
        d1 = _make_driver(name="Alice", phone="111", is_available=True, max_concurrent=5)
        d2 = _make_driver(name="Bob", phone="222", is_available=False, max_concurrent=3)
        db = self._setup_db([d1, d2], [2, 3])

        result = get_driver_workload(db, "biz-1")

        assert len(result) == 2
        names = [r["name"] for r in result]
        assert "Alice" in names
        assert "Bob" in names

    def test_sorted_by_active_deliveries_descending(self):
        d1 = _make_driver(name="Busy")
        d2 = _make_driver(name="Free")
        db = self._setup_db([d1, d2], [5, 1])

        result = get_driver_workload(db, "biz-1")

        assert result[0]["name"] == "Busy"
        assert result[0]["active_deliveries"] == 5
        assert result[1]["name"] == "Free"
        assert result[1]["active_deliveries"] == 1

    def test_utilization_pct_calculation(self):
        d1 = _make_driver(name="Half", max_concurrent=10)
        db = self._setup_db([d1], [5])

        result = get_driver_workload(db, "biz-1")

        assert result[0]["utilization_pct"] == 50.0

    def test_utilization_pct_zero_when_idle(self):
        d1 = _make_driver(max_concurrent=5)
        db = self._setup_db([d1], [0])

        result = get_driver_workload(db, "biz-1")

        assert result[0]["utilization_pct"] == 0.0

    def test_utilization_pct_hundred_when_full(self):
        d1 = _make_driver(max_concurrent=4)
        db = self._setup_db([d1], [4])

        result = get_driver_workload(db, "biz-1")

        assert result[0]["utilization_pct"] == 100.0

    def test_default_max_concurrent_in_workload(self):
        d1 = _make_driver(max_concurrent=None)
        db = self._setup_db([d1], [2])

        result = get_driver_workload(db, "biz-1")

        assert result[0]["max_concurrent"] == 5
        assert result[0]["utilization_pct"] == 40.0

    def test_workload_dict_keys(self):
        d1 = _make_driver(name="X", phone="999", is_available=True, max_concurrent=5)
        db = self._setup_db([d1], [1])

        result = get_driver_workload(db, "biz-1")

        expected_keys = {
            "driver_id", "name", "phone", "is_available",
            "active_deliveries", "max_concurrent", "utilization_pct",
        }
        assert set(result[0].keys()) == expected_keys

    def test_driver_id_is_string(self):
        d1 = _make_driver()
        db = self._setup_db([d1], [0])

        result = get_driver_workload(db, "biz-1")

        assert isinstance(result[0]["driver_id"], str)

    def test_empty_when_no_active_drivers(self):
        db = self._setup_db([], [])

        result = get_driver_workload(db, "biz-1")

        assert result == []

    def test_includes_unavailable_drivers(self):
        """get_driver_workload includes unavailable drivers (only filters is_active)."""
        d1 = _make_driver(name="Unavailable", is_available=False)
        db = self._setup_db([d1], [0])

        result = get_driver_workload(db, "biz-1")

        assert len(result) == 1
        assert result[0]["is_available"] is False

    def test_utilization_rounds_to_one_decimal(self):
        d1 = _make_driver(max_concurrent=3)
        db = self._setup_db([d1], [1])

        result = get_driver_workload(db, "biz-1")

        # 1/3 * 100 = 33.333... → 33.3
        assert result[0]["utilization_pct"] == 33.3
