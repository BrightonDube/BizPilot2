"""Unit tests for ReorderService."""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4


from app.models.inventory import InventoryItem
from app.models.product import Product
from app.models.reorder import (
    PurchaseOrderStatus,
    PurchaseRequest,
    PurchaseRequestItem,
    ReorderRule,
    ReorderRuleStatus,
)
from app.services.reorder_service import ReorderService


BIZ_ID = str(uuid4())
PRODUCT_ID = str(uuid4())
SUPPLIER_ID = str(uuid4())
USER_ID = str(uuid4())
RULE_ID = str(uuid4())
REQUEST_ID = str(uuid4())


def _svc():
    db = MagicMock()
    return ReorderService(db), db


def _chain(first=None, count=0, rows=None):
    """Helper to create fluent query chain mocks."""
    chain = MagicMock()
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.offset.return_value = chain
    chain.limit.return_value = chain
    chain.all.return_value = rows if rows is not None else []
    chain.first.return_value = first
    chain.count.return_value = count
    return chain


def _make_rule(**overrides):
    rule = MagicMock(spec=ReorderRule)
    rule.id = overrides.get("id", uuid4())
    rule.business_id = overrides.get("business_id", BIZ_ID)
    rule.product_id = overrides.get("product_id", PRODUCT_ID)
    rule.supplier_id = overrides.get("supplier_id", None)
    rule.min_stock_level = overrides.get("min_stock_level", 10)
    rule.reorder_quantity = overrides.get("reorder_quantity", 50)
    rule.max_stock_level = overrides.get("max_stock_level", None)
    rule.lead_time_days = overrides.get("lead_time_days", 7)
    rule.auto_approve = overrides.get("auto_approve", False)
    rule.status = overrides.get("status", ReorderRuleStatus.ACTIVE)
    rule.supplier = overrides.get("supplier", None)
    rule.last_triggered_at = None
    return rule


def _make_product(**overrides):
    product = MagicMock(spec=Product)
    product.id = overrides.get("id", uuid4())
    product.business_id = overrides.get("business_id", BIZ_ID)
    product.name = overrides.get("name", "Test Product")
    product.quantity = overrides.get("quantity", 5)
    product.cost_price = overrides.get("cost_price", Decimal("10.00"))
    product.deleted_at = None
    product.track_inventory = overrides.get("track_inventory", True)
    product.low_stock_threshold = overrides.get("low_stock_threshold", 10)
    return product


def _make_pr(**overrides):
    pr = MagicMock(spec=PurchaseRequest)
    pr.id = overrides.get("id", uuid4())
    pr.business_id = overrides.get("business_id", BIZ_ID)
    pr.status = overrides.get("status", PurchaseOrderStatus.DRAFT)
    pr.total_amount = overrides.get("total_amount", Decimal("0"))
    pr.deleted_at = None
    return pr


def _make_pr_item(**overrides):
    item = MagicMock(spec=PurchaseRequestItem)
    item.id = overrides.get("id", uuid4())
    item.request_id = overrides.get("request_id", REQUEST_ID)
    item.product_id = overrides.get("product_id", PRODUCT_ID)
    item.quantity = overrides.get("quantity", 50)
    item.unit_cost = overrides.get("unit_cost", Decimal("10.00"))
    item.total = overrides.get("total", Decimal("500.00"))
    item.received_quantity = overrides.get("received_quantity", 0)
    return item


# ── create_rule ─────────────────────────────────────────────────────


class TestCreateRule:
    def test_create_rule_basic(self):
        svc, db = _svc()
        svc.create_rule(BIZ_ID, PRODUCT_ID, min_stock=10, reorder_qty=50)
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, ReorderRule)
        assert added.min_stock_level == 10
        assert added.reorder_quantity == 50
        assert added.status == ReorderRuleStatus.ACTIVE

    def test_create_rule_with_optional_params(self):
        svc, db = _svc()
        svc.create_rule(
            BIZ_ID, PRODUCT_ID,
            min_stock=5, reorder_qty=100,
            supplier_id=SUPPLIER_ID,
            max_stock=200,
            lead_time=14,
            auto_approve=True,
        )
        added = db.add.call_args[0][0]
        assert added.supplier_id == SUPPLIER_ID
        assert added.max_stock_level == 200
        assert added.lead_time_days == 14
        assert added.auto_approve is True


# ── list_rules ──────────────────────────────────────────────────────


class TestListRules:
    def test_list_rules_no_filter(self):
        svc, db = _svc()
        r1, r2 = _make_rule(), _make_rule()
        db.query.return_value = _chain(rows=[r1, r2])
        result = svc.list_rules(BIZ_ID)
        assert len(result) == 2

    def test_list_rules_with_status_filter(self):
        svc, db = _svc()
        r1 = _make_rule(status=ReorderRuleStatus.ACTIVE)
        chain = _chain(rows=[r1])
        db.query.return_value = chain
        result = svc.list_rules(BIZ_ID, status=ReorderRuleStatus.ACTIVE)
        assert len(result) == 1
        # filter() called twice: once for biz+deleted, once for status
        assert chain.filter.call_count == 2

    def test_list_rules_empty(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        result = svc.list_rules(BIZ_ID)
        assert result == []


# ── update_rule ─────────────────────────────────────────────────────


class TestUpdateRule:
    def test_update_rule_success(self):
        svc, db = _svc()
        rule = _make_rule()
        db.query.return_value = _chain(first=rule)
        result = svc.update_rule(str(rule.id), BIZ_ID, min_stock_level=20)
        assert result is rule
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(rule)

    def test_update_rule_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.update_rule(str(uuid4()), BIZ_ID, min_stock_level=20)
        assert result is None
        db.commit.assert_not_called()


# ── toggle_rule ─────────────────────────────────────────────────────


class TestToggleRule:
    def test_toggle_active_to_paused(self):
        svc, db = _svc()
        rule = _make_rule(status=ReorderRuleStatus.ACTIVE)
        db.query.return_value = _chain(first=rule)
        result = svc.toggle_rule(str(rule.id), BIZ_ID)
        assert result.status == ReorderRuleStatus.PAUSED
        db.commit.assert_called_once()

    def test_toggle_paused_to_active(self):
        svc, db = _svc()
        rule = _make_rule(status=ReorderRuleStatus.PAUSED)
        db.query.return_value = _chain(first=rule)
        result = svc.toggle_rule(str(rule.id), BIZ_ID)
        assert result.status == ReorderRuleStatus.ACTIVE

    def test_toggle_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.toggle_rule(str(uuid4()), BIZ_ID)
        assert result is None


# ── check_stock_levels ──────────────────────────────────────────────


class TestCheckStockLevels:
    def test_low_stock_detected(self):
        svc, db = _svc()
        pid = uuid4()
        rule = _make_rule(product_id=pid, min_stock_level=10, reorder_quantity=50, supplier_id=None, supplier=None)
        product = _make_product(id=pid, quantity=5, cost_price=Decimal("25.00"))
        call_count = [0]

        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[rule])
            return _chain(first=product)

        db.query.side_effect = side_effect
        result = svc.check_stock_levels(BIZ_ID)
        assert len(result) == 1
        assert result[0]["product_id"] == str(pid)
        assert result[0]["current_stock"] == 5
        assert result[0]["unit_cost"] == Decimal("25.00")

    def test_stock_above_threshold(self):
        svc, db = _svc()
        pid = uuid4()
        rule = _make_rule(product_id=pid, min_stock_level=10)
        product = _make_product(id=pid, quantity=50)
        call_count = [0]

        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[rule])
            return _chain(first=product)

        db.query.side_effect = side_effect
        result = svc.check_stock_levels(BIZ_ID)
        assert len(result) == 0

    def test_product_not_found_skipped(self):
        svc, db = _svc()
        rule = _make_rule()
        call_count = [0]

        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[rule])
            return _chain(first=None)

        db.query.side_effect = side_effect
        result = svc.check_stock_levels(BIZ_ID)
        assert result == []

    def test_multiple_rules_mixed_stock(self):
        svc, db = _svc()
        pid1, pid2 = uuid4(), uuid4()
        rule1 = _make_rule(product_id=pid1, min_stock_level=10, supplier=None, supplier_id=None)
        rule2 = _make_rule(product_id=pid2, min_stock_level=5, supplier=None, supplier_id=None)
        prod1 = _make_product(id=pid1, quantity=3, cost_price=Decimal("10.00"))   # below
        prod2 = _make_product(id=pid2, quantity=100, cost_price=Decimal("20.00"))  # above
        call_count = [0]

        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[rule1, rule2])
            elif call_count[0] == 2:
                return _chain(first=prod1)
            else:
                return _chain(first=prod2)

        db.query.side_effect = side_effect
        result = svc.check_stock_levels(BIZ_ID)
        assert len(result) == 1
        assert result[0]["product_id"] == str(pid1)

    def test_no_active_rules(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        result = svc.check_stock_levels(BIZ_ID)
        assert result == []


# ── generate_purchase_request ───────────────────────────────────────


class TestGeneratePurchaseRequest:
    def test_generate_basic(self):
        svc, db = _svc()
        items = [
            {"product_id": str(uuid4()), "quantity": 10, "unit_cost": "25.00"},
            {"product_id": str(uuid4()), "quantity": 5, "unit_cost": "50.00"},
        ]
        svc.generate_purchase_request(BIZ_ID, items, supplier_id=SUPPLIER_ID, user_id=USER_ID)
        # db.add called: 1 for PR + 2 for items = 3
        assert db.add.call_count == 3
        db.flush.assert_called_once()
        db.commit.assert_called_once()
        added_pr = db.add.call_args_list[0][0][0]
        assert isinstance(added_pr, PurchaseRequest)
        assert added_pr.supplier_id == SUPPLIER_ID
        assert added_pr.requested_by_id == USER_ID
        # Total: 10*25 + 5*50 = 500
        assert added_pr.total_amount == Decimal("500.00")

    def test_generate_auto_flag(self):
        svc, db = _svc()
        items = [{"product_id": str(uuid4()), "quantity": 1, "unit_cost": "10.00"}]
        svc.generate_purchase_request(BIZ_ID, items, is_auto=True)
        added_pr = db.add.call_args_list[0][0][0]
        assert added_pr.is_auto_generated is True


# ── auto_reorder ────────────────────────────────────────────────────


class TestAutoReorder:
    def test_auto_reorder_groups_by_supplier(self):
        svc, db = _svc()
        sid1, sid2 = uuid4(), uuid4()
        pid1, pid2 = uuid4(), uuid4()
        rule1 = _make_rule(product_id=pid1, supplier_id=sid1, auto_approve=True, min_stock_level=10, reorder_quantity=20)
        rule2 = _make_rule(product_id=pid2, supplier_id=sid2, auto_approve=True, min_stock_level=5, reorder_quantity=30)
        prod1 = _make_product(id=pid1, quantity=3, cost_price=Decimal("10.00"))
        prod2 = _make_product(id=pid2, quantity=2, cost_price=Decimal("20.00"))
        call_count = [0]

        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[rule1, rule2])
            elif call_count[0] == 2:
                return _chain(first=prod1)
            elif call_count[0] == 3:
                return _chain(first=prod2)
            else:
                # generate_purchase_request internals don't need real DB
                return _chain()

        db.query.side_effect = side_effect
        result = svc.auto_reorder(BIZ_ID)
        # Two suppliers → two purchase requests
        assert len(result) == 2

    def test_auto_reorder_no_qualifying_rules(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        result = svc.auto_reorder(BIZ_ID)
        assert result == []

    def test_auto_reorder_stock_above_threshold_skipped(self):
        svc, db = _svc()
        pid = uuid4()
        rule = _make_rule(product_id=pid, auto_approve=True, min_stock_level=5, reorder_quantity=20)
        product = _make_product(id=pid, quantity=100)
        call_count = [0]

        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[rule])
            return _chain(first=product)

        db.query.side_effect = side_effect
        result = svc.auto_reorder(BIZ_ID)
        assert result == []


# ── get_request ─────────────────────────────────────────────────────


class TestGetRequest:
    def test_get_request_found(self):
        svc, db = _svc()
        pr = _make_pr()
        db.query.return_value = _chain(first=pr)
        result = svc.get_request(str(pr.id), BIZ_ID)
        assert result is pr

    def test_get_request_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.get_request(str(uuid4()), BIZ_ID)
        assert result is None


# ── list_requests ───────────────────────────────────────────────────


class TestListRequests:
    def test_list_requests_basic(self):
        svc, db = _svc()
        pr1, pr2 = _make_pr(), _make_pr()
        db.query.return_value = _chain(rows=[pr1, pr2], count=2)
        items, total = svc.list_requests(BIZ_ID)
        assert len(items) == 2
        assert total == 2

    def test_list_requests_with_status_filter(self):
        svc, db = _svc()
        pr = _make_pr(status=PurchaseOrderStatus.APPROVED)
        chain = _chain(rows=[pr], count=1)
        db.query.return_value = chain
        items, total = svc.list_requests(BIZ_ID, status=PurchaseOrderStatus.APPROVED)
        assert len(items) == 1
        # Extra filter call for status
        assert chain.filter.call_count == 2

    def test_list_requests_pagination(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=50)
        db.query.return_value = chain
        items, total = svc.list_requests(BIZ_ID, page=3, per_page=10)
        assert total == 50
        chain.offset.assert_called_once_with(20)
        chain.limit.assert_called_once_with(10)

    def test_list_requests_empty(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[], count=0)
        items, total = svc.list_requests(BIZ_ID)
        assert items == []
        assert total == 0


# ── approve_request ─────────────────────────────────────────────────


class TestApproveRequest:
    def test_approve_success(self):
        svc, db = _svc()
        pr = _make_pr(status=PurchaseOrderStatus.DRAFT)
        db.query.return_value = _chain(first=pr)
        result = svc.approve_request(str(pr.id), BIZ_ID, USER_ID)
        assert result.status == PurchaseOrderStatus.APPROVED
        assert result.approved_by_id == USER_ID
        assert result.approved_at is not None
        db.commit.assert_called_once()

    def test_approve_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.approve_request(str(uuid4()), BIZ_ID, USER_ID)
        assert result is None
        db.commit.assert_not_called()


# ── receive_items ───────────────────────────────────────────────────


class TestReceiveItems:
    def test_full_receive(self):
        svc, db = _svc()
        pr = _make_pr()
        item_id = uuid4()
        pr_item = _make_pr_item(id=item_id, quantity=50, received_quantity=0, unit_cost=Decimal("10.00"))
        product = _make_product(quantity=100)
        inv_item = MagicMock(spec=InventoryItem)
        inv_item.quantity_on_hand = 100
        inv_item.last_received_at = None
        inv_item.last_cost = None

        call_count = [0]

        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                # get_request → PurchaseRequest
                return _chain(first=pr)
            elif call_count[0] == 2:
                # PurchaseRequestItem lookup
                return _chain(first=pr_item)
            elif call_count[0] == 3:
                # Product lookup
                return _chain(first=product)
            elif call_count[0] == 4:
                # InventoryItem lookup
                return _chain(first=inv_item)
            elif call_count[0] == 5:
                # remaining count check → 0 remaining
                return _chain(count=0)
            return _chain()

        db.query.side_effect = side_effect
        receive_data = [{"item_id": item_id, "quantity_received": 50}]
        result = svc.receive_items(str(pr.id), BIZ_ID, receive_data)
        assert result is pr
        assert pr.status == PurchaseOrderStatus.RECEIVED
        assert pr_item.received_quantity == 50
        assert product.quantity == 150  # 100 + 50
        db.commit.assert_called()

    def test_partial_receive(self):
        svc, db = _svc()
        pr = _make_pr()
        item_id = uuid4()
        pr_item = _make_pr_item(id=item_id, quantity=100, received_quantity=0, unit_cost=Decimal("5.00"))
        product = _make_product(quantity=10)

        call_count = [0]

        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=pr)
            elif call_count[0] == 2:
                return _chain(first=pr_item)
            elif call_count[0] == 3:
                return _chain(first=product)
            elif call_count[0] == 4:
                # InventoryItem not found
                return _chain(first=None)
            return _chain()

        db.query.side_effect = side_effect
        receive_data = [{"item_id": item_id, "quantity_received": 30}]
        result = svc.receive_items(str(pr.id), BIZ_ID, receive_data)
        assert result is pr
        assert pr.status == PurchaseOrderStatus.PARTIALLY_RECEIVED
        assert pr_item.received_quantity == 30
        assert product.quantity == 40  # 10 + 30

    def test_receive_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.receive_items(str(uuid4()), BIZ_ID, [])
        assert result is None


# ── get_reorder_suggestions ─────────────────────────────────────────


class TestGetReorderSuggestions:
    def test_suggestions_returned(self):
        svc, db = _svc()
        pid = uuid4()
        product = _make_product(id=pid, name="Low Widget", quantity=2, low_stock_threshold=10)
        call_count = [0]

        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                # rule_product_ids query
                return _chain(rows=[])
            else:
                # product query
                return _chain(rows=[product])

        db.query.side_effect = side_effect
        result = svc.get_reorder_suggestions(BIZ_ID)
        assert len(result) == 1
        assert result[0]["product_id"] == str(pid)
        assert result[0]["product_name"] == "Low Widget"
        assert result[0]["suggested_reorder_qty"] == 20  # max(10*2, 10)

    def test_suggestions_excludes_products_with_rules(self):
        svc, db = _svc()
        existing_pid = uuid4()
        call_count = [0]

        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                row = MagicMock()
                row.__getitem__ = lambda self, i: existing_pid
                return _chain(rows=[row])
            else:
                return _chain(rows=[])

        db.query.side_effect = side_effect
        result = svc.get_reorder_suggestions(BIZ_ID)
        assert result == []

    def test_suggestions_empty_when_all_above_threshold(self):
        svc, db = _svc()
        call_count = [0]

        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[])
            else:
                return _chain(rows=[])

        db.query.side_effect = side_effect
        result = svc.get_reorder_suggestions(BIZ_ID)
        assert result == []


# ── _generate_reference ─────────────────────────────────────────────


class TestGenerateReference:
    def test_format(self):
        svc, _ = _svc()
        ref = svc._generate_reference()
        assert ref.startswith("PR-")
        assert len(ref) == 11  # "PR-" + 8 hex chars

    def test_uniqueness(self):
        svc, _ = _svc()
        refs = {svc._generate_reference() for _ in range(50)}
        assert len(refs) == 50
