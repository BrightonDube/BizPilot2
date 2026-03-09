"""Unit tests for TrackedBulkOperationService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.services.tracked_bulk_service import TrackedBulkOperationService
from app.models.bulk_operation import BulkOperationType, OperationStatus, ItemStatus


BIZ = str(uuid4())
USR = str(uuid4())
PID1 = str(uuid4())
PID2 = str(uuid4())
CAT = str(uuid4())
SUP = str(uuid4())


def _svc():
    db = MagicMock()
    return TrackedBulkOperationService(db), db


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


def _product(pid=None, price=100):
    p = MagicMock()
    p.id = pid or uuid4()
    p.selling_price = Decimal(str(price))
    p.category_id = None
    p.deleted_at = None
    return p


def _inv(qty=50):
    i = MagicMock()
    i.quantity_on_hand = qty
    i.deleted_at = None
    return i


# ── Operation lifecycle ──────────────────────────────────────────────


class TestOperationLifecycle:
    def test_create_operation(self):
        svc, db = _svc()
        op = svc.create_operation(
            operation_type=BulkOperationType.PRICE_UPDATE,
            user_id=USR, business_id=BIZ, total_records=5,
        )
        db.add.assert_called_once()
        assert op.processed_records == 0

    def test_get_operation(self):
        svc, db = _svc()
        op = MagicMock()
        db.query.return_value = _chain(first=op)
        assert svc.get_operation("x") == op

    def test_list_operations(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[MagicMock()], count=1)
        items, total = svc.list_operations(BIZ)
        assert total == 1

    def test_list_operations_filtered(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.list_operations(BIZ, status="completed", operation_type="price_update")
        assert chain.filter.call_count >= 1

    def test_cancel_operation(self):
        svc, db = _svc()
        op = MagicMock()
        op.is_terminal = False
        db.query.return_value = _chain(first=op)
        assert svc.cancel_operation("x") is True
        assert op.status == OperationStatus.CANCELLED.value

    def test_cancel_terminal(self):
        svc, db = _svc()
        op = MagicMock()
        op.is_terminal = True
        db.query.return_value = _chain(first=op)
        assert svc.cancel_operation("x") is False

    def test_cancel_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.cancel_operation("x") is False


# ── Validation ───────────────────────────────────────────────────────


class TestValidatePriceUpdate:
    def test_valid(self):
        svc, db = _svc()
        p = _product(pid=PID1)
        db.query.return_value = _chain(rows=[p])
        result = svc.validate_price_update(BIZ, [str(p.id)], "percentage", 10)
        assert result.is_valid is True
        assert result.valid_records == 1

    def test_invalid_type(self):
        svc, db = _svc()
        result = svc.validate_price_update(BIZ, [PID1], "bogus", 10)
        assert result.is_valid is False

    def test_negative_price(self):
        svc, db = _svc()
        p = _product(pid=PID1, price=10)
        db.query.return_value = _chain(rows=[p])
        result = svc.validate_price_update(BIZ, [str(p.id)], "increment", -20)
        assert result.is_valid is False

    def test_missing_product(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        result = svc.validate_price_update(BIZ, [PID1], "fixed", 50)
        assert result.is_valid is False
        assert result.invalid_records == 1


class TestValidateStockAdjustment:
    def test_valid(self):
        svc, db = _svc()
        inv = _inv(qty=50)
        db.query.return_value = _chain(first=inv)
        result = svc.validate_stock_adjustment(BIZ, [{"product_id": PID1, "quantity_change": -10}])
        assert result.is_valid is True

    def test_negative_result(self):
        svc, db = _svc()
        inv = _inv(qty=5)
        db.query.return_value = _chain(first=inv)
        result = svc.validate_stock_adjustment(BIZ, [{"product_id": PID1, "quantity_change": -10}])
        assert result.is_valid is False

    def test_missing_item(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.validate_stock_adjustment(BIZ, [{"product_id": PID1, "quantity_change": 5}])
        assert result.is_valid is False


# ── Price update execution ───────────────────────────────────────────


class TestExecutePriceUpdate:
    def test_percentage(self):
        svc, db = _svc()
        p = _product(pid=PID1, price=100)
        db.query.return_value = _chain(rows=[p])
        op = svc.execute_price_update(USR, BIZ, [str(p.id)], "percentage", 10)
        assert op.successful_records == 1
        assert op.failed_records == 0

    def test_product_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        op = svc.execute_price_update(USR, BIZ, [PID1], "fixed", 50)
        assert op.failed_records == 1
        assert op.successful_records == 0


# ── Stock adjustment execution ───────────────────────────────────────


class TestExecuteStockAdjustment:
    def test_success(self):
        svc, db = _svc()
        inv = _inv(qty=50)
        db.query.return_value = _chain(first=inv)
        adjs = [{"product_id": PID1, "quantity_change": -10, "reason": "count"}]
        op = svc.execute_stock_adjustment(USR, BIZ, adjs)
        assert op.successful_records == 1

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        adjs = [{"product_id": PID1, "quantity_change": 5}]
        op = svc.execute_stock_adjustment(USR, BIZ, adjs)
        assert op.failed_records == 1


# ── Category assign execution ────────────────────────────────────────


class TestExecuteCategoryAssign:
    def test_success(self):
        svc, db = _svc()
        p = _product(pid=PID1)
        db.query.return_value = _chain(rows=[p])
        op = svc.execute_category_assign(USR, BIZ, [str(p.id)], CAT)
        assert op.successful_records == 1


# ── Supplier assign execution ────────────────────────────────────────


class TestExecuteSupplierAssign:
    def test_new_link(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        op = svc.execute_supplier_assign(USR, BIZ, [PID1], SUP)
        assert op.successful_records == 1

    def test_existing_link(self):
        svc, db = _svc()
        existing = MagicMock()
        existing.is_primary = False
        db.query.return_value = _chain(first=existing)
        op = svc.execute_supplier_assign(USR, BIZ, [PID1], SUP, is_primary=True)
        assert op.successful_records == 1


# ── Rollback ─────────────────────────────────────────────────────────


class TestRollback:
    def test_rollback_price(self):
        svc, db = _svc()
        op = MagicMock()
        op.operation_type = BulkOperationType.PRICE_UPDATE.value
        item = MagicMock()
        item.status = ItemStatus.SUCCESS.value
        item.before_data = {"selling_price": 100.0}
        item.record_id = PID1
        product = MagicMock()
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=op)  # get_operation
            if call_count[0] == 2:
                return _chain(rows=[item])  # items
            return _chain(first=product)  # product
        db.query.side_effect = side_effect
        rolled, failed = svc.rollback_operation("x")
        assert rolled == 1
        assert failed == 0

    def test_rollback_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.rollback_operation("x") == (0, 0)


# ── Operation items ──────────────────────────────────────────────────


class TestOperationItems:
    def test_list(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[MagicMock()], count=5)
        items, total = svc.get_operation_items("x")
        assert total == 5

    def test_list_filtered(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.get_operation_items("x", status="failed")
        assert chain.filter.call_count >= 1
