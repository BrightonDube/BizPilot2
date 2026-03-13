"""Unit tests for AddonService.

Covers modifier-group CRUD, modifier CRUD, product↔group linking,
nested modifier groups, and nesting-depth validation.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")

import uuid
from unittest.mock import MagicMock

import pytest

from app.models.addon import ProductModifierGroup, SelectionType
from app.models.menu import Modifier, ModifierGroup
from app.services.addon_service import AddonService


BIZ_ID = str(uuid.uuid4())
GROUP_ID = str(uuid.uuid4())
MODIFIER_ID = str(uuid.uuid4())
PRODUCT_ID = str(uuid.uuid4())


def _chain(first=None, rows=None, count=0):
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
    return c


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def svc(db):
    return AddonService(db)


# ── Modifier Groups ──────────────────────────────────────────────


class TestCreateModifierGroup:
    def test_creates_group_with_defaults(self, svc, db):
        svc.create_modifier_group(BIZ_ID, "Toppings")
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, ModifierGroup)
        assert added.name == "Toppings"
        assert added.business_id == BIZ_ID
        assert added.selection_type == SelectionType.SINGLE
        assert added.is_required is False

    def test_creates_group_with_custom_params(self, svc, db):
        svc.create_modifier_group(
            BIZ_ID,
            "Sizes",
            selection_type=SelectionType.MULTIPLE,
            is_required=True,
            min_selections=1,
            max_selections=3,
            description="Pick sizes",
        )
        added = db.add.call_args[0][0]
        assert added.selection_type == SelectionType.MULTIPLE
        assert added.is_required is True
        assert added.min_selections == 1
        assert added.max_selections == 3
        assert added.description == "Pick sizes"


class TestListModifierGroups:
    def test_returns_groups(self, svc, db):
        groups = [MagicMock(spec=ModifierGroup), MagicMock(spec=ModifierGroup)]
        db.query.return_value = _chain(rows=groups)
        result = svc.list_modifier_groups(BIZ_ID)
        assert result == groups

    def test_returns_empty_list(self, svc, db):
        db.query.return_value = _chain()
        result = svc.list_modifier_groups(BIZ_ID)
        assert result == []


class TestGetModifierGroup:
    def test_returns_group(self, svc, db):
        group = MagicMock(spec=ModifierGroup)
        db.query.return_value = _chain(first=group)
        result = svc.get_modifier_group(GROUP_ID, BIZ_ID)
        assert result is group

    def test_returns_none_when_missing(self, svc, db):
        db.query.return_value = _chain(first=None)
        assert svc.get_modifier_group(GROUP_ID, BIZ_ID) is None


class TestUpdateModifierGroup:
    def test_updates_fields(self, svc, db):
        group = MagicMock(spec=ModifierGroup)
        group.name = "Old"
        # get_modifier_group is called internally
        db.query.return_value = _chain(first=group)
        result = svc.update_modifier_group(GROUP_ID, BIZ_ID, name="New")
        assert result is group
        assert group.name == "New"
        db.commit.assert_called()
        db.refresh.assert_called_once_with(group)

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)
        result = svc.update_modifier_group(GROUP_ID, BIZ_ID, name="New")
        assert result is None
        db.commit.assert_not_called()

    def test_ignores_unknown_field(self, svc, db):
        group = MagicMock(spec=ModifierGroup)
        group.name = "Same"
        # hasattr on MagicMock(spec=...) returns False for attrs not in spec
        db.query.return_value = _chain(first=group)
        svc.update_modifier_group(GROUP_ID, BIZ_ID, nonexistent_field="val")
        # name unchanged since we only set an unknown attr
        assert group.name == "Same"


class TestDeleteModifierGroup:
    def test_soft_deletes(self, svc, db):
        group = MagicMock(spec=ModifierGroup)
        db.query.return_value = _chain(first=group)
        result = svc.delete_modifier_group(GROUP_ID, BIZ_ID)
        assert result is group
        group.soft_delete.assert_called_once()
        db.commit.assert_called()

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)
        result = svc.delete_modifier_group(GROUP_ID, BIZ_ID)
        assert result is None


# ── Modifiers ─────────────────────────────────────────────────────


class TestAddModifier:
    def test_adds_modifier(self, svc, db):
        parent_group = MagicMock(spec=ModifierGroup)
        parent_group.business_id = uuid.UUID(BIZ_ID)
        db.query.return_value = _chain(first=parent_group)

        svc.add_modifier(GROUP_ID, "Extra Cheese", price_adjustment=5.0)
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, Modifier)
        assert added.name == "Extra Cheese"
        assert added.price_adjustment == 5.0
        assert added.group_id == GROUP_ID
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_raises_when_group_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)
        with pytest.raises(ValueError, match="Modifier group not found"):
            svc.add_modifier(GROUP_ID, "Nope")


class TestUpdateModifier:
    def test_updates_modifier(self, svc, db):
        modifier = MagicMock(spec=Modifier)
        modifier.name = "Old"
        db.query.return_value = _chain(first=modifier)
        result = svc.update_modifier(MODIFIER_ID, name="New")
        assert result is modifier
        assert modifier.name == "New"
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(modifier)

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)
        result = svc.update_modifier(MODIFIER_ID, name="New")
        assert result is None
        db.commit.assert_not_called()


class TestDeleteModifier:
    def test_soft_deletes(self, svc, db):
        modifier = MagicMock(spec=Modifier)
        db.query.return_value = _chain(first=modifier)
        result = svc.delete_modifier(MODIFIER_ID)
        assert result is modifier
        modifier.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)
        result = svc.delete_modifier(MODIFIER_ID)
        assert result is None


# ── Product ↔ ModifierGroup linking ──────────────────────────────


class TestAssignGroupToProduct:
    def test_creates_new_link(self, svc, db):
        db.query.return_value = _chain(first=None)
        svc.assign_group_to_product(PRODUCT_ID, GROUP_ID, sort_order=2)
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, ProductModifierGroup)
        assert added.product_id == PRODUCT_ID
        assert added.modifier_group_id == GROUP_ID
        assert added.sort_order == 2
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_returns_existing_link(self, svc, db):
        existing = MagicMock(spec=ProductModifierGroup)
        db.query.return_value = _chain(first=existing)
        result = svc.assign_group_to_product(PRODUCT_ID, GROUP_ID)
        assert result is existing
        db.add.assert_not_called()


class TestRemoveGroupFromProduct:
    def test_removes_link(self, svc, db):
        link = MagicMock(spec=ProductModifierGroup)
        db.query.return_value = _chain(first=link)
        result = svc.remove_group_from_product(PRODUCT_ID, GROUP_ID)
        assert result is True
        link.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_returns_false_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)
        result = svc.remove_group_from_product(PRODUCT_ID, GROUP_ID)
        assert result is False


class TestGetProductModifiers:
    def test_returns_groups_for_product(self, svc, db):
        link = MagicMock(spec=ProductModifierGroup)
        link.modifier_group_id = uuid.UUID(GROUP_ID)

        grp = MagicMock(spec=ModifierGroup)

        call_counter = {"n": 0}
        chains = [
            _chain(rows=[link]),   # first call: ProductModifierGroup query
            _chain(rows=[grp]),    # second call: ModifierGroup query
        ]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[idx]

        db.query.side_effect = query_side_effect

        result = svc.get_product_modifiers(PRODUCT_ID)
        assert result == [grp]

    def test_returns_empty_when_no_links(self, svc, db):
        db.query.return_value = _chain(rows=[])
        result = svc.get_product_modifiers(PRODUCT_ID)
        assert result == []


# ── Nested Modifiers ─────────────────────────────────────────────


class TestGetNestedModifierGroups:
    def test_returns_child_groups(self, svc, db):
        child = MagicMock(spec=ModifierGroup)
        db.query.return_value = _chain(rows=[child])
        result = svc.get_nested_modifier_groups(MODIFIER_ID)
        assert result == [child]

    def test_returns_empty_list(self, svc, db):
        db.query.return_value = _chain(rows=[])
        result = svc.get_nested_modifier_groups(MODIFIER_ID)
        assert result == []


class TestAttachNestedModifierGroup:
    def _make_modifier(self, group_id=None, parent_modifier_id=None):
        """Helper to build a Modifier mock with group_id."""
        m = MagicMock(spec=Modifier)
        m.id = str(uuid.uuid4())
        m.group_id = group_id or str(uuid.uuid4())
        return m

    def _make_group(self, parent_modifier_id=None):
        """Helper to build a ModifierGroup mock."""
        g = MagicMock(spec=ModifierGroup)
        g.id = str(uuid.uuid4())
        g.parent_modifier_id = parent_modifier_id
        return g

    def test_attaches_at_depth_zero(self, svc, db):
        """Top-level modifier (depth 0) can have a nested group attached."""
        parent_mod = self._make_modifier()
        target_group = self._make_group()

        # _get_modifier_nesting_depth walks up: queries Modifier then ModifierGroup.
        # For depth 0: the modifier's group has parent_modifier_id=None → break.
        top_level_group = self._make_group(parent_modifier_id=None)

        call_counter = {"n": 0}

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            if idx == 0:
                # attach_nested: lookup parent modifier
                return _chain(first=parent_mod)
            if idx == 1:
                # _get_modifier_nesting_depth: lookup modifier by id
                return _chain(first=parent_mod)
            if idx == 2:
                # _get_modifier_nesting_depth: lookup group for that modifier
                return _chain(first=top_level_group)
            if idx == 3:
                # attach_nested: lookup the group to attach
                return _chain(first=target_group)
            return _chain()

        db.query.side_effect = query_side_effect

        result = svc.attach_nested_modifier_group(MODIFIER_ID, GROUP_ID)
        assert result is target_group
        assert target_group.parent_modifier_id == MODIFIER_ID
        db.commit.assert_called()
        db.refresh.assert_called_once_with(target_group)

    def test_raises_when_parent_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)
        with pytest.raises(ValueError, match="Parent modifier not found"):
            svc.attach_nested_modifier_group(MODIFIER_ID, GROUP_ID)

    def test_raises_when_group_not_found(self, svc, db):
        """Parent modifier exists but target group does not."""
        parent_mod = self._make_modifier()
        top_group = self._make_group(parent_modifier_id=None)

        call_counter = {"n": 0}

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            if idx == 0:
                return _chain(first=parent_mod)
            if idx == 1:
                return _chain(first=parent_mod)
            if idx == 2:
                return _chain(first=top_group)
            # idx 3: target group not found
            return _chain(first=None)

        db.query.side_effect = query_side_effect

        with pytest.raises(ValueError, match="Modifier group not found"):
            svc.attach_nested_modifier_group(MODIFIER_ID, GROUP_ID)

    def test_raises_when_depth_exceeds_max(self, svc, db):
        """Modifier already at depth 2 → attaching is rejected."""
        parent_mod = self._make_modifier(group_id="g1")

        # Depth walk: modifier→group (has parent)→modifier→group (has parent)→
        # modifier→group (has parent) means depth increments to 2 then ≥ MAX.
        mod_at_depth1 = self._make_modifier(group_id="g2")
        group_with_parent_1 = self._make_group(parent_modifier_id="some_mod")
        mod_at_depth2 = self._make_modifier(group_id="g3")
        group_with_parent_2 = self._make_group(parent_modifier_id="some_mod2")

        call_counter = {"n": 0}

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            if idx == 0:
                # attach: lookup parent modifier
                return _chain(first=parent_mod)
            # Depth loop iteration 1
            if idx == 1:
                # _get_modifier_nesting_depth: lookup modifier
                return _chain(first=parent_mod)
            if idx == 2:
                # _get_modifier_nesting_depth: lookup modifier's group
                return _chain(first=group_with_parent_1)
            # Depth loop iteration 2 (depth now 1)
            if idx == 3:
                return _chain(first=mod_at_depth1)
            if idx == 4:
                return _chain(first=group_with_parent_2)
            # Depth loop iteration 3 (depth now 2, which == MAX_NESTING_DEPTH)
            # The while loop condition checks depth <= MAX_NESTING_DEPTH (2)
            # so it enters the loop again at depth=2
            if idx == 5:
                return _chain(first=mod_at_depth2)
            if idx == 6:
                # group with no parent → break out
                return _chain(first=self._make_group(parent_modifier_id=None))
            return _chain()

        db.query.side_effect = query_side_effect

        with pytest.raises(ValueError, match="Cannot nest beyond 2 levels"):
            svc.attach_nested_modifier_group(MODIFIER_ID, GROUP_ID)
