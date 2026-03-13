"""Unit tests for OrderService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4


from app.services.order_service import OrderService
from app.models.order import OrderStatus, PaymentStatus, OrderDirection
from app.schemas.order import OrderCreate, OrderUpdate, OrderItemCreate, OrderItemModifierCreate


BIZ = str(uuid4())
ORD_ID = str(uuid4())
ITEM_ID = str(uuid4())


def _svc():
    db = MagicMock()
    return OrderService(db), db


def _chain(first=None, rows=None, count=0):
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = None
    return c


def _mock_order(**kw):
    o = MagicMock()
    o.id = kw.get("id", uuid4())
    o.business_id = kw.get("business_id", BIZ)
    o.order_number = kw.get("order_number", "ORD-20250101-00001")
    o.status = kw.get("status", OrderStatus.DRAFT)
    o.payment_status = kw.get("payment_status", PaymentStatus.PENDING)
    o.direction = kw.get("direction", OrderDirection.INBOUND)
    o.total = kw.get("total", Decimal("100.00"))
    o.subtotal = kw.get("subtotal", Decimal("100.00"))
    o.tax_amount = kw.get("tax_amount", Decimal("0"))
    o.discount_amount = kw.get("discount_amount", Decimal("0"))
    o.shipping_amount = kw.get("shipping_amount", Decimal("0"))
    o.amount_paid = kw.get("amount_paid", Decimal("0"))
    o.items = kw.get("items", [])
    o.deleted_at = None
    o.shipped_date = None
    o.delivered_date = None
    return o


def _mock_item(**kw):
    i = MagicMock()
    i.id = kw.get("id", uuid4())
    i.order_id = kw.get("order_id", uuid4())
    i.name = kw.get("name", "Test Item")
    i.unit_price = kw.get("unit_price", Decimal("25.00"))
    i.quantity = kw.get("quantity", 2)
    i.tax_rate = kw.get("tax_rate", Decimal("15.00"))
    i.tax_amount = kw.get("tax_amount", Decimal("7.50"))
    i.discount_percent = kw.get("discount_percent", Decimal("0"))
    i.discount_amount = kw.get("discount_amount", Decimal("0"))
    i.total = kw.get("total", Decimal("57.50"))
    i.deleted_at = None
    i.item_modifiers = kw.get("item_modifiers", [])
    return i


# ── generate_order_number ────────────────────────────────────────────


class TestGenerateOrderNumber:
    def test_format(self):
        """Order number matches ORD-YYYYMMDD-XXXXX."""
        svc, db = _svc()
        db.query.return_value = _chain(count=0)
        number = svc.generate_order_number(BIZ)
        parts = number.split("-")
        assert len(parts) == 3
        assert parts[0] == "ORD"
        assert len(parts[1]) == 8
        assert parts[2] == "00001"

    def test_increments_based_on_count(self):
        """Counter reflects existing order count."""
        svc, db = _svc()
        db.query.return_value = _chain(count=41)
        number = svc.generate_order_number(BIZ)
        assert number.endswith("00042")


# ── get_orders ───────────────────────────────────────────────────────


class TestGetOrders:
    def test_returns_orders_and_total(self):
        svc, db = _svc()
        chain = _chain(rows=[_mock_order()], count=1)
        db.query.return_value = chain
        orders, total = svc.get_orders(BIZ)
        assert total == 1
        assert len(orders) == 1

    def test_empty_result(self):
        svc, db = _svc()
        db.query.return_value = _chain()
        orders, total = svc.get_orders(BIZ)
        assert total == 0
        assert orders == []

    def test_search_adds_filter(self):
        svc, db = _svc()
        chain = _chain()
        db.query.return_value = chain
        svc.get_orders(BIZ, search="ORD-123")
        assert chain.filter.call_count >= 2

    def test_all_filters(self):
        """Handles every optional filter without error."""
        svc, db = _svc()
        db.query.return_value = _chain()
        orders, total = svc.get_orders(
            BIZ,
            search="widget",
            customer_id="c1",
            supplier_id="s1",
            direction=OrderDirection.INBOUND,
            status=OrderStatus.PENDING,
            payment_status=PaymentStatus.PAID,
            date_from=datetime(2025, 1, 1),
            date_to=datetime(2025, 12, 31),
            sort_by="total",
            sort_order="asc",
        )
        assert total == 0

    def test_pagination(self):
        svc, db = _svc()
        chain = _chain(rows=[_mock_order()], count=50)
        db.query.return_value = chain
        orders, total = svc.get_orders(BIZ, page=3, per_page=10)
        assert total == 50
        chain.offset.assert_called_with(20)
        chain.limit.assert_called_with(10)


# ── get_order / get_order_by_number ──────────────────────────────────


class TestGetOrder:
    def test_found(self):
        svc, db = _svc()
        order = _mock_order()
        db.query.return_value = _chain(first=order)
        assert svc.get_order(ORD_ID, BIZ) is order

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.get_order(ORD_ID, BIZ) is None


class TestGetOrderByNumber:
    def test_found(self):
        svc, db = _svc()
        order = _mock_order(order_number="ORD-20250101-00001")
        db.query.return_value = _chain(first=order)
        result = svc.get_order_by_number("ORD-20250101-00001", BIZ)
        assert result is order

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.get_order_by_number("NOPE", BIZ) is None


# ── create_order ─────────────────────────────────────────────────────


class TestCreateOrder:
    def test_with_items(self):
        """Creates order, adds items, calculates totals, commits."""
        svc, db = _svc()
        item_data = OrderItemCreate(
            name="Widget",
            unit_price=Decimal("10.00"),
            quantity=2,
            tax_rate=Decimal("15"),
            discount_percent=Decimal("0"),
        )
        data = OrderCreate(items=[item_data])

        mock_item = _mock_item(
            unit_price=Decimal("10.00"), quantity=2,
            tax_amount=Decimal("3.00"), discount_amount=Decimal("0"),
        )
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(count=0)          # generate_order_number
            return _chain(rows=[mock_item])      # _calculate_order_totals
        db.query.side_effect = side_effect

        order = svc.create_order(BIZ, data)
        assert order.order_number.startswith("ORD-")
        db.add.assert_called()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_no_items(self):
        svc, db = _svc()
        data = OrderCreate(items=[])

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(count=5)
            return _chain(rows=[])
        db.query.side_effect = side_effect

        order = svc.create_order(BIZ, data)
        assert order.order_number.endswith("00006")
        db.commit.assert_called_once()

    def test_with_modifiers(self):
        """Modifier records are added to the session."""
        svc, db = _svc()
        modifier = OrderItemModifierCreate(
            modifier_id="mod-1",
            modifier_name="Extra Cheese",
            group_name="Toppings",
            quantity=1,
            unit_price=Decimal("5.00"),
            total_price=Decimal("5.00"),
        )
        item_data = OrderItemCreate(
            name="Pizza",
            unit_price=Decimal("50.00"),
            quantity=1,
            tax_rate=Decimal("0"),
            discount_percent=Decimal("0"),
            modifiers=[modifier],
        )
        data = OrderCreate(items=[item_data])

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(count=0)
            return _chain(rows=[])
        db.query.side_effect = side_effect

        svc.create_order(BIZ, data)
        # order + item + modifier = at least 3 adds
        assert db.add.call_count >= 3


# ── update_order ─────────────────────────────────────────────────────


class TestUpdateOrder:
    def test_applies_fields_and_recalculates(self):
        svc, db = _svc()
        order = _mock_order()
        data = OrderUpdate(notes="Updated notes")
        db.query.return_value = _chain(rows=[])

        svc.update_order(order, data)
        assert order.notes == "Updated notes"
        db.commit.assert_called_once()
        db.refresh.assert_called_once()


# ── update_order_status ──────────────────────────────────────────────


class TestUpdateOrderStatus:
    def test_shipped_sets_date(self):
        svc, db = _svc()
        order = _mock_order()
        svc.update_order_status(order, OrderStatus.SHIPPED)
        assert order.status == OrderStatus.SHIPPED
        assert order.shipped_date is not None
        db.commit.assert_called_once()

    def test_delivered_sets_date(self):
        svc, db = _svc()
        order = _mock_order()
        svc.update_order_status(order, OrderStatus.DELIVERED)
        assert order.status == OrderStatus.DELIVERED
        assert order.delivered_date is not None

    def test_other_status_no_dates(self):
        svc, db = _svc()
        order = _mock_order()
        svc.update_order_status(order, OrderStatus.CONFIRMED)
        assert order.status == OrderStatus.CONFIRMED
        assert order.shipped_date is None
        assert order.delivered_date is None


# ── record_payment ───────────────────────────────────────────────────


class TestRecordPayment:
    def test_full_payment_sets_paid(self):
        svc, db = _svc()
        order = _mock_order(total=Decimal("100"), amount_paid=Decimal("0"))
        svc.record_payment(order, Decimal("100"), "credit_card")
        assert order.payment_status == PaymentStatus.PAID
        assert order.payment_method == "credit_card"
        db.commit.assert_called_once()

    def test_partial_payment(self):
        svc, db = _svc()
        order = _mock_order(total=Decimal("100"), amount_paid=Decimal("0"))
        svc.record_payment(order, Decimal("30"), "cash")
        assert order.payment_status == PaymentStatus.PARTIAL

    def test_overpayment_still_paid(self):
        svc, db = _svc()
        order = _mock_order(total=Decimal("50"), amount_paid=Decimal("0"))
        svc.record_payment(order, Decimal("75"), "cash")
        assert order.payment_status == PaymentStatus.PAID


# ── delete_order ─────────────────────────────────────────────────────


class TestDeleteOrder:
    def test_soft_deletes(self):
        svc, db = _svc()
        order = _mock_order()
        svc.delete_order(order)
        order.soft_delete.assert_called_once()
        db.commit.assert_called_once()


# ── get_order_items ──────────────────────────────────────────────────


class TestGetOrderItems:
    def test_returns_items(self):
        svc, db = _svc()
        items = [_mock_item(), _mock_item()]
        db.query.return_value = _chain(rows=items)
        result = svc.get_order_items(ORD_ID)
        assert len(result) == 2


# ── add_order_item ───────────────────────────────────────────────────


class TestAddOrderItem:
    def test_adds_and_recalculates(self):
        svc, db = _svc()
        order = _mock_order()
        data = OrderItemCreate(
            name="Extra Widget",
            unit_price=Decimal("15.00"),
            quantity=1,
            tax_rate=Decimal("0"),
            discount_percent=Decimal("0"),
        )
        db.query.return_value = _chain(rows=[])

        svc.add_order_item(order, data)
        db.add.assert_called_once()
        db.flush.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()


# ── remove_order_item ────────────────────────────────────────────────


class TestRemoveOrderItem:
    def test_removes_and_recalculates(self):
        svc, db = _svc()
        order = _mock_order()
        item = _mock_item()

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=item)   # find item
            return _chain(rows=[])           # _calculate_order_totals
        db.query.side_effect = side_effect

        svc.remove_order_item(order, ITEM_ID)
        item.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_item_not_found_no_op(self):
        svc, db = _svc()
        order = _mock_order()
        db.query.return_value = _chain(first=None)
        svc.remove_order_item(order, ITEM_ID)
        db.commit.assert_not_called()


# ── get_order_stats ──────────────────────────────────────────────────


class TestGetOrderStats:
    def test_returns_aggregated_stats(self):
        svc, db = _svc()
        orders_chain = _chain(count=10)
        revenue_chain = _chain()
        revenue_chain.scalar.return_value = Decimal("5000")

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return orders_chain
            return revenue_chain
        db.query.side_effect = side_effect

        stats = svc.get_order_stats(BIZ)
        assert stats["total_orders"] == 10
        assert stats["total_revenue"] == Decimal("5000")
        assert stats["average_order_value"] == Decimal("500")

    def test_zero_orders_no_division_error(self):
        svc, db = _svc()
        orders_chain = _chain(count=0)
        revenue_chain = _chain()

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return orders_chain
            return revenue_chain
        db.query.side_effect = side_effect

        stats = svc.get_order_stats(BIZ)
        assert stats["total_orders"] == 0
        assert stats["total_revenue"] == Decimal("0")
        assert stats["average_order_value"] == Decimal("0")
