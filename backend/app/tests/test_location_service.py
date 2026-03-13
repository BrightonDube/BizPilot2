"""Unit tests for LocationService."""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from unittest.mock import MagicMock
from uuid import uuid4


from app.models.location import (
    Location,
    LocationStock,
    StockTransfer,
    StockTransferItem,
    TransferStatus,
)
from app.services.location_service import LocationService

BIZ = str(uuid4())
LOC_A = str(uuid4())
LOC_B = str(uuid4())
PROD = str(uuid4())
TRANSFER_ID = str(uuid4())
USER_ID = str(uuid4())


# ── helpers ───────────────────────────────────────────────────

def _make_service():
    db = MagicMock()
    svc = LocationService(db)
    return svc, db


def _chain(first=None, rows=None, count=0):
    """Return a mock that supports the full SQLAlchemy query chain."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    return c


def _make_location(**overrides):
    loc = MagicMock(spec=Location)
    loc.id = overrides.get("id", uuid4())
    loc.business_id = overrides.get("business_id", BIZ)
    loc.name = overrides.get("name", "Main Store")
    loc.code = overrides.get("code", "MAIN")
    loc.is_active = overrides.get("is_active", True)
    loc.deleted_at = overrides.get("deleted_at", None)
    return loc


def _make_stock(**overrides):
    s = MagicMock(spec=LocationStock)
    s.id = overrides.get("id", uuid4())
    s.location_id = overrides.get("location_id", LOC_A)
    s.product_id = overrides.get("product_id", PROD)
    s.quantity = overrides.get("quantity", 10)
    s.min_quantity = overrides.get("min_quantity", 5)
    s.max_quantity = overrides.get("max_quantity", 100)
    s.deleted_at = overrides.get("deleted_at", None)
    return s


def _make_transfer(status=TransferStatus.PENDING, items=None, **overrides):
    t = MagicMock(spec=StockTransfer)
    t.id = overrides.get("id", TRANSFER_ID)
    t.business_id = overrides.get("business_id", BIZ)
    t.from_location_id = overrides.get("from_location_id", LOC_A)
    t.to_location_id = overrides.get("to_location_id", LOC_B)
    t.status = status
    t.items = items or []
    return t


def _make_transfer_item(**overrides):
    ti = MagicMock(spec=StockTransferItem)
    ti.product_id = overrides.get("product_id", PROD)
    ti.quantity = overrides.get("quantity", 5)
    ti.received_quantity = overrides.get("received_quantity", 0)
    return ti


# ── Locations CRUD ────────────────────────────────────────────

class TestCreateLocation:
    def test_creates_and_flushes(self):
        svc, db = _make_service()
        svc.create_location(BIZ, "Shop A", code="SA", address="123 Main",
                                     city="JHB", phone="011", email="a@b.com",
                                     is_warehouse=True, is_primary=True)

        db.add.assert_called_once()
        db.flush.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, Location)
        assert added.name == "Shop A"
        assert added.business_id == BIZ
        assert added.is_warehouse is True
        assert added.is_primary is True

    def test_returns_location_object(self):
        svc, db = _make_service()
        result = svc.create_location(BIZ, "Warehouse")
        assert isinstance(result, Location)
        assert result.name == "Warehouse"


class TestListLocations:
    def test_returns_active_locations(self):
        svc, db = _make_service()
        loc1 = _make_location(name="Alpha")
        loc2 = _make_location(name="Beta")
        chain = _chain(rows=[loc1, loc2])
        db.query.return_value = chain

        result = svc.list_locations(BIZ)

        assert result == [loc1, loc2]
        # filter is called twice: once for (business_id, deleted_at), once for is_active
        assert chain.filter.call_count == 2
        chain.order_by.assert_called_once()
        chain.all.assert_called_once()

    def test_include_inactive_skips_active_filter(self):
        svc, db = _make_service()
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.list_locations(BIZ, include_inactive=True)

        # Only one filter call (business_id + deleted_at), no is_active filter
        assert chain.filter.call_count == 1


class TestGetLocation:
    def test_returns_location_when_found(self):
        svc, db = _make_service()
        loc = _make_location()
        chain = _chain(first=loc)
        db.query.return_value = chain

        result = svc.get_location(str(loc.id), BIZ)
        assert result == loc

    def test_returns_none_when_not_found(self):
        svc, db = _make_service()
        chain = _chain(first=None)
        db.query.return_value = chain

        assert svc.get_location("nonexistent", BIZ) is None


class TestUpdateLocation:
    def test_updates_attributes_and_flushes(self):
        svc, db = _make_service()
        loc = _make_location()
        loc.name = "Old"
        chain = _chain(first=loc)
        db.query.return_value = chain

        result = svc.update_location(str(loc.id), BIZ, name="New Name", city="CPT")

        assert result is loc
        db.flush.assert_called()

    def test_returns_none_when_not_found(self):
        svc, db = _make_service()
        chain = _chain(first=None)
        db.query.return_value = chain

        assert svc.update_location("missing", BIZ, name="X") is None

    def test_skips_none_values(self):
        svc, db = _make_service()
        loc = _make_location()
        loc.name = "Original"
        chain = _chain(first=loc)
        db.query.return_value = chain

        svc.update_location(str(loc.id), BIZ, name=None)
        # name=None should not overwrite
        assert loc.name == "Original"


class TestDeleteLocation:
    def test_soft_deletes_and_returns_true(self):
        svc, db = _make_service()
        loc = _make_location()
        chain = _chain(first=loc)
        db.query.return_value = chain

        result = svc.delete_location(str(loc.id), BIZ)

        assert result is True
        loc.soft_delete.assert_called_once()
        db.flush.assert_called()

    def test_returns_false_when_not_found(self):
        svc, db = _make_service()
        chain = _chain(first=None)
        db.query.return_value = chain

        assert svc.delete_location("missing", BIZ) is False


# ── Stock levels ──────────────────────────────────────────────

class TestSetStockLevel:
    def test_updates_existing_stock(self):
        svc, db = _make_service()
        existing = _make_stock(quantity=10)
        chain = _chain(first=existing)
        db.query.return_value = chain

        result = svc.set_stock_level(LOC_A, PROD, 25, min_quantity=3, max_quantity=50)

        assert existing.quantity == 25
        assert existing.min_quantity == 3
        assert existing.max_quantity == 50
        db.add.assert_not_called()
        db.flush.assert_called()
        assert result is existing

    def test_creates_new_stock_when_not_found(self):
        svc, db = _make_service()
        chain = _chain(first=None)
        db.query.return_value = chain

        svc.set_stock_level(LOC_A, PROD, 15, min_quantity=2, max_quantity=200)

        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, LocationStock)
        assert added.quantity == 15
        assert added.min_quantity == 2
        assert added.max_quantity == 200
        db.flush.assert_called()


class TestGetStockLevels:
    def test_returns_paginated_results(self):
        svc, db = _make_service()
        s1 = _make_stock()
        s2 = _make_stock()
        chain = _chain(rows=[s1, s2], count=5)
        db.query.return_value = chain

        items, total = svc.get_stock_levels(LOC_A, page=2, per_page=2)

        assert items == [s1, s2]
        assert total == 5
        chain.offset.assert_called_once_with(2)  # (2-1)*2
        chain.limit.assert_called_once_with(2)

    def test_page_one_offset_zero(self):
        svc, db = _make_service()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        items, total = svc.get_stock_levels(LOC_A, page=1, per_page=20)

        chain.offset.assert_called_once_with(0)
        chain.limit.assert_called_once_with(20)
        assert items == []
        assert total == 0


class TestGetProductAcrossLocations:
    def test_returns_stock_across_active_locations(self):
        svc, db = _make_service()
        s1 = _make_stock(location_id=LOC_A)
        s2 = _make_stock(location_id=LOC_B)
        chain = _chain(rows=[s1, s2])
        db.query.return_value = chain

        result = svc.get_product_across_locations(BIZ, PROD)

        assert result == [s1, s2]
        chain.join.assert_called_once()
        chain.filter.assert_called_once()
        chain.all.assert_called_once()


# ── Transfers ─────────────────────────────────────────────────

class TestCreateTransfer:
    def test_creates_transfer_with_items(self):
        svc, db = _make_service()
        transfer_items = [
            {"product_id": str(uuid4()), "quantity": 5},
            {"product_id": str(uuid4()), "quantity": 10},
        ]

        result = svc.create_transfer(BIZ, LOC_A, LOC_B, transfer_items,
                                     notes="Test", initiated_by=USER_ID)

        assert isinstance(result, StockTransfer)
        assert result.status == TransferStatus.PENDING
        assert result.business_id == BIZ
        assert result.from_location_id == LOC_A
        assert result.to_location_id == LOC_B
        assert result.notes == "Test"
        assert result.initiated_by == USER_ID
        # transfer + 2 items = 3 db.add calls
        assert db.add.call_count == 3
        assert db.flush.call_count == 2
        db.refresh.assert_called_once_with(result)

    def test_reference_number_format(self):
        svc, db = _make_service()
        result = svc.create_transfer(BIZ, LOC_A, LOC_B, [{"product_id": str(uuid4()), "quantity": 1}])
        assert result.reference_number.startswith("TRF-")


class TestListTransfers:
    def test_returns_paginated_transfers(self):
        svc, db = _make_service()
        t1 = _make_transfer()
        chain = _chain(rows=[t1], count=1)
        db.query.return_value = chain

        items, total = svc.list_transfers(BIZ, page=1, per_page=10)

        assert items == [t1]
        assert total == 1
        chain.order_by.assert_called_once()

    def test_filters_by_status(self):
        svc, db = _make_service()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_transfers(BIZ, status=TransferStatus.PENDING)

        # Two filter calls: one for (business_id, deleted_at), one for status
        assert chain.filter.call_count == 2


class TestGetTransfer:
    def test_returns_transfer(self):
        svc, db = _make_service()
        t = _make_transfer()
        chain = _chain(first=t)
        db.query.return_value = chain

        assert svc.get_transfer(TRANSFER_ID, BIZ) is t

    def test_returns_none_when_not_found(self):
        svc, db = _make_service()
        chain = _chain(first=None)
        db.query.return_value = chain

        assert svc.get_transfer("missing", BIZ) is None


class TestReceiveTransfer:
    def test_updates_stock_and_status(self):
        svc, db = _make_service()
        prod_id = uuid4()
        ti = _make_transfer_item(product_id=prod_id, quantity=5)
        transfer = _make_transfer(status=TransferStatus.PENDING, items=[ti])

        src_stock = _make_stock(location_id=LOC_A, product_id=prod_id, quantity=20)
        dst_stock = _make_stock(location_id=LOC_B, product_id=prod_id, quantity=3)

        # get_transfer query returns the transfer, then stock queries follow
        query_results = []
        # Call 1: get_transfer -> StockTransfer query
        transfer_chain = _chain(first=transfer)
        query_results.append(transfer_chain)
        # Call 2: source stock lookup
        src_chain = _chain(first=src_stock)
        query_results.append(src_chain)
        # Call 3: destination stock lookup
        dst_chain = _chain(first=dst_stock)
        query_results.append(dst_chain)

        call_idx = {"i": 0}

        def side_effect(*args, **kwargs):
            idx = call_idx["i"]
            call_idx["i"] += 1
            return query_results[idx]

        db.query.side_effect = side_effect

        received_items = [{"product_id": str(prod_id), "received_quantity": 5}]
        result = svc.receive_transfer(TRANSFER_ID, BIZ, received_items)

        assert result is transfer
        assert transfer.status == TransferStatus.RECEIVED
        assert src_stock.quantity == 15  # 20 - 5
        assert dst_stock.quantity == 8   # 3 + 5
        ti.received_quantity = 5
        db.flush.assert_called()
        db.refresh.assert_called_once_with(transfer)

    def test_returns_none_for_wrong_status(self):
        svc, db = _make_service()
        transfer = _make_transfer(status=TransferStatus.RECEIVED)
        chain = _chain(first=transfer)
        db.query.return_value = chain

        result = svc.receive_transfer(TRANSFER_ID, BIZ, [])
        assert result is None

    def test_returns_none_when_not_found(self):
        svc, db = _make_service()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.receive_transfer("missing", BIZ, [])
        assert result is None

    def test_creates_destination_stock_when_not_exists(self):
        svc, db = _make_service()
        prod_id = uuid4()
        ti = _make_transfer_item(product_id=prod_id, quantity=3)
        transfer = _make_transfer(status=TransferStatus.IN_TRANSIT, items=[ti])

        src_stock = _make_stock(location_id=LOC_A, product_id=prod_id, quantity=10)

        query_results = []
        transfer_chain = _chain(first=transfer)
        query_results.append(transfer_chain)
        src_chain = _chain(first=src_stock)
        query_results.append(src_chain)
        dst_chain = _chain(first=None)  # no destination stock
        query_results.append(dst_chain)

        call_idx = {"i": 0}

        def side_effect(*args, **kwargs):
            idx = call_idx["i"]
            call_idx["i"] += 1
            return query_results[idx]

        db.query.side_effect = side_effect

        received_items = [{"product_id": str(prod_id), "received_quantity": 3}]
        result = svc.receive_transfer(TRANSFER_ID, BIZ, received_items)

        assert result is transfer
        # New LocationStock added for destination
        added_calls = db.add.call_args_list
        new_stock = added_calls[-1][0][0]
        assert isinstance(new_stock, LocationStock)
        assert new_stock.quantity == 3
        assert src_stock.quantity == 7  # 10 - 3

    def test_uses_item_quantity_when_no_received_match(self):
        """When received_items doesn't include a product, defaults to ti.quantity."""
        svc, db = _make_service()
        prod_id = uuid4()
        ti = _make_transfer_item(product_id=prod_id, quantity=8)
        transfer = _make_transfer(status=TransferStatus.PENDING, items=[ti])

        src_stock = _make_stock(location_id=LOC_A, product_id=prod_id, quantity=20)
        dst_stock = _make_stock(location_id=LOC_B, product_id=prod_id, quantity=0)

        query_results = [
            _chain(first=transfer),
            _chain(first=src_stock),
            _chain(first=dst_stock),
        ]
        call_idx = {"i": 0}

        def side_effect(*args, **kwargs):
            idx = call_idx["i"]
            call_idx["i"] += 1
            return query_results[idx]

        db.query.side_effect = side_effect

        # Pass empty received_items — should default to ti.quantity = 8
        svc.receive_transfer(TRANSFER_ID, BIZ, [])

        assert src_stock.quantity == 12  # 20 - 8
        assert dst_stock.quantity == 8   # 0 + 8


class TestCancelTransfer:
    def test_cancels_pending_transfer(self):
        svc, db = _make_service()
        transfer = _make_transfer(status=TransferStatus.PENDING)
        chain = _chain(first=transfer)
        db.query.return_value = chain

        result = svc.cancel_transfer(TRANSFER_ID, BIZ)

        assert result is transfer
        assert transfer.status == TransferStatus.CANCELLED
        db.flush.assert_called()

    def test_returns_none_for_non_pending_transfer(self):
        svc, db = _make_service()
        transfer = _make_transfer(status=TransferStatus.RECEIVED)
        chain = _chain(first=transfer)
        db.query.return_value = chain

        assert svc.cancel_transfer(TRANSFER_ID, BIZ) is None

    def test_returns_none_when_not_found(self):
        svc, db = _make_service()
        chain = _chain(first=None)
        db.query.return_value = chain

        assert svc.cancel_transfer("missing", BIZ) is None


# ── Alerts ────────────────────────────────────────────────────

class TestGetLowStockAlerts:
    def test_returns_low_stock_items(self):
        svc, db = _make_service()
        alert1 = _make_stock(quantity=2, min_quantity=10)
        alert2 = _make_stock(quantity=0, min_quantity=5)
        chain = _chain(rows=[alert1, alert2])
        db.query.return_value = chain

        result = svc.get_low_stock_alerts(BIZ)

        assert result == [alert1, alert2]
        chain.join.assert_called_once()
        chain.filter.assert_called_once()
        chain.all.assert_called_once()

    def test_returns_empty_when_no_alerts(self):
        svc, db = _make_service()
        chain = _chain(rows=[])
        db.query.return_value = chain

        assert svc.get_low_stock_alerts(BIZ) == []
