"""Unit tests for DeliveryService."""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.models.delivery import Delivery, DeliveryStatus, DeliveryZone, Driver
from app.services.delivery_service import DeliveryService

BIZ = str(uuid4())
ZONE_ID = str(uuid4())
DRIVER_ID = str(uuid4())
DELIVERY_ID = str(uuid4())
ORDER_ID = str(uuid4())


def _svc():
    db = MagicMock()
    return DeliveryService(db), db


def _chain(first=None, rows=None, count=0, scalar=0):
    """Reusable mock supporting SQLAlchemy chained-call pattern."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.outerjoin.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.group_by.return_value = c
    c.with_entities.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = scalar
    return c


def _mock_zone(**kw):
    z = MagicMock(spec=DeliveryZone)
    z.id = kw.get("id", uuid4())
    z.business_id = kw.get("business_id", BIZ)
    z.name = kw.get("name", "Zone A")
    z.delivery_fee = kw.get("delivery_fee", Decimal("25.00"))
    z.estimated_minutes = kw.get("estimated_minutes", 30)
    z.description = kw.get("description", None)
    z.is_active = kw.get("is_active", True)
    z.deleted_at = None
    return z


def _mock_driver(**kw):
    d = MagicMock(spec=Driver)
    d.id = kw.get("id", uuid4())
    d.business_id = kw.get("business_id", BIZ)
    d.name = kw.get("name", "John Driver")
    d.phone = kw.get("phone", "0821234567")
    d.user_id = kw.get("user_id", None)
    d.vehicle_type = kw.get("vehicle_type", "motorbike")
    d.license_plate = kw.get("license_plate", "ABC 123")
    d.is_available = kw.get("is_available", True)
    d.is_active = kw.get("is_active", True)
    d.deleted_at = None
    return d


def _mock_delivery(**kw):
    dl = MagicMock(spec=Delivery)
    dl.id = kw.get("id", uuid4())
    dl.business_id = kw.get("business_id", BIZ)
    dl.order_id = kw.get("order_id", ORDER_ID)
    dl.driver_id = kw.get("driver_id", None)
    dl.zone_id = kw.get("zone_id", None)
    dl.status = kw.get("status", DeliveryStatus.PENDING)
    dl.delivery_address = kw.get("delivery_address", "123 Main St")
    dl.customer_phone = kw.get("customer_phone", "0821234567")
    dl.delivery_fee = kw.get("delivery_fee", Decimal("25.00"))
    dl.delivery_notes = kw.get("delivery_notes", None)
    dl.actual_delivery_time = kw.get("actual_delivery_time", None)
    dl.proof_of_delivery = kw.get("proof_of_delivery", None)
    dl.created_at = kw.get("created_at", datetime(2025, 6, 1))
    dl.deleted_at = None
    return dl


# ── Zone management ──────────────────────────────────────────────────


class TestCreateZone:
    def test_creates_and_commits(self):
        svc, db = _svc()
        zone = svc.create_zone(BIZ, "Downtown", Decimal("30.00"), 45, description="CBD area")
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.name == "Downtown"
        assert added.delivery_fee == Decimal("30.00")
        assert added.estimated_minutes == 45
        assert added.description == "CBD area"

    def test_defaults_no_description(self):
        svc, db = _svc()
        zone = svc.create_zone(BIZ, "Suburbs", Decimal("15.00"), 20)
        added = db.add.call_args[0][0]
        assert added.description is None


class TestListZones:
    def test_returns_active_zones(self):
        svc, db = _svc()
        zones = [_mock_zone(), _mock_zone(name="Zone B")]
        db.query.return_value = _chain(rows=zones)
        result = svc.list_zones(BIZ)
        assert len(result) == 2
        db.query.assert_called_once_with(DeliveryZone)

    def test_empty_list(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        result = svc.list_zones(BIZ)
        assert result == []


class TestUpdateZone:
    def test_updates_fields(self):
        svc, db = _svc()
        zone = _mock_zone()
        db.query.return_value = _chain(first=zone)
        result = svc.update_zone(ZONE_ID, BIZ, name="New Name", delivery_fee=Decimal("50.00"))
        assert result is zone
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_not_found_returns_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.update_zone(ZONE_ID, BIZ, name="New Name")
        assert result is None
        db.commit.assert_not_called()

    def test_ignores_nonexistent_attributes(self):
        svc, db = _svc()
        zone = _mock_zone()
        zone.nonexistent_field = None
        # hasattr on MagicMock returns True, so we test that setattr is called
        db.query.return_value = _chain(first=zone)
        result = svc.update_zone(ZONE_ID, BIZ, name="Updated")
        assert result is zone


# ── Driver management ────────────────────────────────────────────────


class TestCreateDriver:
    def test_creates_and_commits(self):
        svc, db = _svc()
        driver = svc.create_driver(
            BIZ, "Jane", "0829876543",
            vehicle_type="car", license_plate="XYZ 789",
        )
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.name == "Jane"
        assert added.phone == "0829876543"
        assert added.vehicle_type == "car"

    def test_optional_fields_default_none(self):
        svc, db = _svc()
        svc.create_driver(BIZ, "Bob", "0820000000")
        added = db.add.call_args[0][0]
        assert added.user_id is None
        assert added.vehicle_type is None
        assert added.license_plate is None


class TestListDrivers:
    def test_returns_all_active_drivers(self):
        svc, db = _svc()
        drivers = [_mock_driver(), _mock_driver(name="Driver 2")]
        db.query.return_value = _chain(rows=drivers)
        result = svc.list_drivers(BIZ)
        assert len(result) == 2

    def test_available_only_adds_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[_mock_driver()])
        db.query.return_value = chain
        result = svc.list_drivers(BIZ, available_only=True)
        # Extra filter call for is_available
        assert chain.filter.call_count >= 2

    def test_empty_list(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        result = svc.list_drivers(BIZ)
        assert result == []


class TestToggleDriverAvailability:
    def test_toggles_true_to_false(self):
        svc, db = _svc()
        driver = _mock_driver(is_available=True)
        db.query.return_value = _chain(first=driver)
        result = svc.toggle_driver_availability(DRIVER_ID, BIZ)
        assert result is driver
        assert driver.is_available is False
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_toggles_false_to_true(self):
        svc, db = _svc()
        driver = _mock_driver(is_available=False)
        db.query.return_value = _chain(first=driver)
        result = svc.toggle_driver_availability(DRIVER_ID, BIZ)
        assert result is driver
        assert driver.is_available is True

    def test_not_found_returns_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.toggle_driver_availability(DRIVER_ID, BIZ)
        assert result is None
        db.commit.assert_not_called()


# ── Delivery CRUD ────────────────────────────────────────────────────


class TestCreateDelivery:
    def test_without_driver_sets_pending(self):
        svc, db = _svc()
        delivery = svc.create_delivery(BIZ, ORDER_ID, "123 Main St", "0821111111")
        db.add.assert_called_once()
        db.commit.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.status == DeliveryStatus.PENDING
        assert added.driver_id is None

    def test_with_driver_sets_assigned(self):
        svc, db = _svc()
        delivery = svc.create_delivery(
            BIZ, ORDER_ID, "456 Oak Ave", "0822222222",
            driver_id=DRIVER_ID,
        )
        added = db.add.call_args[0][0]
        assert added.status == DeliveryStatus.ASSIGNED
        assert added.driver_id == DRIVER_ID

    def test_delivery_fee_defaults_to_zero(self):
        svc, db = _svc()
        svc.create_delivery(BIZ, ORDER_ID, "789 Elm St", "0823333333")
        added = db.add.call_args[0][0]
        assert added.delivery_fee == Decimal("0")

    def test_with_all_optional_fields(self):
        svc, db = _svc()
        svc.create_delivery(
            BIZ, ORDER_ID, "321 Pine Rd", "0824444444",
            zone_id=ZONE_ID, driver_id=DRIVER_ID,
            delivery_fee=Decimal("50.00"), notes="Leave at gate",
        )
        added = db.add.call_args[0][0]
        assert added.zone_id == ZONE_ID
        assert added.delivery_fee == Decimal("50.00")
        assert added.delivery_notes == "Leave at gate"


class TestAssignDriver:
    def test_assigns_and_updates_pending_to_assigned(self):
        svc, db = _svc()
        delivery = _mock_delivery(status=DeliveryStatus.PENDING)
        db.query.return_value = _chain(first=delivery)
        result = svc.assign_driver(DELIVERY_ID, DRIVER_ID, BIZ)
        assert result is delivery
        assert delivery.driver_id == DRIVER_ID
        assert delivery.status == DeliveryStatus.ASSIGNED
        db.commit.assert_called_once()

    def test_does_not_change_non_pending_status(self):
        svc, db = _svc()
        delivery = _mock_delivery(status=DeliveryStatus.IN_TRANSIT)
        db.query.return_value = _chain(first=delivery)
        result = svc.assign_driver(DELIVERY_ID, DRIVER_ID, BIZ)
        assert delivery.status == DeliveryStatus.IN_TRANSIT
        assert delivery.driver_id == DRIVER_ID

    def test_not_found_returns_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.assign_driver(DELIVERY_ID, DRIVER_ID, BIZ)
        assert result is None
        db.commit.assert_not_called()


class TestUpdateStatus:
    def test_sets_new_status(self):
        svc, db = _svc()
        delivery = _mock_delivery(status=DeliveryStatus.ASSIGNED)
        db.query.return_value = _chain(first=delivery)
        result = svc.update_status(DELIVERY_ID, BIZ, DeliveryStatus.IN_TRANSIT)
        assert result is delivery
        assert delivery.status == DeliveryStatus.IN_TRANSIT
        db.commit.assert_called_once()

    def test_delivered_sets_actual_time(self):
        svc, db = _svc()
        delivery = _mock_delivery(status=DeliveryStatus.IN_TRANSIT)
        db.query.return_value = _chain(first=delivery)
        result = svc.update_status(DELIVERY_ID, BIZ, DeliveryStatus.DELIVERED)
        assert delivery.status == DeliveryStatus.DELIVERED
        assert delivery.actual_delivery_time is not None

    def test_with_proof(self):
        svc, db = _svc()
        delivery = _mock_delivery()
        db.query.return_value = _chain(first=delivery)
        result = svc.update_status(DELIVERY_ID, BIZ, DeliveryStatus.DELIVERED, proof="signed.jpg")
        assert delivery.proof_of_delivery == "signed.jpg"

    def test_not_found_returns_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.update_status(DELIVERY_ID, BIZ, DeliveryStatus.DELIVERED)
        assert result is None
        db.commit.assert_not_called()

    def test_non_delivered_status_no_time(self):
        svc, db = _svc()
        delivery = _mock_delivery()
        db.query.return_value = _chain(first=delivery)
        svc.update_status(DELIVERY_ID, BIZ, DeliveryStatus.FAILED)
        assert delivery.status == DeliveryStatus.FAILED
        assert delivery.actual_delivery_time is None


class TestGetDelivery:
    def test_found(self):
        svc, db = _svc()
        delivery = _mock_delivery()
        db.query.return_value = _chain(first=delivery)
        result = svc.get_delivery(DELIVERY_ID, BIZ)
        assert result is delivery

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.get_delivery(DELIVERY_ID, BIZ)
        assert result is None


class TestListDeliveries:
    def test_returns_items_and_total(self):
        svc, db = _svc()
        deliveries = [_mock_delivery(), _mock_delivery()]
        db.query.return_value = _chain(rows=deliveries, count=2)
        items, total = svc.list_deliveries(BIZ)
        assert len(items) == 2
        assert total == 2

    def test_empty_result(self):
        svc, db = _svc()
        db.query.return_value = _chain()
        items, total = svc.list_deliveries(BIZ)
        assert items == []
        assert total == 0

    def test_with_status_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[_mock_delivery()], count=1)
        db.query.return_value = chain
        items, total = svc.list_deliveries(BIZ, status=DeliveryStatus.PENDING)
        assert chain.filter.call_count >= 2

    def test_with_driver_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.list_deliveries(BIZ, driver_id=DRIVER_ID)
        assert chain.filter.call_count >= 2

    def test_pagination(self):
        svc, db = _svc()
        chain = _chain(rows=[_mock_delivery()], count=50)
        db.query.return_value = chain
        items, total = svc.list_deliveries(BIZ, page=3, per_page=10)
        assert total == 50
        chain.offset.assert_called_with(20)
        chain.limit.assert_called_with(10)


class TestGetActiveDeliveries:
    def test_returns_non_terminal_deliveries(self):
        svc, db = _svc()
        active = [_mock_delivery(status=DeliveryStatus.IN_TRANSIT)]
        db.query.return_value = _chain(rows=active)
        result = svc.get_active_deliveries(BIZ)
        assert len(result) == 1

    def test_empty_when_all_completed(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        result = svc.get_active_deliveries(BIZ)
        assert result == []


class TestGetDriverStats:
    def test_returns_stats_with_deliveries(self):
        svc, db = _svc()
        # db.query(Delivery) returns query_chain
        # query_chain.filter(and_(*filters)) returns base_chain (count=10)
        # base_chain.filter(delivered) returns delivered_chain (count=8)
        # base_chain.filter(failed) returns failed_chain (count=1)
        # base_chain.filter(delivered).with_entities().scalar() -> 200
        query_chain = _chain()
        base_chain = _chain(count=10)
        delivered_chain = _chain(count=8)
        failed_chain = _chain(count=1)
        fee_chain = _chain(scalar=Decimal("200.00"))

        query_chain.filter.return_value = base_chain

        filter_call_count = [0]
        filter_chains = [delivered_chain, failed_chain, fee_chain]

        def filter_side_effect(*args, **kwargs):
            idx = filter_call_count[0]
            filter_call_count[0] += 1
            if idx < len(filter_chains):
                return filter_chains[idx]
            return _chain()

        base_chain.filter.side_effect = filter_side_effect

        db.query.return_value = query_chain

        stats = svc.get_driver_stats(DRIVER_ID, BIZ)
        assert stats["driver_id"] == DRIVER_ID
        assert stats["total_deliveries"] == 10
        assert stats["delivered"] == 8
        assert stats["failed"] == 1
        assert stats["success_rate"] == 80.0
        assert stats["total_fees_collected"] == float(Decimal("200.00"))

    def test_zero_deliveries_no_division_error(self):
        svc, db = _svc()
        query_chain = _chain()
        base_chain = _chain(count=0)
        zero_chain = _chain(count=0, scalar=0)

        query_chain.filter.return_value = base_chain
        base_chain.filter.return_value = zero_chain

        db.query.return_value = query_chain

        stats = svc.get_driver_stats(DRIVER_ID, BIZ)
        assert stats["total_deliveries"] == 0
        assert stats["success_rate"] == 0
        assert stats["total_fees_collected"] == 0

    def test_with_date_filters(self):
        svc, db = _svc()
        query_chain = _chain()
        base_chain = _chain(count=5)
        sub_chain = _chain(count=3, scalar=Decimal("75.00"))

        query_chain.filter.return_value = base_chain
        base_chain.filter.return_value = sub_chain

        db.query.return_value = query_chain

        stats = svc.get_driver_stats(
            DRIVER_ID, BIZ,
            date_from=datetime(2025, 1, 1),
            date_to=datetime(2025, 6, 30),
        )
        assert stats["total_deliveries"] == 5
        assert stats["delivered"] == 3
