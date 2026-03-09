"""Unit tests for ModifierValidationService.

Covers validate_selections, validate_group_selection,
has_required_modifiers, and get_default_selections.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")

import uuid
from unittest.mock import MagicMock

import pytest

from app.models.addon import ProductModifierGroup
from app.models.menu import Modifier, ModifierGroup
from app.services.modifier_validation_service import (
    ModifierValidationService,
    ValidationError,
    ValidationResult,
)


PRODUCT_ID = str(uuid.uuid4())
GROUP_ID_A = str(uuid.uuid4())
GROUP_ID_B = str(uuid.uuid4())
MODIFIER_1 = str(uuid.uuid4())
MODIFIER_2 = str(uuid.uuid4())
MODIFIER_3 = str(uuid.uuid4())


def _chain(first=None, rows=None, count=0, scalar=None):
    """Reusable mock that supports the common SQLAlchemy chained-call pattern."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = scalar
    return c


def _make_group(
    group_id=None,
    name="Toppings",
    is_required=False,
    min_selections=0,
    max_selections=None,
):
    g = MagicMock(spec=ModifierGroup)
    g.id = group_id or str(uuid.uuid4())
    g.name = name
    g.is_required = is_required
    g.min_selections = min_selections
    g.max_selections = max_selections
    return g


def _make_link(product_id=PRODUCT_ID, modifier_group_id=None):
    link = MagicMock(spec=ProductModifierGroup)
    link.product_id = product_id
    link.modifier_group_id = modifier_group_id or str(uuid.uuid4())
    return link


def _make_modifier(mod_id=None, group_id=None, is_default=False):
    m = MagicMock(spec=Modifier)
    m.id = mod_id or str(uuid.uuid4())
    m.group_id = group_id or str(uuid.uuid4())
    m.is_default = is_default
    return m


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def svc(db):
    return ModifierValidationService(db)


# ── validate_group_selection ─────────────────────────────────────


class TestValidateGroupSelection:
    """Tests for the per-group validation logic (no DB calls)."""

    def test_required_group_empty_selection(self, svc):
        group = _make_group(group_id=GROUP_ID_A, is_required=True)
        errors = svc.validate_group_selection(group, [])
        assert len(errors) == 1
        assert errors[0].error_type == "required_missing"
        assert errors[0].group_id == GROUP_ID_A

    def test_required_group_with_selection_passes(self, svc):
        group = _make_group(group_id=GROUP_ID_A, is_required=True, min_selections=0)
        errors = svc.validate_group_selection(group, [MODIFIER_1])
        assert errors == []

    def test_min_selections_not_met(self, svc):
        group = _make_group(min_selections=3)
        errors = svc.validate_group_selection(group, [MODIFIER_1, MODIFIER_2])
        assert len(errors) == 1
        assert errors[0].error_type == "min_not_met"
        assert "at least 3" in errors[0].message

    def test_min_selections_zero_count_skips_check(self, svc):
        """When count == 0 the min check is skipped (only required fires)."""
        group = _make_group(min_selections=2, is_required=False)
        errors = svc.validate_group_selection(group, [])
        assert errors == []

    def test_min_selections_exact_passes(self, svc):
        group = _make_group(min_selections=2)
        errors = svc.validate_group_selection(group, [MODIFIER_1, MODIFIER_2])
        assert errors == []

    def test_max_selections_exceeded(self, svc):
        group = _make_group(max_selections=1)
        errors = svc.validate_group_selection(group, [MODIFIER_1, MODIFIER_2])
        assert len(errors) == 1
        assert errors[0].error_type == "max_exceeded"
        assert "at most 1" in errors[0].message

    def test_max_selections_none_means_unlimited(self, svc):
        group = _make_group(max_selections=None)
        errors = svc.validate_group_selection(group, [MODIFIER_1, MODIFIER_2, MODIFIER_3])
        assert errors == []

    def test_max_selections_exact_passes(self, svc):
        group = _make_group(max_selections=2)
        errors = svc.validate_group_selection(group, [MODIFIER_1, MODIFIER_2])
        assert errors == []

    def test_multiple_errors_at_once(self, svc):
        """Required + min_not_met can't co-occur (count==0 skips min check),
        but required + max_exceeded is impossible too.  However min + max
        can both fire if min > max (pathological config)."""
        group = _make_group(is_required=True, min_selections=3, max_selections=1)
        errors = svc.validate_group_selection(group, [MODIFIER_1, MODIFIER_2])
        types = {e.error_type for e in errors}
        # count=2 < min=3 AND count=2 > max=1
        assert "min_not_met" in types
        assert "max_exceeded" in types


# ── validate_selections (full product) ───────────────────────────


class TestValidateSelections:
    """Tests for the top-level validate_selections method."""

    def test_no_groups_assigned_returns_valid(self, svc, db):
        db.query.return_value = _chain(rows=[])
        result = svc.validate_selections(PRODUCT_ID, {})
        assert result.is_valid is True
        assert result.errors == []

    def test_valid_selections_pass(self, svc, db):
        link = _make_link(modifier_group_id=GROUP_ID_A)
        group = _make_group(group_id=GROUP_ID_A, is_required=True, min_selections=1, max_selections=3)

        call_counter = {"n": 0}
        chains = [
            _chain(rows=[link]),
            _chain(rows=[group]),
        ]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[idx]

        db.query.side_effect = query_side_effect

        result = svc.validate_selections(PRODUCT_ID, {GROUP_ID_A: [MODIFIER_1]})
        assert result.is_valid is True

    def test_missing_required_group_selection(self, svc, db):
        link = _make_link(modifier_group_id=GROUP_ID_A)
        group = _make_group(group_id=GROUP_ID_A, is_required=True)

        call_counter = {"n": 0}
        chains = [
            _chain(rows=[link]),
            _chain(rows=[group]),
        ]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[idx]

        db.query.side_effect = query_side_effect

        result = svc.validate_selections(PRODUCT_ID, {})
        assert result.is_valid is False
        assert len(result.errors) == 1
        assert result.errors[0].error_type == "required_missing"

    def test_multiple_groups_partial_failure(self, svc, db):
        link_a = _make_link(modifier_group_id=GROUP_ID_A)
        link_b = _make_link(modifier_group_id=GROUP_ID_B)
        group_a = _make_group(group_id=GROUP_ID_A, is_required=True)
        group_b = _make_group(group_id=GROUP_ID_B, is_required=False, max_selections=1)

        call_counter = {"n": 0}
        chains = [
            _chain(rows=[link_a, link_b]),
            _chain(rows=[group_a, group_b]),
        ]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[idx]

        db.query.side_effect = query_side_effect

        selections = {
            # group_a required but empty -> error
            GROUP_ID_B: [MODIFIER_1, MODIFIER_2],  # exceeds max=1 -> error
        }
        result = svc.validate_selections(PRODUCT_ID, selections)
        assert result.is_valid is False
        assert len(result.errors) == 2


# ── has_required_modifiers ───────────────────────────────────────


class TestHasRequiredModifiers:
    def test_returns_false_when_no_links(self, svc, db):
        db.query.return_value = _chain(rows=[])
        assert svc.has_required_modifiers(PRODUCT_ID) is False

    def test_returns_true_when_required_groups_exist(self, svc, db):
        link = _make_link(modifier_group_id=GROUP_ID_A)

        call_counter = {"n": 0}
        chains = [
            _chain(rows=[link]),
            _chain(count=1),
        ]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[idx]

        db.query.side_effect = query_side_effect
        assert svc.has_required_modifiers(PRODUCT_ID) is True

    def test_returns_false_when_no_required_groups(self, svc, db):
        link = _make_link(modifier_group_id=GROUP_ID_A)

        call_counter = {"n": 0}
        chains = [
            _chain(rows=[link]),
            _chain(count=0),
        ]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[idx]

        db.query.side_effect = query_side_effect
        assert svc.has_required_modifiers(PRODUCT_ID) is False


# ── get_default_selections ───────────────────────────────────────


class TestGetDefaultSelections:
    def test_returns_empty_when_no_links(self, svc, db):
        db.query.return_value = _chain(rows=[])
        assert svc.get_default_selections(PRODUCT_ID) == {}

    def test_returns_default_modifiers_grouped(self, svc, db):
        link = _make_link(modifier_group_id=GROUP_ID_A)
        mod1 = _make_modifier(mod_id=MODIFIER_1, group_id=GROUP_ID_A, is_default=True)
        mod2 = _make_modifier(mod_id=MODIFIER_2, group_id=GROUP_ID_A, is_default=True)

        call_counter = {"n": 0}
        chains = [
            _chain(rows=[link]),
            _chain(rows=[mod1, mod2]),
        ]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[idx]

        db.query.side_effect = query_side_effect

        result = svc.get_default_selections(PRODUCT_ID)
        assert GROUP_ID_A in result
        assert set(result[GROUP_ID_A]) == {MODIFIER_1, MODIFIER_2}

    def test_returns_defaults_across_multiple_groups(self, svc, db):
        link_a = _make_link(modifier_group_id=GROUP_ID_A)
        link_b = _make_link(modifier_group_id=GROUP_ID_B)
        mod_a = _make_modifier(mod_id=MODIFIER_1, group_id=GROUP_ID_A, is_default=True)
        mod_b = _make_modifier(mod_id=MODIFIER_2, group_id=GROUP_ID_B, is_default=True)

        call_counter = {"n": 0}
        chains = [
            _chain(rows=[link_a, link_b]),
            _chain(rows=[mod_a, mod_b]),
        ]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[idx]

        db.query.side_effect = query_side_effect

        result = svc.get_default_selections(PRODUCT_ID)
        assert result[GROUP_ID_A] == [MODIFIER_1]
        assert result[GROUP_ID_B] == [MODIFIER_2]

    def test_returns_empty_dict_when_no_defaults(self, svc, db):
        link = _make_link(modifier_group_id=GROUP_ID_A)

        call_counter = {"n": 0}
        chains = [
            _chain(rows=[link]),
            _chain(rows=[]),
        ]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[idx]

        db.query.side_effect = query_side_effect

        result = svc.get_default_selections(PRODUCT_ID)
        assert result == {}
