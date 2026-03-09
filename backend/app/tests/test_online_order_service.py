"""Unit tests for OnlineOrderService.

Covers store config (get_or_create, update), menu retrieval,
order CRUD (create, get, list, update_status, cancel),
active orders, and order statistics.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.models.menu import MenuItem
from app.models.online_order import (
    FulfillmentType,
    OnlineOrder,
    OnlineOrderItem,
    OnlineOrderStatus,
    OnlineStore,
)
from app.services.online_order_service import OnlineOrderService


BIZ_ID = str(uuid.uuid4())
ORDER_ID = str(uuid.uuid4())
STORE_ID = str(uuid.uuid4())
PRODUCT_ID = str(uuid.uuid4())


def _chain(first=None, rows=None, count=0, scalar=0):
    """Reusable mock that supports the common SQLAlchemy chained-call pattern."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.with_entities.return_value = c
    c.like.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = scalar
    return c


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def svc(db):
    return OnlineOrderService(db)


# ── Store Configuration ──────────────────────────────────────────


class TestGetOrCreateStore:
    def test_returns_existing_store(self, svc, db):
        store = MagicMock(spec=OnlineStore)
        db.query.return_value = _chain(first=store)

        result = svc.get_or_create_store(BIZ_ID, "My Store")

        assert result is store
        db.add.assert_not_called()
        db.commit.assert_not_called()

    def test_creates_new_store_when_none_exists(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.get_or_create_store(BIZ_ID, "New Store")

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        created = db.add.call_args[0][0]
        assert isinstance(created, OnlineStore)
        assert created.store_name == "New Store"
        assert str(created.business_id) == BIZ_ID


class TestUpdateStore:
    def test_updates_store_attributes(self, svc, db):
        store = MagicMock(spec=OnlineStore)
        store.store_name = "Old Name"
        db.query.return_value = _chain(first=store)

        result = svc.update_store(BIZ_ID, store_name="New Name")

        assert result is store
        assert store.store_name == "New Name"
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_returns_none_when_store_missing(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.update_store(BIZ_ID, store_name="X")

        assert result is None
        db.commit.assert_not_called()

    def test_ignores_unknown_attributes(self, svc, db):
        store = MagicMock(spec=OnlineStore)
        store.store_name = "Old"
        # hasattr on a spec'd mock returns False for non-existent attrs
        db.query.return_value = _chain(first=store)

        svc.update_store(BIZ_ID, totally_fake_attr="whatever")
        # Should not raise; unknown attrs are silently ignored
        db.commit.assert_called_once()


# ── Menu ─────────────────────────────────────────────────────────


class TestGetStoreMenu:
    def test_returns_menu_items(self, svc, db):
        item1 = MagicMock(spec=MenuItem)
        item2 = MagicMock(spec=MenuItem)
        db.query.return_value = _chain(rows=[item1, item2])

        result = svc.get_store_menu(BIZ_ID)

        assert result == [item1, item2]

    def test_returns_empty_list(self, svc, db):
        db.query.return_value = _chain(rows=[])

        result = svc.get_store_menu(BIZ_ID)

        assert result == []


# ── Order Number Generation ──────────────────────────────────────


class TestGenerateOrderNumber:
    @patch("app.services.online_order_service.date")
    def test_first_order_of_day(self, mock_date, svc, db):
        mock_date.today.return_value = date(2025, 1, 15)
        db.query.return_value = _chain(first=None)

        result = svc._generate_order_number(BIZ_ID)

        assert result == "OL-20250115-0001"

    @patch("app.services.online_order_service.date")
    def test_increments_from_last_order(self, mock_date, svc, db):
        mock_date.today.return_value = date(2025, 1, 15)
        last_order = MagicMock(spec=OnlineOrder)
        last_order.order_number = "OL-20250115-0042"
        db.query.return_value = _chain(first=last_order)

        result = svc._generate_order_number(BIZ_ID)

        assert result == "OL-20250115-0043"


# ── Create Order ─────────────────────────────────────────────────


class TestCreateOrder:
    def _setup_create(self, db, store=None, last_order=None):
        """Wire up db.query side_effect for create_order's 3 queries."""
        call_counter = {"n": 0}
        chains = [
            _chain(first=last_order),  # _generate_order_number
            _chain(first=store),       # store lookup for delivery fee
        ]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[min(idx, len(chains) - 1)]

        db.query.side_effect = query_side_effect

    @patch("app.services.online_order_service.date")
    def test_creates_collection_order(self, mock_date, svc, db):
        mock_date.today.return_value = date(2025, 6, 1)
        self._setup_create(db)

        items = [{"name": "Burger", "unit_price": "50.00", "quantity": 2}]
        result = svc.create_order(
            business_id=BIZ_ID,
            customer_name="John",
            customer_phone="0123456789",
            fulfillment_type=FulfillmentType.COLLECTION,
            items=items,
        )

        assert isinstance(result, OnlineOrder)
        assert result.order_number == "OL-20250601-0001"
        assert result.subtotal == Decimal("100.00")
        assert result.delivery_fee == Decimal("0")
        assert result.total == Decimal("100.00")
        assert result.status == OnlineOrderStatus.PENDING
        db.commit.assert_called_once()

    @patch("app.services.online_order_service.date")
    def test_creates_delivery_order_with_fee(self, mock_date, svc, db):
        mock_date.today.return_value = date(2025, 6, 1)
        store = MagicMock(spec=OnlineStore)
        store.estimated_prep_minutes = 20
        store.delivery_fee = Decimal("25.00")
        store.free_delivery_threshold = None
        self._setup_create(db, store=store)

        items = [{"name": "Pizza", "unit_price": "80.00", "quantity": 1}]
        result = svc.create_order(
            business_id=BIZ_ID,
            customer_name="Jane",
            customer_phone="0111111111",
            fulfillment_type=FulfillmentType.DELIVERY,
            items=items,
            delivery_address="123 Main St",
        )

        assert result.subtotal == Decimal("80.00")
        assert result.delivery_fee == Decimal("25.00")
        assert result.total == Decimal("105.00")

    @patch("app.services.online_order_service.date")
    def test_free_delivery_threshold_waives_fee(self, mock_date, svc, db):
        mock_date.today.return_value = date(2025, 6, 1)
        store = MagicMock(spec=OnlineStore)
        store.estimated_prep_minutes = 30
        store.delivery_fee = Decimal("30.00")
        store.free_delivery_threshold = Decimal("100.00")
        self._setup_create(db, store=store)

        items = [{"name": "Combo", "unit_price": "120.00", "quantity": 1}]
        result = svc.create_order(
            business_id=BIZ_ID,
            customer_name="Bob",
            customer_phone="0222222222",
            fulfillment_type=FulfillmentType.DELIVERY,
            items=items,
        )

        assert result.delivery_fee == Decimal("0")
        assert result.total == Decimal("120.00")

    @patch("app.services.online_order_service.date")
    def test_multiple_items_summed(self, mock_date, svc, db):
        mock_date.today.return_value = date(2025, 6, 1)
        self._setup_create(db)

        items = [
            {"name": "A", "unit_price": "10.00", "quantity": 3},
            {"name": "B", "unit_price": "20.00", "quantity": 2},
        ]
        result = svc.create_order(
            business_id=BIZ_ID,
            customer_name="Multi",
            customer_phone="0333333333",
            fulfillment_type=FulfillmentType.COLLECTION,
            items=items,
        )

        assert result.subtotal == Decimal("70.00")
        assert result.total == Decimal("70.00")

    @patch("app.services.online_order_service.date")
    def test_order_items_added_to_db(self, mock_date, svc, db):
        mock_date.today.return_value = date(2025, 6, 1)
        self._setup_create(db)

        items = [
            {"name": "X", "unit_price": "10.00", "quantity": 1, "product_id": PRODUCT_ID},
        ]
        svc.create_order(
            business_id=BIZ_ID,
            customer_name="Test",
            customer_phone="0444444444",
            fulfillment_type=FulfillmentType.COLLECTION,
            items=items,
        )

        # 1 add for order + 1 add for the order item = 2 adds
        assert db.add.call_count == 2

    @patch("app.services.online_order_service.date")
    def test_collection_order_no_delivery_fee_even_with_store(self, mock_date, svc, db):
        mock_date.today.return_value = date(2025, 6, 1)
        store = MagicMock(spec=OnlineStore)
        store.estimated_prep_minutes = 15
        store.delivery_fee = Decimal("50.00")
        store.free_delivery_threshold = None
        self._setup_create(db, store=store)

        items = [{"name": "Salad", "unit_price": "40.00", "quantity": 1}]
        result = svc.create_order(
            business_id=BIZ_ID,
            customer_name="Col",
            customer_phone="0555555555",
            fulfillment_type=FulfillmentType.COLLECTION,
            items=items,
        )

        assert result.delivery_fee == Decimal("0")


# ── Get Order ────────────────────────────────────────────────────


class TestGetOrder:
    def test_returns_order(self, svc, db):
        order = MagicMock(spec=OnlineOrder)
        db.query.return_value = _chain(first=order)

        result = svc.get_order(ORDER_ID, BIZ_ID)

        assert result is order

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.get_order(ORDER_ID, BIZ_ID)

        assert result is None


# ── List Orders ──────────────────────────────────────────────────


class TestListOrders:
    def test_returns_items_and_total(self, svc, db):
        o1 = MagicMock(spec=OnlineOrder)
        o2 = MagicMock(spec=OnlineOrder)
        db.query.return_value = _chain(rows=[o1, o2], count=2)

        items, total = svc.list_orders(BIZ_ID)

        assert items == [o1, o2]
        assert total == 2

    def test_with_status_filter(self, svc, db):
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_orders(BIZ_ID, status=OnlineOrderStatus.PENDING)

        # filter called: once for business_id+deleted_at, once for status
        assert chain.filter.call_count == 2

    def test_empty_result(self, svc, db):
        db.query.return_value = _chain(rows=[], count=0)

        items, total = svc.list_orders(BIZ_ID)

        assert items == []
        assert total == 0


# ── Update Status ────────────────────────────────────────────────


class TestUpdateStatus:
    def test_updates_order_status(self, svc, db):
        order = MagicMock(spec=OnlineOrder)
        order.status = OnlineOrderStatus.PENDING
        db.query.return_value = _chain(first=order)

        result = svc.update_status(ORDER_ID, BIZ_ID, OnlineOrderStatus.PREPARING)

        assert result is order
        assert order.status == OnlineOrderStatus.PREPARING
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_returns_none_when_order_missing(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.update_status(ORDER_ID, BIZ_ID, OnlineOrderStatus.PREPARING)

        assert result is None
        db.commit.assert_not_called()


# ── Cancel Order ─────────────────────────────────────────────────


class TestCancelOrder:
    def test_cancels_order(self, svc, db):
        order = MagicMock(spec=OnlineOrder)
        order.status = OnlineOrderStatus.PENDING
        order.notes = None
        db.query.return_value = _chain(first=order)

        result = svc.cancel_order(ORDER_ID, BIZ_ID)

        assert result is order
        assert order.status == OnlineOrderStatus.CANCELLED
        db.commit.assert_called_once()

    def test_cancel_with_reason_appends_to_notes(self, svc, db):
        order = MagicMock(spec=OnlineOrder)
        order.status = OnlineOrderStatus.PENDING
        order.notes = "Existing note"
        db.query.return_value = _chain(first=order)

        svc.cancel_order(ORDER_ID, BIZ_ID, reason="Customer changed mind")

        assert "[Cancelled] Customer changed mind" in order.notes
        assert "Existing note" in order.notes

    def test_cancel_with_reason_no_existing_notes(self, svc, db):
        order = MagicMock(spec=OnlineOrder)
        order.status = OnlineOrderStatus.PENDING
        order.notes = None
        db.query.return_value = _chain(first=order)

        svc.cancel_order(ORDER_ID, BIZ_ID, reason="Out of stock")

        assert order.notes == "[Cancelled] Out of stock"

    def test_cancel_returns_none_when_order_missing(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.cancel_order(ORDER_ID, BIZ_ID)

        assert result is None
        db.commit.assert_not_called()


# ── Active Orders ────────────────────────────────────────────────


class TestGetActiveOrders:
    def test_returns_non_terminal_orders(self, svc, db):
        active = MagicMock(spec=OnlineOrder)
        db.query.return_value = _chain(rows=[active])

        result = svc.get_active_orders(BIZ_ID)

        assert result == [active]

    def test_returns_empty_when_all_terminal(self, svc, db):
        db.query.return_value = _chain(rows=[])

        result = svc.get_active_orders(BIZ_ID)

        assert result == []


# ── Order Stats ──────────────────────────────────────────────────


class TestGetOrderStats:
    def test_returns_stats_dict(self, svc, db):
        """get_order_stats chains many .filter().count() / .scalar() calls
        off a single base query, so every chained call returns the same mock."""
        chain = _chain(count=10, scalar=Decimal("500.00"))
        db.query.return_value = chain

        result = svc.get_order_stats(BIZ_ID)

        assert result["total_orders"] == 10
        assert result["today_orders"] == 10
        assert result["pending"] == 10
        assert result["preparing"] == 10
        assert result["completed_today"] == 10
        assert result["revenue_today"] == 500.00
        assert isinstance(result, dict)
        assert set(result.keys()) == {
            "total_orders",
            "today_orders",
            "pending",
            "preparing",
            "completed_today",
            "revenue_today",
        }
