"""Tests for GRN (Goods Received Note) service."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch, call
from uuid import uuid4, UUID

import pytest

from app.models.product import Product
from app.models.reorder import (
    GoodsReceivedNote,
    GRNItem,
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseOrderStatus,
    ReorderAuditLog,
)
from app.schemas.reorder import GRNCreate, GRNItemCreate
from app.services.grn_service import GRNService


# ── Helpers ──────────────────────────────────────────────────────────

def _chain(first=None, rows=None, count=0):
    """Mock SQLAlchemy query chain."""
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


def _side_effect(*chains):
    """Build db.query.side_effect from a sequence of _chain objects."""
    idx = [0]

    def _pick(*args):
        i = idx[0]
        idx[0] += 1
        if i < len(chains):
            return chains[i]
        return _chain()

    return _pick


def _make_db():
    db = MagicMock(spec=["query", "add", "flush", "commit", "refresh"])
    return db


def _make_po(status=PurchaseOrderStatus.APPROVED, items=None):
    po = MagicMock(spec=PurchaseRequest)
    po.id = str(uuid4())
    po.business_id = str(uuid4())
    po.reference = "PO-20250101-ABC"
    po.status = status
    po.items = items or []
    po.deleted_at = None
    return po


def _make_po_item(po_id, quantity=10, received_quantity=0, product_id=None):
    item = MagicMock(spec=PurchaseRequestItem)
    item.id = str(uuid4())
    item.request_id = po_id
    item.product_id = product_id or str(uuid4())
    item.quantity = quantity
    item.received_quantity = received_quantity
    return item


def _make_product(stock=50):
    product = MagicMock(spec=Product)
    product.id = str(uuid4())
    product.stock_quantity = stock
    return product


def _make_grn(business_id=None, po_id=None):
    grn = MagicMock(spec=GoodsReceivedNote)
    grn.id = uuid4()
    grn.business_id = business_id or str(uuid4())
    grn.purchase_order_id = po_id or str(uuid4())
    grn.grn_number = "GRN-20250101-ABC123"
    grn.received_at = datetime.utcnow()
    grn.deleted_at = None
    grn.items = []
    return grn


def _make_grn_create(po_id, po_item_ids, quantities=None):
    """Build a GRNCreate schema object."""
    quantities = quantities or [5] * len(po_item_ids)
    items = [
        GRNItemCreate(
            po_item_id=str(pid),
            quantity_received=qty,
            variance=0,
            variance_reason=None,
        )
        for pid, qty in zip(po_item_ids, quantities)
    ]
    return GRNCreate(purchase_order_id=str(po_id), items=items, notes="Test delivery")


# ── GRN Number Generation ───────────────────────────────────────────


class TestGenerateGRNNumber:
    def test_format_prefix(self):
        num = GRNService._generate_grn_number()
        assert num.startswith("GRN-")

    def test_contains_timestamp_segment(self):
        num = GRNService._generate_grn_number()
        parts = num.split("-")
        # GRN - <timestamp> - <suffix>
        assert len(parts) == 3
        assert len(parts[1]) == 14  # YYYYMMDDHHmmSS

    def test_suffix_is_6_hex_uppercase(self):
        num = GRNService._generate_grn_number()
        suffix = num.split("-")[2]
        assert len(suffix) == 6
        assert suffix == suffix.upper()
        int(suffix, 16)  # must be valid hex

    def test_uniqueness(self):
        nums = {GRNService._generate_grn_number() for _ in range(50)}
        assert len(nums) == 50


# ── create_grn ───────────────────────────────────────────────────────


class TestCreateGRN:
    def test_po_not_found_raises(self):
        db = _make_db()
        db.query.return_value = _chain(first=None)
        svc = GRNService(db)

        biz = uuid4()
        data = _make_grn_create(uuid4(), [uuid4()])

        with pytest.raises(ValueError, match="Purchase order not found"):
            svc.create_grn(data, biz)

    @pytest.mark.parametrize(
        "status",
        [
            PurchaseOrderStatus.DRAFT,
            PurchaseOrderStatus.SUBMITTED,
            PurchaseOrderStatus.RECEIVED,
            PurchaseOrderStatus.CANCELLED,
        ],
    )
    def test_non_receivable_status_raises(self, status):
        po = _make_po(status=status)
        db = _make_db()
        db.query.return_value = _chain(first=po)
        svc = GRNService(db)

        data = _make_grn_create(po.id, [uuid4()])

        with pytest.raises(ValueError, match="not receivable"):
            svc.create_grn(data, uuid4())

    def test_po_item_not_found_raises(self):
        po = _make_po(status=PurchaseOrderStatus.APPROVED)
        db = _make_db()
        # 1st query → PO found, 2nd query → PO item not found
        db.query.side_effect = _side_effect(
            _chain(first=po),
            _chain(first=None),
        )
        svc = GRNService(db)

        data = _make_grn_create(po.id, [uuid4()])

        with pytest.raises(ValueError, match="PO item .* not found"):
            svc.create_grn(data, uuid4())

    def test_success_single_item_fully_received(self):
        biz = uuid4()
        po_item = _make_po_item("po-1", quantity=10, received_quantity=0)
        product = _make_product(stock=50)
        po = _make_po(status=PurchaseOrderStatus.APPROVED, items=[po_item])

        db = _make_db()
        db.query.side_effect = _side_effect(
            _chain(first=po),       # PO lookup
            _chain(first=po_item),  # PO item lookup
            _chain(first=product),  # product lookup
        )
        svc = GRNService(db)

        data = _make_grn_create(po.id, [po_item.id], quantities=[10])
        result = svc.create_grn(data, biz, received_by=uuid4())

        # PO item received_quantity updated
        assert po_item.received_quantity == 10
        # Product stock updated
        assert product.stock_quantity == 60
        # PO marked RECEIVED (all items fully received)
        assert po.status == PurchaseOrderStatus.RECEIVED
        # db interactions
        assert db.commit.called
        assert db.refresh.called

    def test_success_partial_receive(self):
        biz = uuid4()
        po_item = _make_po_item("po-1", quantity=10, received_quantity=0)
        product = _make_product(stock=50)
        po = _make_po(status=PurchaseOrderStatus.APPROVED, items=[po_item])

        db = _make_db()
        db.query.side_effect = _side_effect(
            _chain(first=po),
            _chain(first=po_item),
            _chain(first=product),
        )
        svc = GRNService(db)

        data = _make_grn_create(po.id, [po_item.id], quantities=[3])
        svc.create_grn(data, biz)

        assert po_item.received_quantity == 3
        assert product.stock_quantity == 53
        assert po.status == PurchaseOrderStatus.PARTIALLY_RECEIVED

    def test_success_multiple_items(self):
        biz = uuid4()
        po_item1 = _make_po_item("po-1", quantity=10, received_quantity=0)
        po_item2 = _make_po_item("po-1", quantity=5, received_quantity=0)
        product1 = _make_product(stock=20)
        product2 = _make_product(stock=30)
        po = _make_po(status=PurchaseOrderStatus.ORDERED, items=[po_item1, po_item2])

        db = _make_db()
        db.query.side_effect = _side_effect(
            _chain(first=po),
            _chain(first=po_item1),
            _chain(first=product1),
            _chain(first=po_item2),
            _chain(first=product2),
        )
        svc = GRNService(db)

        data = _make_grn_create(
            po.id, [po_item1.id, po_item2.id], quantities=[10, 5]
        )
        svc.create_grn(data, biz)

        assert po_item1.received_quantity == 10
        assert po_item2.received_quantity == 5
        assert product1.stock_quantity == 30
        assert product2.stock_quantity == 35
        assert po.status == PurchaseOrderStatus.RECEIVED

    def test_product_not_found_skips_stock_update(self):
        biz = uuid4()
        po_item = _make_po_item("po-1", quantity=10, received_quantity=0)
        po = _make_po(status=PurchaseOrderStatus.APPROVED, items=[po_item])

        db = _make_db()
        db.query.side_effect = _side_effect(
            _chain(first=po),
            _chain(first=po_item),
            _chain(first=None),  # product not found
        )
        svc = GRNService(db)

        data = _make_grn_create(po.id, [po_item.id], quantities=[10])
        svc.create_grn(data, biz)

        assert po_item.received_quantity == 10
        assert db.commit.called

    def test_adds_grn_header_and_items(self):
        biz = uuid4()
        po_item = _make_po_item("po-1", quantity=10, received_quantity=0)
        product = _make_product(stock=0)
        po = _make_po(status=PurchaseOrderStatus.APPROVED, items=[po_item])

        db = _make_db()
        db.query.side_effect = _side_effect(
            _chain(first=po),
            _chain(first=po_item),
            _chain(first=product),
        )
        svc = GRNService(db)

        data = _make_grn_create(po.id, [po_item.id], quantities=[10])
        svc.create_grn(data, biz)

        # Should have added: GRN header, GRN item, audit log = 3 add calls
        assert db.add.call_count == 3
        added = [c.args[0] for c in db.add.call_args_list]
        types = {type(a) for a in added}
        assert GoodsReceivedNote in types
        assert GRNItem in types
        assert ReorderAuditLog in types

    def test_audit_log_details(self):
        biz = uuid4()
        user = uuid4()
        po_item = _make_po_item("po-1", quantity=10, received_quantity=0)
        product = _make_product(stock=0)
        po = _make_po(status=PurchaseOrderStatus.APPROVED, items=[po_item])

        db = _make_db()
        db.query.side_effect = _side_effect(
            _chain(first=po),
            _chain(first=po_item),
            _chain(first=product),
        )
        svc = GRNService(db)

        data = _make_grn_create(po.id, [po_item.id], quantities=[10])
        svc.create_grn(data, biz, received_by=user)

        audit = [c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], ReorderAuditLog)][0]
        assert audit.action == "goods_received"
        assert audit.entity_type == "goods_received_note"
        assert audit.performed_by == user
        assert audit.is_automated is False
        assert audit.details["items_count"] == 1

    def test_cumulative_received_quantity(self):
        """Receiving on an item that already has partial receipt."""
        biz = uuid4()
        po_item = _make_po_item("po-1", quantity=10, received_quantity=4)
        product = _make_product(stock=50)
        po = _make_po(status=PurchaseOrderStatus.PARTIALLY_RECEIVED, items=[po_item])

        db = _make_db()
        db.query.side_effect = _side_effect(
            _chain(first=po),
            _chain(first=po_item),
            _chain(first=product),
        )
        svc = GRNService(db)

        data = _make_grn_create(po.id, [po_item.id], quantities=[6])
        svc.create_grn(data, biz)

        assert po_item.received_quantity == 10
        assert product.stock_quantity == 56
        assert po.status == PurchaseOrderStatus.RECEIVED

    def test_none_received_quantity_treated_as_zero(self):
        """po_item.received_quantity=None is treated as 0."""
        biz = uuid4()
        po_item = _make_po_item("po-1", quantity=10, received_quantity=None)
        product = _make_product(stock=None)
        po = _make_po(status=PurchaseOrderStatus.APPROVED, items=[po_item])

        db = _make_db()
        db.query.side_effect = _side_effect(
            _chain(first=po),
            _chain(first=po_item),
            _chain(first=product),
        )
        svc = GRNService(db)

        data = _make_grn_create(po.id, [po_item.id], quantities=[5])
        svc.create_grn(data, biz)

        assert po_item.received_quantity == 5
        assert product.stock_quantity == 5


# ── list_grns ────────────────────────────────────────────────────────


class TestListGRNs:
    def test_returns_items_and_total(self):
        biz = uuid4()
        grn1 = _make_grn(business_id=str(biz))
        grn2 = _make_grn(business_id=str(biz))

        db = _make_db()
        db.query.return_value = _chain(rows=[grn1, grn2], count=2)
        svc = GRNService(db)

        items, total = svc.list_grns(biz)
        assert items == [grn1, grn2]
        assert total == 2

    def test_with_purchase_order_filter(self):
        biz = uuid4()
        po_id = uuid4()

        chain = _chain(rows=[], count=0)
        db = _make_db()
        db.query.return_value = chain
        svc = GRNService(db)

        items, total = svc.list_grns(biz, purchase_order_id=po_id)
        assert items == []
        assert total == 0
        # filter should have been called (at least twice: base + PO filter)
        assert chain.filter.call_count >= 2

    def test_pagination(self):
        biz = uuid4()
        chain = _chain(rows=[], count=5)
        db = _make_db()
        db.query.return_value = chain
        svc = GRNService(db)

        svc.list_grns(biz, page=2, per_page=3)
        chain.offset.assert_called_with(3)  # (2-1)*3
        chain.limit.assert_called_with(3)

    def test_empty_result(self):
        db = _make_db()
        db.query.return_value = _chain(rows=[], count=0)
        svc = GRNService(db)

        items, total = svc.list_grns(uuid4())
        assert items == []
        assert total == 0


# ── get_grn ──────────────────────────────────────────────────────────


class TestGetGRN:
    def test_returns_grn_when_found(self):
        biz = uuid4()
        grn = _make_grn(business_id=str(biz))

        db = _make_db()
        db.query.return_value = _chain(first=grn)
        svc = GRNService(db)

        result = svc.get_grn(grn.id, biz)
        assert result is grn

    def test_returns_none_when_not_found(self):
        db = _make_db()
        db.query.return_value = _chain(first=None)
        svc = GRNService(db)

        result = svc.get_grn(uuid4(), uuid4())
        assert result is None
