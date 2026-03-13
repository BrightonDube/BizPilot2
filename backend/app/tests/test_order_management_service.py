"""Unit tests for OrderManagementService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services.order_management_service import (
    OrderManagementService,
)
from app.models.order import OrderStatus, OrderType
from app.models.restaurant_table import TableStatus


BIZ = uuid4()
USR = uuid4()
ORD = uuid4()
ORD2 = uuid4()
TABLE = uuid4()


def _svc():
    db = MagicMock()
    return OrderManagementService(db), db


def _chain(first=None, rows=None, count=0):
    c = MagicMock()
    c.filter.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    return c


def _order(**kw):
    o = MagicMock()
    o.id = kw.get("id", ORD)
    o.business_id = BIZ
    o.status = kw.get("status", OrderStatus.PENDING)
    o.table_id = kw.get("table_id", None)
    o.order_number = kw.get("order_number", "ORD-001")
    o.direction = "outbound"
    o.order_type = OrderType.STANDARD
    o.is_tab = kw.get("is_tab", False)
    o.customer_id = None
    o.items = kw.get("items", [])
    o.internal_notes = None
    o.delivery_fee = Decimal("0")
    o.shipping_amount = Decimal("0")
    o.subtotal = Decimal("0")
    o.tax_amount = Decimal("0")
    o.discount_amount = Decimal("0")
    o.total = Decimal("0")
    return o


# ── Status transitions ───────────────────────────────────────────────


class TestUpdateOrderStatus:
    def test_valid_transition(self):
        svc, db = _svc()
        order = _order(status=OrderStatus.PENDING)
        db.query.return_value = _chain(first=order)
        result = svc.update_order_status(ORD, BIZ, OrderStatus.CONFIRMED, user_id=USR)
        assert result.status == OrderStatus.CONFIRMED
        db.add.assert_called_once()  # history entry
        db.commit.assert_called()

    def test_invalid_transition(self):
        svc, db = _svc()
        order = _order(status=OrderStatus.CANCELLED)
        db.query.return_value = _chain(first=order)
        with pytest.raises(HTTPException) as exc:
            svc.update_order_status(ORD, BIZ, OrderStatus.CONFIRMED)
        assert exc.value.status_code == 400

    def test_order_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        with pytest.raises(HTTPException) as exc:
            svc.update_order_status(ORD, BIZ, OrderStatus.CONFIRMED)
        assert exc.value.status_code == 404

    def test_table_freed_on_cancel(self):
        svc, db = _svc()
        table = MagicMock()
        order = _order(status=OrderStatus.PENDING, table_id=TABLE)
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=order)
            return _chain(first=table)
        db.query.side_effect = side_effect
        svc.update_order_status(ORD, BIZ, OrderStatus.CANCELLED)
        assert table.status == TableStatus.DIRTY


# ── Table assignment ─────────────────────────────────────────────────


class TestAssignTable:
    def test_assign(self):
        svc, db = _svc()
        order = _order()
        table = MagicMock()
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=order)
            return _chain(first=table)
        db.query.side_effect = side_effect
        result = svc.assign_table(ORD, TABLE, BIZ)
        assert result.table_id == TABLE
        assert table.status == TableStatus.OCCUPIED

    def test_table_not_found(self):
        svc, db = _svc()
        order = _order()
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=order)
            return _chain(first=None)
        db.query.side_effect = side_effect
        with pytest.raises(HTTPException) as exc:
            svc.assign_table(ORD, TABLE, BIZ)
        assert exc.value.status_code == 404


class TestTransferTable:
    def test_transfer(self):
        svc, db = _svc()
        old_table = MagicMock()
        new_table = MagicMock()
        order = _order(table_id=TABLE)
        new_id = uuid4()
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=order)
            if call_count[0] == 2:
                return _chain(first=new_table)
            return _chain(first=old_table)
        db.query.side_effect = side_effect
        svc.transfer_table(ORD, new_id, BIZ)
        assert new_table.status == TableStatus.OCCUPIED
        assert old_table.status == TableStatus.AVAILABLE


# ── Merge and split ──────────────────────────────────────────────────


class TestMergeOrders:
    def test_merge(self):
        svc, db = _svc()
        item1 = MagicMock(deleted_at=None, unit_price=Decimal("10"), quantity=1, tax_amount=0, discount_amount=0)
        item2 = MagicMock(deleted_at=None, unit_price=Decimal("20"), quantity=1, tax_amount=0, discount_amount=0)
        o1 = _order(id=ORD, items=[item1])
        o1.order_number = "O1"
        o2 = _order(id=ORD2, items=[item2])
        o2.order_number = "O2"
        db.query.return_value = _chain(rows=[o1, o2])
        result = svc.merge_orders([ORD, ORD2], BIZ)
        assert result.id == ORD

    def test_merge_too_few(self):
        svc, db = _svc()
        with pytest.raises(HTTPException) as exc:
            svc.merge_orders([ORD], BIZ)
        assert exc.value.status_code == 400


class TestSplitOrder:
    def test_split(self):
        svc, db = _svc()
        item_id = uuid4()
        item = MagicMock()
        item.id = item_id
        item.deleted_at = None
        item.unit_price = Decimal("50")
        item.quantity = 2
        item.tax_amount = 0
        item.discount_amount = 0
        order = _order(items=[item])
        db.query.return_value = _chain(first=order)
        svc.split_order(ORD, [item_id], BIZ)
        db.add.assert_called()

    def test_split_no_items(self):
        svc, db = _svc()
        order = _order(items=[])
        db.query.return_value = _chain(first=order)
        with pytest.raises(HTTPException) as exc:
            svc.split_order(ORD, [uuid4()], BIZ)
        assert exc.value.status_code == 400


# ── Tabs ─────────────────────────────────────────────────────────────


class TestTabs:
    def test_open_tab(self):
        svc, db = _svc()
        svc.open_tab(BIZ, "Table 5")
        db.add.assert_called()
        db.commit.assert_called()

    def test_open_tab_with_table(self):
        svc, db = _svc()
        table = MagicMock()
        db.query.return_value = _chain(first=table)
        svc.open_tab(BIZ, "Tab 1", table_id=TABLE)
        assert table.status == TableStatus.OCCUPIED

    def test_close_tab(self):
        svc, db = _svc()
        order = _order(is_tab=True)
        db.query.return_value = _chain(first=order)
        result = svc.close_tab(ORD, BIZ)
        assert result.is_tab is False
        assert result.status == OrderStatus.CONFIRMED

    def test_close_tab_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        with pytest.raises(HTTPException) as exc:
            svc.close_tab(ORD, BIZ)
        assert exc.value.status_code == 404

    def test_get_open_tabs(self):
        svc, db = _svc()
        tab = _order(is_tab=True)
        db.query.return_value = _chain(rows=[tab])
        result = svc.get_open_tabs(BIZ)
        assert len(result) == 1


# ── Add/remove items ────────────────────────────────────────────────


class TestAddRemoveItems:
    def test_add_item(self):
        svc, db = _svc()
        order = _order()
        db.query.return_value = _chain(first=order)
        svc.add_item_to_order(ORD, BIZ, "Coffee", Decimal("25"), quantity=2)
        db.add.assert_called()

    def test_add_item_to_cancelled(self):
        svc, db = _svc()
        order = _order(status=OrderStatus.CANCELLED)
        db.query.return_value = _chain(first=order)
        with pytest.raises(HTTPException) as exc:
            svc.add_item_to_order(ORD, BIZ, "Coffee", Decimal("25"))
        assert exc.value.status_code == 400

    def test_remove_item(self):
        svc, db = _svc()
        order = _order()
        item = MagicMock()
        item.deleted_at = None
        item.notes = ""
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=order)
            return _chain(first=item)
        db.query.side_effect = side_effect
        svc.remove_item_from_order(ORD, uuid4(), BIZ, reason="Wrong item")
        assert item.deleted_at is not None


# ── History and delivery ─────────────────────────────────────────────


class TestOrderHistory:
    def test_basic(self):
        svc, db = _svc()
        chain = _chain(rows=[_order()], count=1)
        db.query.return_value = chain
        items, total = svc.get_order_history(BIZ)
        assert total == 1

    def test_with_filters(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        items, total = svc.get_order_history(
            BIZ, search="ORD", status_filter=OrderStatus.PENDING,
            order_type=OrderType.DELIVERY, date_from=datetime.now(),
            date_to=datetime.now(),
        )
        assert total == 0

    def test_status_history(self):
        svc, db = _svc()
        order = _order()
        hist = MagicMock()
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=order)
            return _chain(rows=[hist])
        db.query.side_effect = side_effect
        result = svc.get_status_history(ORD, BIZ)
        assert len(result) == 1


class TestDelivery:
    def test_set_delivery_info(self):
        svc, db = _svc()
        order = _order()
        db.query.return_value = _chain(first=order)
        result = svc.set_delivery_info(ORD, BIZ, delivery_address="123 Main St")
        assert result.order_type == OrderType.DELIVERY

    def test_delivery_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        with pytest.raises(HTTPException) as exc:
            svc.set_delivery_info(ORD, BIZ, delivery_address="123 Main St")
        assert exc.value.status_code == 404


# ── Recalculate totals ───────────────────────────────────────────────


class TestRecalculateTotals:
    def test_recalculate(self):
        svc, db = _svc()
        item = MagicMock()
        item.deleted_at = None
        item.unit_price = Decimal("100")
        item.quantity = 2
        item.tax_amount = Decimal("15")
        item.discount_amount = Decimal("10")
        order = _order(items=[item])
        order.delivery_fee = Decimal("50")
        order.shipping_amount = Decimal("0")
        svc._recalculate_order_totals(order)
        assert order.subtotal == Decimal("200")
        assert order.tax_amount == Decimal("15")
        assert order.total == Decimal("255")  # 200+15-10+50
