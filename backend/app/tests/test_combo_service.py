"""Unit tests for ComboService.

Tests cover:
- Combo deal CRUD (create, get, list, update, delete)
- Active combos by location filtering
- Combo component CRUD (get, add, update, remove)
- Pricing helpers (calculate_combo_price, calculate_savings)
- Selection validation (validate_combo_selection)
"""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.models.combo import ComboDeal, ComboComponent, ComboComponentType
from app.models.product import Product
from app.services.combo_service import ComboService


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = str(uuid.uuid4())


def _svc():
    db = MagicMock()
    return ComboService(db), db


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
    return c


def _mock_combo(**kwargs):
    combo = MagicMock(spec=ComboDeal)
    combo.id = kwargs.get("id", uuid.uuid4())
    combo.business_id = kwargs.get("business_id", BIZ)
    combo.name = kwargs.get("name", "Family Meal")
    combo.display_name = kwargs.get("display_name", "Family Meal Deal")
    combo.combo_price = kwargs.get("combo_price", Decimal("149.99"))
    combo.original_price = kwargs.get("original_price", Decimal("199.99"))
    combo.is_active = kwargs.get("is_active", True)
    combo.location_ids = kwargs.get("location_ids", None)
    combo.sort_order = kwargs.get("sort_order", 0)
    combo.deleted_at = kwargs.get("deleted_at", None)
    return combo


def _mock_component(**kwargs):
    comp = MagicMock(spec=ComboComponent)
    comp.id = kwargs.get("id", uuid.uuid4())
    comp.combo_deal_id = kwargs.get("combo_deal_id", uuid.uuid4())
    comp.name = kwargs.get("name", "Main Item")
    comp.component_type = kwargs.get("component_type", ComboComponentType.FIXED.value)
    comp.fixed_product_id = kwargs.get("fixed_product_id", None)
    comp.allowed_product_ids = kwargs.get("allowed_product_ids", None)
    comp.allowed_category_ids = kwargs.get("allowed_category_ids", None)
    comp.quantity = kwargs.get("quantity", 1)
    comp.sort_order = kwargs.get("sort_order", 0)
    comp.allow_modifiers = kwargs.get("allow_modifiers", True)
    comp.deleted_at = None
    return comp


# ══════════════════════════════════════════════════════════════════════════════
# Combo Deal CRUD
# ══════════════════════════════════════════════════════════════════════════════


class TestGetCombos:
    def test_returns_items_and_total(self):
        svc, db = _svc()
        combo = _mock_combo()
        db.query.return_value = _chain(rows=[combo], count=1)
        items, total = svc.get_combos(BIZ)
        assert items == [combo]
        assert total == 1

    def test_empty_list(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[], count=0)
        items, total = svc.get_combos(BIZ)
        assert items == []
        assert total == 0

    def test_active_filter_applies_extra_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.get_combos(BIZ, is_active=True)
        # filter() is called twice: once for base filters, once for is_active
        assert chain.filter.call_count == 2

    def test_pagination_offset_and_limit(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.get_combos(BIZ, page=3, per_page=10)
        chain.offset.assert_called_once_with(20)  # (3-1)*10
        chain.limit.assert_called_once_with(10)


class TestGetComboById:
    def test_found(self):
        svc, db = _svc()
        combo = _mock_combo()
        db.query.return_value = _chain(first=combo)
        result = svc.get_combo_by_id(str(combo.id), BIZ)
        assert result == combo

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.get_combo_by_id("missing", BIZ) is None


class TestCreateCombo:
    def test_creates_and_commits(self):
        svc, db = _svc()
        svc.create_combo(
            business_id=BIZ,
            name="Lunch Special",
            display_name="Lunch Special",
            combo_price=Decimal("89.99"),
            original_price=Decimal("120.00"),
        )
        db.add.assert_called()
        db.flush.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_creates_with_components(self):
        svc, db = _svc()
        components = [
            {"name": "Burger", "component_type": "fixed", "fixed_product_id": str(uuid.uuid4())},
            {"name": "Side", "component_type": "choice", "allowed_product_ids": [str(uuid.uuid4())]},
        ]
        svc.create_combo(
            business_id=BIZ,
            name="Combo",
            display_name="Combo",
            combo_price=Decimal("100"),
            original_price=Decimal("130"),
            components=components,
        )
        # 1 combo + 2 components = 3 add calls
        assert db.add.call_count == 3

    def test_no_components_creates_only_combo(self):
        svc, db = _svc()
        svc.create_combo(
            business_id=BIZ,
            name="Simple",
            display_name="Simple",
            combo_price=Decimal("50"),
            original_price=Decimal("70"),
        )
        assert db.add.call_count == 1


class TestUpdateCombo:
    def test_updates_fields(self):
        svc, db = _svc()
        combo = _mock_combo()
        db.query.return_value = _chain(first=combo)
        result = svc.update_combo(str(combo.id), BIZ, name="New Name")
        assert result == combo
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_not_found_returns_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.update_combo("missing", BIZ, name="X") is None


class TestDeleteCombo:
    def test_soft_deletes(self):
        svc, db = _svc()
        combo = _mock_combo()
        db.query.return_value = _chain(first=combo)
        result = svc.delete_combo(str(combo.id), BIZ)
        combo.soft_delete.assert_called_once()
        db.commit.assert_called_once()
        assert result == combo

    def test_not_found_returns_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.delete_combo("missing", BIZ) is None


# ══════════════════════════════════════════════════════════════════════════════
# Active Combos by Location
# ══════════════════════════════════════════════════════════════════════════════


class TestGetActiveCombosbyLocation:
    def test_no_location_returns_all(self):
        svc, db = _svc()
        c1, c2 = _mock_combo(location_ids=None), _mock_combo(location_ids=["loc-1"])
        db.query.return_value = _chain(rows=[c1, c2])
        result = svc.get_active_combos_by_location(BIZ)
        assert result == [c1, c2]

    def test_filters_by_location(self):
        svc, db = _svc()
        loc = str(uuid.uuid4())
        c_everywhere = _mock_combo(location_ids=None)
        c_match = _mock_combo(location_ids=[loc])
        c_other = _mock_combo(location_ids=[str(uuid.uuid4())])
        db.query.return_value = _chain(rows=[c_everywhere, c_match, c_other])
        result = svc.get_active_combos_by_location(BIZ, location_id=loc)
        assert c_everywhere in result
        assert c_match in result
        assert c_other not in result


# ══════════════════════════════════════════════════════════════════════════════
# Combo Component CRUD
# ══════════════════════════════════════════════════════════════════════════════


class TestGetComboComponents:
    def test_returns_ordered_components(self):
        svc, db = _svc()
        comp = _mock_component()
        db.query.return_value = _chain(rows=[comp])
        result = svc.get_combo_components("combo-1")
        assert result == [comp]


class TestAddComboComponent:
    def test_adds_successfully(self):
        svc, db = _svc()
        combo = _mock_combo()
        db.query.return_value = _chain(first=combo)
        svc.add_combo_component("combo-1", "Drink", "choice")
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_raises_if_combo_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        with pytest.raises(ValueError, match="Combo deal not found"):
            svc.add_combo_component("missing", "Drink", "choice")


class TestUpdateComboComponent:
    def test_updates_fields(self):
        svc, db = _svc()
        comp = _mock_component()
        db.query.return_value = _chain(first=comp)
        result = svc.update_combo_component(str(comp.id), name="Updated")
        assert result == comp
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_not_found_returns_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.update_combo_component("missing", name="X") is None


class TestRemoveComboComponent:
    def test_soft_deletes(self):
        svc, db = _svc()
        comp = _mock_component()
        db.query.return_value = _chain(first=comp)
        assert svc.remove_combo_component(str(comp.id)) is True
        comp.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_not_found_returns_false(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.remove_combo_component("missing") is False


# ══════════════════════════════════════════════════════════════════════════════
# Pricing
# ══════════════════════════════════════════════════════════════════════════════


class TestCalculateComboPrice:
    def test_returns_quantized_decimal(self):
        svc, _ = _svc()
        combo = _mock_combo(combo_price=Decimal("149.999"))
        result = svc.calculate_combo_price(combo)
        assert result == Decimal("150.00")

    def test_exact_two_places(self):
        svc, _ = _svc()
        combo = _mock_combo(combo_price=Decimal("99.50"))
        result = svc.calculate_combo_price(combo)
        assert result == Decimal("99.50")


class TestCalculateSavings:
    def test_positive_savings(self):
        svc, _ = _svc()
        combo = _mock_combo(original_price=Decimal("200"), combo_price=Decimal("150"))
        result = svc.calculate_savings(combo)
        assert result == Decimal("50.00")

    def test_zero_savings_when_equal(self):
        svc, _ = _svc()
        combo = _mock_combo(original_price=Decimal("100"), combo_price=Decimal("100"))
        assert svc.calculate_savings(combo) == Decimal("0.00")

    def test_negative_savings_clamped_to_zero(self):
        svc, _ = _svc()
        combo = _mock_combo(original_price=Decimal("80"), combo_price=Decimal("100"))
        assert svc.calculate_savings(combo) == Decimal("0.00")


# ══════════════════════════════════════════════════════════════════════════════
# Validation
# ══════════════════════════════════════════════════════════════════════════════


class TestValidateComboSelection:
    def test_valid_fixed_selection(self):
        svc, db = _svc()
        product_id = str(uuid.uuid4())
        comp = _mock_component(
            component_type=ComboComponentType.FIXED.value,
            fixed_product_id=product_id,
        )
        # get_combo_components queries ComboComponent
        db.query.return_value = _chain(rows=[comp])
        selections = [{"component_id": str(comp.id), "selected_product_id": product_id}]
        is_valid, errors = svc.validate_combo_selection("combo-1", selections)
        assert is_valid is True
        assert errors == []

    def test_wrong_product_for_fixed_component(self):
        svc, db = _svc()
        comp = _mock_component(
            component_type=ComboComponentType.FIXED.value,
            fixed_product_id=str(uuid.uuid4()),
        )
        db.query.return_value = _chain(rows=[comp])
        selections = [{"component_id": str(comp.id), "selected_product_id": "wrong-id"}]
        is_valid, errors = svc.validate_combo_selection("combo-1", selections)
        assert is_valid is False
        assert any("requires product" in e for e in errors)

    def test_missing_component_selection(self):
        svc, db = _svc()
        comp = _mock_component(name="Burger Slot")
        db.query.return_value = _chain(rows=[comp])
        is_valid, errors = svc.validate_combo_selection("combo-1", [])
        assert is_valid is False
        assert any("Missing selection" in e for e in errors)

    def test_unknown_component_id(self):
        svc, db = _svc()
        comp = _mock_component()
        db.query.return_value = _chain(rows=[comp])
        selections = [
            {"component_id": str(comp.id), "selected_product_id": str(comp.fixed_product_id or uuid.uuid4())},
            {"component_id": "unknown-id", "selected_product_id": "any"},
        ]
        is_valid, errors = svc.validate_combo_selection("combo-1", selections)
        assert is_valid is False
        assert any("Unknown component" in e for e in errors)

    def test_no_components_configured(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        is_valid, errors = svc.validate_combo_selection("combo-1", [])
        assert is_valid is False
        assert any("no components" in e for e in errors)

    def test_choice_component_with_allowed_product(self):
        """Product in allowed_product_ids passes validation."""
        svc, db = _svc()
        allowed_pid = str(uuid.uuid4())
        comp = _mock_component(
            component_type=ComboComponentType.CHOICE.value,
            allowed_product_ids=[allowed_pid],
            allowed_category_ids=None,
        )
        db.query.return_value = _chain(rows=[comp])
        selections = [{"component_id": str(comp.id), "selected_product_id": allowed_pid}]
        is_valid, errors = svc.validate_combo_selection("combo-1", selections)
        assert is_valid is True
        assert errors == []

    def test_choice_component_product_not_allowed(self):
        """Product not in allowed lists fails validation."""
        svc, db = _svc()
        comp = _mock_component(
            component_type=ComboComponentType.CHOICE.value,
            allowed_product_ids=[str(uuid.uuid4())],
            allowed_category_ids=None,
        )

        call_count = 0
        def query_side_effect(model):
            nonlocal call_count
            call_count += 1
            if model is ComboComponent:
                return _chain(rows=[comp])
            # Product lookup for category check
            return _chain(first=None)

        db.query.side_effect = query_side_effect

        selections = [{"component_id": str(comp.id), "selected_product_id": "not-allowed"}]
        is_valid, errors = svc.validate_combo_selection("combo-1", selections)
        assert is_valid is False
        assert any("not allowed" in e for e in errors)

    def test_choice_component_allowed_by_category(self):
        """Product whose category is in allowed_category_ids passes."""
        svc, db = _svc()
        cat_id = str(uuid.uuid4())
        product_id = str(uuid.uuid4())
        comp = _mock_component(
            component_type=ComboComponentType.CHOICE.value,
            allowed_product_ids=None,
            allowed_category_ids=[cat_id],
        )
        product = MagicMock()
        product.category_id = cat_id

        call_count = 0
        def query_side_effect(model):
            nonlocal call_count
            call_count += 1
            if model is ComboComponent:
                return _chain(rows=[comp])
            if model is Product:
                return _chain(first=product)
            return _chain()

        db.query.side_effect = query_side_effect

        selections = [{"component_id": str(comp.id), "selected_product_id": product_id}]
        is_valid, errors = svc.validate_combo_selection("combo-1", selections)
        assert is_valid is True
        assert errors == []
