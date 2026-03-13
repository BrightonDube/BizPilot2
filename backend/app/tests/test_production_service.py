"""Unit tests for ProductionService.

Tests cover:
- Production order CRUD (create, get, list, update, delete)
- State transitions: DRAFT→IN_PROGRESS→COMPLETED, DRAFT→CANCELLED
- Invalid state transitions (ValueError)
- Estimated cost calculation from product ingredients
- Complete production: inventory deduction + product addition
- Ingredient suggestions with relevance scoring
- Edge cases: missing product, None unit_cost, search filtering
"""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.models.production import ProductionStatus
from app.services.production_service import ProductionService
from app.schemas.production import (
    ProductionOrderCreate,
    ProductionOrderUpdate,
    ProductionOrderItemCreate,
)


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = str(uuid4())
USR = str(uuid4())


def _svc():
    """Create a ProductionService with a mocked DB session."""
    db = MagicMock()
    return ProductionService(db), db


def _chain(first=None, count=0, rows=None):
    """Return a MagicMock that mimics a SQLAlchemy query chain."""
    chain = MagicMock()
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.offset.return_value = chain
    chain.limit.return_value = chain
    chain.all.return_value = rows if rows is not None else []
    chain.first.return_value = first
    chain.count.return_value = count
    chain.scalar.return_value = count
    return chain


def _mock_order(**kwargs):
    """Build a mock ProductionOrder."""
    order = MagicMock()
    order.id = kwargs.get("id", uuid4())
    order.business_id = kwargs.get("business_id", BIZ)
    order.product_id = kwargs.get("product_id", uuid4())
    order.order_number = kwargs.get("order_number", "PRD-00001")
    order.quantity_to_produce = kwargs.get("quantity_to_produce", 10)
    order.quantity_produced = kwargs.get("quantity_produced", 0)
    order.status = kwargs.get("status", ProductionStatus.DRAFT)
    order.scheduled_date = kwargs.get("scheduled_date", None)
    order.started_at = kwargs.get("started_at", None)
    order.completed_at = kwargs.get("completed_at", None)
    order.estimated_cost = kwargs.get("estimated_cost", Decimal("0"))
    order.actual_cost = kwargs.get("actual_cost", Decimal("0"))
    order.notes = kwargs.get("notes", None)
    order.items = kwargs.get("items", [])
    order.deleted_at = None
    return order


def _mock_item(**kwargs):
    """Build a mock ProductionOrderItem."""
    item = MagicMock()
    item.id = kwargs.get("id", uuid4())
    item.source_product_id = kwargs.get("source_product_id", uuid4())
    item.name = kwargs.get("name", "Flour")
    item.unit = kwargs.get("unit", "kg")
    item.quantity_required = kwargs.get("quantity_required", Decimal("5"))
    item.quantity_used = kwargs.get("quantity_used", None)
    item.unit_cost = kwargs.get("unit_cost", Decimal("10"))
    item.deleted_at = None
    return item


def _mock_product(**kwargs):
    """Build a mock Product."""
    product = MagicMock()
    product.id = kwargs.get("id", uuid4())
    product.business_id = kwargs.get("business_id", BIZ)
    product.name = kwargs.get("name", "Bread")
    product.sku = kwargs.get("sku", "BRD-001")
    product.description = kwargs.get("description", "Fresh bread")
    product.cost_price = kwargs.get("cost_price", Decimal("25.00"))
    product.status = kwargs.get("status", "active")
    product.quantity = kwargs.get("quantity", 100)
    product.ingredients = kwargs.get("ingredients", [])
    product.deleted_at = None
    return product


def _mock_ingredient(**kwargs):
    """Build a mock ingredient on a product."""
    ing = MagicMock()
    ing.source_product_id = kwargs.get("source_product_id", uuid4())
    ing.name = kwargs.get("name", "Flour")
    ing.unit = kwargs.get("unit", "kg")
    ing.quantity = kwargs.get("quantity", Decimal("2"))
    ing.cost = kwargs.get("cost", Decimal("10"))
    ing.deleted_at = kwargs.get("deleted_at", None)
    return ing


def _mock_inventory(**kwargs):
    """Build a mock InventoryItem."""
    inv = MagicMock()
    inv.id = kwargs.get("id", uuid4())
    inv.product_id = kwargs.get("product_id", uuid4())
    inv.business_id = kwargs.get("business_id", BIZ)
    inv.quantity_on_hand = kwargs.get("quantity_on_hand", 50)
    inv.deleted_at = None
    return inv


# ══════════════════════════════════════════════════════════════════════════════
# Get Production Order
# ══════════════════════════════════════════════════════════════════════════════


class TestGetProductionOrder:
    """Test getting a single production order."""

    def test_get_existing_order(self):
        """Returns order when found."""
        svc, db = _svc()
        order = _mock_order()
        db.query.return_value = _chain(first=order)
        result = svc.get_production_order(str(order.id), BIZ)
        assert result is order

    def test_get_missing_order(self):
        """Returns None when order not found."""
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.get_production_order(str(uuid4()), BIZ)
        assert result is None


# ══════════════════════════════════════════════════════════════════════════════
# List Production Orders
# ══════════════════════════════════════════════════════════════════════════════


class TestGetProductionOrders:
    """Test listing production orders with filters and pagination."""

    def test_list_returns_orders_and_total(self):
        """Basic list returns (orders, total)."""
        svc, db = _svc()
        orders = [_mock_order(), _mock_order()]
        db.query.return_value = _chain(rows=orders, count=2)
        result, total = svc.get_production_orders(BIZ)
        assert len(result) == 2
        assert total == 2

    def test_list_empty(self):
        """Empty list returns ([], 0)."""
        svc, db = _svc()
        db.query.return_value = _chain(rows=[], count=0)
        result, total = svc.get_production_orders(BIZ)
        assert result == []
        assert total == 0

    def test_list_with_status_filter(self):
        """Status filter is applied."""
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.get_production_orders(BIZ, status=ProductionStatus.DRAFT)
        # filter is called multiple times (base + status)
        assert chain.filter.call_count >= 2

    def test_list_with_product_filter(self):
        """Product ID filter is applied."""
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        pid = str(uuid4())
        svc.get_production_orders(BIZ, product_id=pid)
        assert chain.filter.call_count >= 2

    def test_list_with_search_filter(self):
        """Search filter is applied."""
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.get_production_orders(BIZ, search="PRD")
        assert chain.filter.call_count >= 2

    def test_pagination_offset(self):
        """Pagination calculates correct offset."""
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.get_production_orders(BIZ, page=3, per_page=10)
        chain.offset.assert_called_once_with(20)  # (3-1)*10
        chain.limit.assert_called_once_with(10)


# ══════════════════════════════════════════════════════════════════════════════
# Create Production Order
# ══════════════════════════════════════════════════════════════════════════════


class TestCreateProductionOrder:
    """Test creating production orders."""

    def test_create_raises_if_product_not_found(self):
        """Raises ValueError when target product doesn't exist."""
        svc, db = _svc()
        call_count = [0]

        def query_side_effect(*args):
            call_count[0] += 1
            chain = _chain()
            if call_count[0] == 1:
                chain.first.return_value = None  # Product not found
            return chain

        db.query.side_effect = query_side_effect
        data = ProductionOrderCreate(
            product_id=str(uuid4()),
            quantity_to_produce=5,
        )
        with pytest.raises(ValueError, match="Product not found"):
            svc.create_production_order(BIZ, data, user_id=USR)

    def test_create_order_no_ingredients(self):
        """Creates order when product has no ingredients; estimated_cost=0."""
        svc, db = _svc()
        product = _mock_product(ingredients=[])
        call_count = [0]

        def query_side_effect(*args):
            call_count[0] += 1
            chain = _chain()
            if call_count[0] == 1:
                chain.first.return_value = product  # product lookup
            elif call_count[0] == 2:
                chain.count.return_value = 0  # _generate_order_number
            return chain

        db.query.side_effect = query_side_effect
        data = ProductionOrderCreate(
            product_id=str(product.id),
            quantity_to_produce=5,
        )
        svc.create_production_order(BIZ, data, user_id=USR)
        db.add.assert_called()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_create_order_with_ingredients_calculates_cost(self):
        """Estimated cost = sum(ing.cost * ing.quantity) * qty_to_produce."""
        svc, db = _svc()
        ing1 = _mock_ingredient(cost=Decimal("10"), quantity=Decimal("2"))
        ing2 = _mock_ingredient(cost=Decimal("5"), quantity=Decimal("3"))
        product = _mock_product(ingredients=[ing1, ing2])

        call_count = [0]

        def query_side_effect(*args):
            call_count[0] += 1
            chain = _chain()
            if call_count[0] == 1:
                chain.first.return_value = product  # product lookup
            elif call_count[0] == 2:
                chain.count.return_value = 3  # _generate_order_number
            return chain

        db.query.side_effect = query_side_effect
        data = ProductionOrderCreate(
            product_id=str(product.id),
            quantity_to_produce=4,
        )

        # Capture the order passed to db.add
        added_objects = []
        db.add.side_effect = lambda obj: added_objects.append(obj)

        svc.create_production_order(BIZ, data, user_id=USR)
        # Per-unit cost: (10*2) + (5*3) = 35; times 4 = 140
        order_obj = added_objects[0]
        assert order_obj.estimated_cost == Decimal("140")
        assert order_obj.order_number == "PRD-00004"

    def test_create_order_with_deleted_ingredients_excluded(self):
        """Deleted ingredients are not counted in estimated cost."""
        svc, db = _svc()
        ing_active = _mock_ingredient(cost=Decimal("10"), quantity=Decimal("1"))
        ing_deleted = _mock_ingredient(
            cost=Decimal("100"), quantity=Decimal("1"),
            deleted_at=datetime(2025, 1, 1),
        )
        product = _mock_product(ingredients=[ing_active, ing_deleted])

        call_count = [0]

        def query_side_effect(*args):
            call_count[0] += 1
            chain = _chain()
            if call_count[0] == 1:
                chain.first.return_value = product  # product lookup
            elif call_count[0] == 2:
                chain.count.return_value = 0  # _generate_order_number
            return chain

        db.query.side_effect = query_side_effect
        data = ProductionOrderCreate(
            product_id=str(product.id),
            quantity_to_produce=2,
        )
        added_objects = []
        db.add.side_effect = lambda obj: added_objects.append(obj)

        svc.create_production_order(BIZ, data, user_id=USR)
        order_obj = added_objects[0]
        # Only active: 10*1 = 10, times 2 = 20
        assert order_obj.estimated_cost == Decimal("20")

    def test_create_order_with_explicit_items(self):
        """When data.items is provided, _add_order_item is called for each."""
        svc, db = _svc()
        product = _mock_product(ingredients=[])

        call_count = [0]

        def query_side_effect(*args):
            call_count[0] += 1
            chain = _chain()
            if call_count[0] == 1:
                chain.first.return_value = product  # product lookup
            elif call_count[0] == 2:
                chain.count.return_value = 0  # _generate_order_number
            return chain

        db.query.side_effect = query_side_effect

        item_data = ProductionOrderItemCreate(
            name="Sugar",
            unit="kg",
            quantity_required=Decimal("3"),
            unit_cost=Decimal("8"),
            source_product_id=str(uuid4()),
        )
        data = ProductionOrderCreate(
            product_id=str(product.id),
            quantity_to_produce=2,
            items=[item_data],
        )
        svc.create_production_order(BIZ, data, user_id=USR)
        # order + 1 item = at least 2 db.add calls
        assert db.add.call_count >= 2

    def test_create_order_ingredient_none_cost_defaults_zero(self):
        """Ingredient with cost=None defaults to Decimal(0) in estimated_cost."""
        svc, db = _svc()
        ing = _mock_ingredient(cost=None, quantity=Decimal("5"))
        product = _mock_product(ingredients=[ing])

        call_count = [0]

        def query_side_effect(*args):
            call_count[0] += 1
            chain = _chain()
            if call_count[0] == 1:
                chain.first.return_value = product  # product lookup
            elif call_count[0] == 2:
                chain.count.return_value = 0  # _generate_order_number
            return chain

        db.query.side_effect = query_side_effect
        data = ProductionOrderCreate(
            product_id=str(product.id),
            quantity_to_produce=3,
        )
        added_objects = []
        db.add.side_effect = lambda obj: added_objects.append(obj)

        svc.create_production_order(BIZ, data, user_id=USR)
        order_obj = added_objects[0]
        assert order_obj.estimated_cost == Decimal("0")


# ══════════════════════════════════════════════════════════════════════════════
# Update Production Order
# ══════════════════════════════════════════════════════════════════════════════


class TestUpdateProductionOrder:
    """Test updating production orders."""

    def test_update_sets_fields(self):
        """Updates only the fields present in the schema."""
        svc, db = _svc()
        order = _mock_order(notes="old notes")
        data = ProductionOrderUpdate(notes="new notes")
        svc.update_production_order(order, data)
        assert order.notes == "new notes"
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(order)

    def test_update_ignores_unset_fields(self):
        """Fields not provided are not overwritten."""
        svc, db = _svc()
        order = _mock_order(quantity_to_produce=10)
        data = ProductionOrderUpdate(notes="updated")
        svc.update_production_order(order, data)
        # quantity_to_produce should not have been set to None
        assert order.quantity_to_produce == 10


# ══════════════════════════════════════════════════════════════════════════════
# State Transitions
# ══════════════════════════════════════════════════════════════════════════════


class TestStartProduction:
    """Test starting production orders."""

    def test_start_from_draft(self):
        """Can start production from DRAFT status."""
        svc, db = _svc()
        order = _mock_order(status=ProductionStatus.DRAFT)
        svc.start_production(order)
        assert order.status == ProductionStatus.IN_PROGRESS
        assert order.started_at is not None
        db.commit.assert_called_once()

    def test_start_from_pending(self):
        """Can start production from PENDING status."""
        svc, db = _svc()
        order = _mock_order(status=ProductionStatus.PENDING)
        svc.start_production(order)
        assert order.status == ProductionStatus.IN_PROGRESS

    def test_start_from_in_progress_raises(self):
        """Cannot start already in-progress production."""
        svc, db = _svc()
        order = _mock_order(status=ProductionStatus.IN_PROGRESS)
        with pytest.raises(ValueError, match="Cannot start production"):
            svc.start_production(order)

    def test_start_from_completed_raises(self):
        """Cannot start completed production."""
        svc, db = _svc()
        order = _mock_order(status=ProductionStatus.COMPLETED)
        with pytest.raises(ValueError, match="Cannot start production"):
            svc.start_production(order)

    def test_start_from_cancelled_raises(self):
        """Cannot start cancelled production."""
        svc, db = _svc()
        order = _mock_order(status=ProductionStatus.CANCELLED)
        with pytest.raises(ValueError, match="Cannot start production"):
            svc.start_production(order)


class TestCompleteProduction:
    """Test completing production orders."""

    def test_complete_sets_status_and_quantity(self):
        """Completes and sets quantity_produced, completed_at."""
        svc, db = _svc()
        order = _mock_order(
            status=ProductionStatus.IN_PROGRESS,
            items=[],
        )
        db.query.return_value = _chain()

        svc.complete_production(order, quantity_produced=8)
        assert order.status == ProductionStatus.COMPLETED
        assert order.quantity_produced == 8
        assert order.completed_at is not None
        db.commit.assert_called_once()

    def test_complete_with_explicit_actual_cost(self):
        """When actual_cost is provided, it is used directly."""
        svc, db = _svc()
        order = _mock_order(
            status=ProductionStatus.IN_PROGRESS,
            items=[],
        )
        db.query.return_value = _chain()

        svc.complete_production(order, quantity_produced=5, actual_cost=Decimal("200"))
        assert order.actual_cost == Decimal("200")

    def test_complete_calculates_actual_cost_from_items(self):
        """When actual_cost is None, calculates from items."""
        svc, db = _svc()
        item1 = _mock_item(
            quantity_used=None,
            quantity_required=Decimal("5"),
            unit_cost=Decimal("10"),
        )
        item2 = _mock_item(
            quantity_used=Decimal("3"),
            quantity_required=Decimal("3"),
            unit_cost=Decimal("20"),
        )
        order = _mock_order(
            status=ProductionStatus.IN_PROGRESS,
            items=[item1, item2],
        )
        db.query.return_value = _chain()

        svc.complete_production(order, quantity_produced=10)
        # item1: quantity_used is None → use quantity_required=5, cost 5*10=50
        # item2: quantity_used=3, cost 3*20=60
        # total: 110
        assert order.actual_cost == Decimal("110")

    def test_complete_item_none_unit_cost_defaults_zero(self):
        """Items with unit_cost=None default to Decimal(0)."""
        svc, db = _svc()
        item = _mock_item(
            quantity_used=None,
            quantity_required=Decimal("10"),
            unit_cost=None,
        )
        order = _mock_order(
            status=ProductionStatus.IN_PROGRESS,
            items=[item],
        )
        db.query.return_value = _chain()

        svc.complete_production(order, quantity_produced=5)
        assert order.actual_cost == Decimal("0")

    def test_complete_deducts_ingredient_inventory(self):
        """Completing production deducts ingredients from inventory."""
        svc, db = _svc()
        source_pid = uuid4()
        item = _mock_item(
            source_product_id=source_pid,
            quantity_required=Decimal("10"),
        )
        product_pid = uuid4()
        order = _mock_order(
            status=ProductionStatus.IN_PROGRESS,
            items=[item],
            product_id=product_pid,
        )

        inventory_deduct = _mock_inventory(product_id=source_pid, quantity_on_hand=50)
        product_deduct = _mock_product(id=source_pid, quantity=50)
        inventory_add = _mock_inventory(product_id=product_pid, quantity_on_hand=20)
        product_add = _mock_product(id=product_pid, quantity=20)

        call_count = [0]

        def query_side_effect(*args):
            call_count[0] += 1
            chain = _chain()
            # _deduct_inventory: InventoryItem lookup, Product lookup
            # _add_to_inventory: InventoryItem lookup, Product lookup
            if call_count[0] == 1:
                chain.first.return_value = inventory_deduct
            elif call_count[0] == 2:
                chain.first.return_value = product_deduct
            elif call_count[0] == 3:
                chain.first.return_value = inventory_add
            elif call_count[0] == 4:
                chain.first.return_value = product_add
            return chain

        db.query.side_effect = query_side_effect

        svc.complete_production(order, quantity_produced=5)

        # Inventory deducted: 50 - 10 = 40
        assert inventory_deduct.quantity_on_hand == 40
        # Product quantity deducted: 50 - 10 = 40
        assert product_deduct.quantity == 40
        # Inventory added: 20 + 5 = 25
        assert inventory_add.quantity_on_hand == 25
        # Product quantity added: 20 + 5 = 25
        assert product_add.quantity == 25
        # Transaction records created
        assert db.add.call_count >= 2

    def test_complete_from_draft_raises(self):
        """Cannot complete from DRAFT status."""
        svc, db = _svc()
        order = _mock_order(status=ProductionStatus.DRAFT)
        with pytest.raises(ValueError, match="Cannot complete production"):
            svc.complete_production(order, quantity_produced=5)

    def test_complete_from_completed_raises(self):
        """Cannot complete already completed order."""
        svc, db = _svc()
        order = _mock_order(status=ProductionStatus.COMPLETED)
        with pytest.raises(ValueError, match="Cannot complete production"):
            svc.complete_production(order, quantity_produced=5)


# ══════════════════════════════════════════════════════════════════════════════
# Cancel Production
# ══════════════════════════════════════════════════════════════════════════════


class TestCancelProduction:
    """Test cancelling production orders."""

    def test_cancel_draft(self):
        """Can cancel a DRAFT order."""
        svc, db = _svc()
        order = _mock_order(status=ProductionStatus.DRAFT)
        svc.cancel_production(order)
        assert order.status == ProductionStatus.CANCELLED
        db.commit.assert_called_once()

    def test_cancel_in_progress(self):
        """Can cancel an IN_PROGRESS order."""
        svc, db = _svc()
        order = _mock_order(status=ProductionStatus.IN_PROGRESS)
        svc.cancel_production(order)
        assert order.status == ProductionStatus.CANCELLED

    def test_cancel_completed_raises(self):
        """Cannot cancel a COMPLETED order."""
        svc, db = _svc()
        order = _mock_order(status=ProductionStatus.COMPLETED)
        with pytest.raises(ValueError, match="Cannot cancel completed"):
            svc.cancel_production(order)


# ══════════════════════════════════════════════════════════════════════════════
# Delete Production Order
# ══════════════════════════════════════════════════════════════════════════════


class TestDeleteProductionOrder:
    """Test soft-deleting production orders."""

    def test_delete_draft_order(self):
        """Can delete a DRAFT order."""
        svc, db = _svc()
        order = _mock_order(status=ProductionStatus.DRAFT)
        result = svc.delete_production_order(order)
        assert result is True
        order.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_delete_completed_raises(self):
        """Cannot delete a COMPLETED order."""
        svc, db = _svc()
        order = _mock_order(status=ProductionStatus.COMPLETED)
        with pytest.raises(ValueError, match="Cannot delete completed"):
            svc.delete_production_order(order)

    def test_delete_cancelled_order(self):
        """Can delete a CANCELLED order."""
        svc, db = _svc()
        order = _mock_order(status=ProductionStatus.CANCELLED)
        result = svc.delete_production_order(order)
        assert result is True


# ══════════════════════════════════════════════════════════════════════════════
# Ingredient Suggestions
# ══════════════════════════════════════════════════════════════════════════════


class TestGetIngredientSuggestions:
    """Test ingredient suggestion with relevance scoring."""

    def test_suggestions_empty_query(self):
        """Returns products even with empty query string."""
        svc, db = _svc()
        product = _mock_product(name="Flour", sku="FLR-001")
        inv = _mock_inventory(quantity_on_hand=100)

        call_count = [0]

        def query_side_effect(*args):
            call_count[0] += 1
            chain = _chain()
            if call_count[0] == 1:
                chain.all.return_value = [product]
            else:
                chain.first.return_value = inv
            return chain

        db.query.side_effect = query_side_effect

        results = svc.get_ingredient_suggestions(BIZ, query="")
        assert len(results) == 1
        assert results[0].name == "Flour"
        assert results[0].relevance_score == 0.5  # base score only

    def test_suggestions_name_starts_with_boost(self):
        """Products whose name starts with query get +0.3 boost."""
        svc, db = _svc()
        product = _mock_product(name="Flour")
        inv = _mock_inventory(quantity_on_hand=20)

        call_count = [0]

        def query_side_effect(*args):
            call_count[0] += 1
            chain = _chain()
            if call_count[0] == 1:
                chain.all.return_value = [product]
            else:
                chain.first.return_value = inv
            return chain

        db.query.side_effect = query_side_effect

        results = svc.get_ingredient_suggestions(BIZ, query="Flour")
        # exact match: base 0.5 + starts_with 0.3 + exact 0.2 = 1.0
        assert results[0].relevance_score == 1.0

    def test_suggestions_exact_match_boost(self):
        """Exact name match gets +0.3 (starts_with) + +0.2 (exact) boosts."""
        svc, db = _svc()
        product = _mock_product(name="Salt")
        inv = _mock_inventory(quantity_on_hand=10)

        call_count = [0]

        def query_side_effect(*args):
            call_count[0] += 1
            chain = _chain()
            if call_count[0] == 1:
                chain.all.return_value = [product]
            else:
                chain.first.return_value = inv
            return chain

        db.query.side_effect = query_side_effect

        results = svc.get_ingredient_suggestions(BIZ, query="salt")
        assert results[0].relevance_score == pytest.approx(1.0)

    def test_suggestions_no_inventory(self):
        """Products with no inventory show quantity_on_hand=0."""
        svc, db = _svc()
        product = _mock_product(name="Yeast")

        call_count = [0]

        def query_side_effect(*args):
            call_count[0] += 1
            chain = _chain()
            if call_count[0] == 1:
                chain.all.return_value = [product]
            else:
                chain.first.return_value = None  # no inventory record
            return chain

        db.query.side_effect = query_side_effect

        results = svc.get_ingredient_suggestions(BIZ, query="yeast")
        assert results[0].quantity_on_hand == 0

    def test_suggestions_sorted_by_relevance(self):
        """Results are sorted by relevance_score descending."""
        svc, db = _svc()
        p1 = _mock_product(name="Sugar")
        p2 = _mock_product(name="Sugar Syrup")

        call_count = [0]

        def query_side_effect(*args):
            call_count[0] += 1
            chain = _chain()
            if call_count[0] == 1:
                chain.all.return_value = [p1, p2]
            else:
                chain.first.return_value = None
            return chain

        db.query.side_effect = query_side_effect

        results = svc.get_ingredient_suggestions(BIZ, query="Sugar")
        # p1 "Sugar" exact match → 1.0; p2 "Sugar Syrup" starts_with → 0.8
        assert results[0].name == "Sugar"
        assert results[1].name == "Sugar Syrup"
        assert results[0].relevance_score > results[1].relevance_score

    def test_suggestions_respects_limit(self):
        """Only returns up to 'limit' results."""
        svc, db = _svc()
        products = [_mock_product(name=f"Item{i}") for i in range(5)]

        call_count = [0]

        def query_side_effect(*args):
            call_count[0] += 1
            chain = _chain()
            if call_count[0] == 1:
                chain.all.return_value = products
            else:
                chain.first.return_value = None
            return chain

        db.query.side_effect = query_side_effect

        results = svc.get_ingredient_suggestions(BIZ, query="", limit=3)
        assert len(results) <= 3


# ══════════════════════════════════════════════════════════════════════════════
# Generate Order Number
# ══════════════════════════════════════════════════════════════════════════════


class TestGenerateOrderNumber:
    """Test internal order number generation."""

    def test_first_order_number(self):
        """First order in business gets PRD-00001."""
        svc, db = _svc()
        db.query.return_value = _chain(count=0)
        result = svc._generate_order_number(BIZ)
        assert result == "PRD-00001"

    def test_order_number_increments(self):
        """Subsequent orders get incrementing numbers."""
        svc, db = _svc()
        db.query.return_value = _chain(count=42)
        result = svc._generate_order_number(BIZ)
        assert result == "PRD-00043"
