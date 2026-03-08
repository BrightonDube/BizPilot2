"""Unit tests for LaybyStockService.

Tests stock reservation, release, and collection lifecycle for laybys.
"""

import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")

from app.models.inventory import InventoryItem, InventoryTransaction, TransactionType
from app.models.stock_reservation import StockReservation
from app.services.layby_stock_service import LaybyStockService


def _make_inventory_item(
    product_id: str,
    business_id: str,
    on_hand: int = 100,
    reserved: int = 0,
    avg_cost: Decimal = Decimal("50.00"),
) -> InventoryItem:
    """Helper to create a mock-compatible InventoryItem."""
    item = MagicMock(spec=InventoryItem)
    item.id = uuid.uuid4()
    item.product_id = product_id
    item.business_id = business_id
    item.quantity_on_hand = on_hand
    item.quantity_reserved = reserved
    item.quantity_available = max(0, on_hand - reserved)
    item.average_cost = avg_cost
    item.last_sold_at = None
    return item


def _make_reservation(
    layby_id: str,
    product_id: str,
    quantity: int,
    status: str = "reserved",
) -> StockReservation:
    """Helper to create a mock StockReservation."""
    res = MagicMock(spec=StockReservation)
    res.id = uuid.uuid4()
    res.layby_id = layby_id
    res.product_id = product_id
    res.quantity = quantity
    res.status = status
    res.reserved_at = datetime.now(timezone.utc)
    res.released_at = None
    return res


class TestCheckAvailability:
    """Tests for LaybyStockService.check_availability."""

    def test_all_items_available(self):
        """Returns True when all items have sufficient stock."""
        db = MagicMock()
        service = LaybyStockService(db)
        product_id = uuid.uuid4()
        business_id = uuid.uuid4()

        inv = _make_inventory_item(str(product_id), str(business_id), on_hand=50)
        service._get_inventory_item = MagicMock(return_value=inv)

        items = [{"product_id": product_id, "quantity": 10, "product_name": "Widget"}]
        ok, errors = service.check_availability(items, business_id)

        assert ok is True
        assert errors == []

    def test_insufficient_stock(self):
        """Returns False with error when stock is insufficient."""
        db = MagicMock()
        service = LaybyStockService(db)
        product_id = uuid.uuid4()
        business_id = uuid.uuid4()

        inv = _make_inventory_item(str(product_id), str(business_id), on_hand=5, reserved=3)
        service._get_inventory_item = MagicMock(return_value=inv)

        items = [{"product_id": product_id, "quantity": 10, "product_name": "Widget"}]
        ok, errors = service.check_availability(items, business_id)

        assert ok is False
        assert len(errors) == 1
        assert "Insufficient stock" in errors[0]

    def test_no_inventory_record(self):
        """Returns error when product has no inventory record."""
        db = MagicMock()
        service = LaybyStockService(db)
        product_id = uuid.uuid4()
        business_id = uuid.uuid4()

        service._get_inventory_item = MagicMock(return_value=None)

        items = [{"product_id": product_id, "quantity": 1, "product_name": "Ghost"}]
        ok, errors = service.check_availability(items, business_id)

        assert ok is False
        assert "no inventory record" in errors[0]

    def test_multiple_items_mixed(self):
        """Returns errors only for items with insufficient stock."""
        db = MagicMock()
        service = LaybyStockService(db)
        business_id = uuid.uuid4()
        good_pid = uuid.uuid4()
        bad_pid = uuid.uuid4()

        good_inv = _make_inventory_item(str(good_pid), str(business_id), on_hand=100)
        bad_inv = _make_inventory_item(str(bad_pid), str(business_id), on_hand=2)

        def side_effect(pid, bid, loc=None):
            if str(pid) == str(good_pid):
                return good_inv
            return bad_inv

        service._get_inventory_item = MagicMock(side_effect=side_effect)

        items = [
            {"product_id": good_pid, "quantity": 5, "product_name": "Good"},
            {"product_id": bad_pid, "quantity": 10, "product_name": "Bad"},
        ]
        ok, errors = service.check_availability(items, business_id)

        assert ok is False
        assert len(errors) == 1
        assert "Bad" in errors[0]


class TestReserveStock:
    """Tests for LaybyStockService.reserve_stock."""

    def test_creates_reservations_and_updates_inventory(self):
        """Successfully reserves stock and increments quantity_reserved."""
        db = MagicMock()
        service = LaybyStockService(db)
        layby_id = uuid.uuid4()
        business_id = uuid.uuid4()
        product_id = uuid.uuid4()

        inv = _make_inventory_item(str(product_id), str(business_id), on_hand=50, reserved=0)
        service._get_inventory_item = MagicMock(return_value=inv)

        items = [{"product_id": product_id, "quantity": 5, "product_name": "Widget"}]
        reservations = service.reserve_stock(layby_id, items, business_id)

        assert len(reservations) == 1
        assert inv.quantity_reserved == 5
        assert db.add.call_count >= 2  # reservation + transaction

    def test_raises_on_insufficient_stock(self):
        """Raises ValueError when stock is insufficient."""
        db = MagicMock()
        service = LaybyStockService(db)
        layby_id = uuid.uuid4()
        business_id = uuid.uuid4()
        product_id = uuid.uuid4()

        inv = _make_inventory_item(str(product_id), str(business_id), on_hand=2)
        service._get_inventory_item = MagicMock(return_value=inv)

        items = [{"product_id": product_id, "quantity": 10, "product_name": "Widget"}]

        with pytest.raises(ValueError, match="Insufficient stock"):
            service.reserve_stock(layby_id, items, business_id)

    def test_multiple_items_reserved(self):
        """Reserves stock for multiple items in one call."""
        db = MagicMock()
        service = LaybyStockService(db)
        layby_id = uuid.uuid4()
        business_id = uuid.uuid4()
        p1, p2 = uuid.uuid4(), uuid.uuid4()

        inv1 = _make_inventory_item(str(p1), str(business_id), on_hand=100, reserved=0)
        inv2 = _make_inventory_item(str(p2), str(business_id), on_hand=50, reserved=0)

        def lookup(pid, bid, loc=None):
            return inv1 if str(pid) == str(p1) else inv2

        service._get_inventory_item = MagicMock(side_effect=lookup)

        items = [
            {"product_id": p1, "quantity": 10, "product_name": "A"},
            {"product_id": p2, "quantity": 3, "product_name": "B"},
        ]
        reservations = service.reserve_stock(layby_id, items, business_id)

        assert len(reservations) == 2
        assert inv1.quantity_reserved == 10
        assert inv2.quantity_reserved == 3


class TestReleaseStock:
    """Tests for LaybyStockService.release_stock."""

    def test_releases_reservations_and_decrements_reserved(self):
        """Release marks reservations as released and decrements reserved qty."""
        db = MagicMock()
        layby_id = uuid.uuid4()
        business_id = uuid.uuid4()
        product_id = uuid.uuid4()

        res = _make_reservation(str(layby_id), str(product_id), quantity=5)
        db.query.return_value.filter.return_value.all.return_value = [res]

        inv = _make_inventory_item(str(product_id), str(business_id), on_hand=50, reserved=5)

        service = LaybyStockService(db)
        service._get_inventory_item = MagicMock(return_value=inv)

        total = service.release_stock(layby_id, business_id)

        assert total == 5
        assert res.status == "released"
        assert res.released_at is not None
        assert inv.quantity_reserved == 0

    def test_no_reservations_returns_zero(self):
        """Returns 0 when no active reservations exist."""
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []

        service = LaybyStockService(db)
        total = service.release_stock(uuid.uuid4(), uuid.uuid4())

        assert total == 0


class TestCollectStock:
    """Tests for LaybyStockService.collect_stock."""

    def test_collects_stock_and_updates_inventory(self):
        """Collect decrements both on_hand and reserved, records SALE txn."""
        db = MagicMock()
        layby_id = uuid.uuid4()
        business_id = uuid.uuid4()
        product_id = uuid.uuid4()

        res = _make_reservation(str(layby_id), str(product_id), quantity=5)
        db.query.return_value.filter.return_value.all.return_value = [res]

        inv = _make_inventory_item(str(product_id), str(business_id), on_hand=50, reserved=5)

        service = LaybyStockService(db)
        service._get_inventory_item = MagicMock(return_value=inv)

        total = service.collect_stock(layby_id, business_id)

        assert total == 5
        assert res.status == "collected"
        assert inv.quantity_on_hand == 45
        assert inv.quantity_reserved == 0
        assert inv.last_sold_at is not None

    def test_no_reservations_returns_zero(self):
        """Returns 0 when no active reservations exist."""
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []

        service = LaybyStockService(db)
        total = service.collect_stock(uuid.uuid4(), uuid.uuid4())

        assert total == 0

    def test_on_hand_never_goes_negative(self):
        """Quantity on hand floors at 0 even if data is inconsistent."""
        db = MagicMock()
        layby_id = uuid.uuid4()
        business_id = uuid.uuid4()
        product_id = uuid.uuid4()

        res = _make_reservation(str(layby_id), str(product_id), quantity=10)
        db.query.return_value.filter.return_value.all.return_value = [res]

        inv = _make_inventory_item(str(product_id), str(business_id), on_hand=3, reserved=10)

        service = LaybyStockService(db)
        service._get_inventory_item = MagicMock(return_value=inv)

        total = service.collect_stock(layby_id, business_id)

        assert total == 10
        assert inv.quantity_on_hand == 0
        assert inv.quantity_reserved == 0
