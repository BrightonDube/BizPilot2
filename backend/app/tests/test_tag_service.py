"""Unit tests for TagService.

Tests cover:
- Tag category CRUD (create, list, get, update, delete)
- Tag CRUD (create, list, get, update, delete)
- Hierarchy computation (root, nested, missing parent)
- Product-tag associations (assign, remove, get)
- Usage count tracking
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.models.tag import TagCategory, Tag, ProductTag
from app.services.tag_service import TagService


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = uuid.uuid4()


def _svc():
    db = MagicMock()
    return TagService(db), db


def _chain(first=None, rows=None, count=0):
    """Return a chainable mock that mimics a SQLAlchemy query."""
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


def _mock_category(**overrides):
    cat = MagicMock(spec=TagCategory)
    cat.id = overrides.get("id", uuid.uuid4())
    cat.business_id = overrides.get("business_id", BIZ)
    cat.name = overrides.get("name", "Colour")
    cat.slug = overrides.get("slug", "colour")
    cat.description = overrides.get("description", None)
    cat.color = overrides.get("color", None)
    cat.icon = overrides.get("icon", None)
    cat.sort_order = overrides.get("sort_order", 0)
    cat.is_active = overrides.get("is_active", True)
    cat.deleted_at = overrides.get("deleted_at", None)
    return cat


def _mock_tag(**overrides):
    tag = MagicMock(spec=Tag)
    tag.id = overrides.get("id", uuid.uuid4())
    tag.business_id = overrides.get("business_id", BIZ)
    tag.category_id = overrides.get("category_id", None)
    tag.parent_tag_id = overrides.get("parent_tag_id", None)
    tag.name = overrides.get("name", "Red")
    tag.slug = overrides.get("slug", "red")
    tag.description = overrides.get("description", None)
    tag.color = overrides.get("color", None)
    tag.hierarchy_level = overrides.get("hierarchy_level", 0)
    tag.hierarchy_path = overrides.get("hierarchy_path", "/")
    tag.usage_count = overrides.get("usage_count", 0)
    tag.is_system_tag = overrides.get("is_system_tag", False)
    tag.is_active = overrides.get("is_active", True)
    tag.auto_apply_rules = overrides.get("auto_apply_rules", None)
    tag.deleted_at = overrides.get("deleted_at", None)
    return tag


def _mock_product_tag(**overrides):
    pt = MagicMock(spec=ProductTag)
    pt.id = overrides.get("id", uuid.uuid4())
    pt.product_id = overrides.get("product_id", uuid.uuid4())
    pt.tag_id = overrides.get("tag_id", uuid.uuid4())
    pt.assigned_by = overrides.get("assigned_by", None)
    pt.assigned_at = overrides.get("assigned_at", None)
    pt.assignment_source = overrides.get("assignment_source", "manual")
    return pt


# ══════════════════════════════════════════════════════════════════════════════
# Tag Category CRUD
# ══════════════════════════════════════════════════════════════════════════════


class TestCreateCategory:
    def test_creates_and_commits(self):
        svc, db = _svc()
        result = svc.create_category(BIZ, name="Colour", slug="colour")

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        assert result is not None

    def test_optional_fields_set(self):
        svc, db = _svc()
        result = svc.create_category(
            BIZ,
            name="Size",
            slug="size",
            description="Product sizes",
            color="#FF0000",
            icon="ruler",
            sort_order=5,
        )
        added = db.add.call_args[0][0]
        assert added.name == "Size"
        assert added.slug == "size"
        assert added.description == "Product sizes"
        assert added.color == "#FF0000"
        assert added.icon == "ruler"
        assert added.sort_order == 5
        assert added.is_active is True


class TestListCategories:
    def test_returns_items_and_total(self):
        svc, db = _svc()
        cats = [_mock_category(), _mock_category(name="Size")]
        chain = _chain(rows=cats, count=2)
        db.query.return_value = chain

        items, total = svc.list_categories(BIZ)
        assert items == cats
        assert total == 2

    def test_pagination_offset(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_categories(BIZ, page=3, per_page=10)
        chain.offset.assert_called_once_with(20)
        chain.limit.assert_called_once_with(10)


class TestGetCategory:
    def test_found(self):
        svc, db = _svc()
        cat = _mock_category()
        chain = _chain(first=cat)
        db.query.return_value = chain

        result = svc.get_category(cat.id)
        assert result is cat

    def test_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.get_category(uuid.uuid4())
        assert result is None


class TestUpdateCategory:
    def test_updates_fields(self):
        svc, db = _svc()
        cat = _mock_category()
        chain = _chain(first=cat)
        db.query.return_value = chain

        result = svc.update_category(cat.id, name="Updated")
        assert result is cat
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(cat)

    def test_not_found_returns_none(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.update_category(uuid.uuid4(), name="X")
        assert result is None
        db.commit.assert_not_called()

    def test_ignores_none_values(self):
        svc, db = _svc()
        cat = _mock_category(name="Original")
        chain = _chain(first=cat)
        db.query.return_value = chain

        svc.update_category(cat.id, name=None)
        # setattr should not be called with None value
        db.commit.assert_called_once()


class TestDeleteCategory:
    def test_soft_deletes(self):
        svc, db = _svc()
        cat = _mock_category()
        chain = _chain(first=cat)
        db.query.return_value = chain

        result = svc.delete_category(cat.id)
        assert result is True
        cat.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_not_found_returns_false(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.delete_category(uuid.uuid4())
        assert result is False
        db.commit.assert_not_called()


# ══════════════════════════════════════════════════════════════════════════════
# Hierarchy computation
# ══════════════════════════════════════════════════════════════════════════════


class TestComputeHierarchy:
    def test_no_parent_returns_root(self):
        svc, db = _svc()
        level, path = svc._compute_hierarchy(None)
        assert level == 0
        assert path == "/"

    def test_parent_not_found_returns_root(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        level, path = svc._compute_hierarchy(uuid.uuid4())
        assert level == 0
        assert path == "/"

    def test_valid_parent(self):
        svc, db = _svc()
        parent = _mock_tag(
            slug="food",
            hierarchy_level=0,
            hierarchy_path="/",
        )
        chain = _chain(first=parent)
        db.query.return_value = chain

        level, path = svc._compute_hierarchy(parent.id)
        assert level == 1
        assert path == "/food/"

    def test_nested_parent(self):
        svc, db = _svc()
        parent = _mock_tag(
            slug="vegan",
            hierarchy_level=1,
            hierarchy_path="/food/",
        )
        chain = _chain(first=parent)
        db.query.return_value = chain

        level, path = svc._compute_hierarchy(parent.id)
        assert level == 2
        assert path == "/food/vegan/"


# ══════════════════════════════════════════════════════════════════════════════
# Tag CRUD
# ══════════════════════════════════════════════════════════════════════════════


class TestCreateTag:
    def test_creates_root_tag(self):
        svc, db = _svc()
        result = svc.create_tag(BIZ, name="Red", slug="red")

        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.name == "Red"
        assert added.slug == "red"
        assert added.hierarchy_level == 0
        assert added.hierarchy_path == "/"
        assert added.usage_count == 0
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_creates_child_tag(self):
        svc, db = _svc()
        parent = _mock_tag(slug="food", hierarchy_level=0, hierarchy_path="/")
        chain = _chain(first=parent)
        db.query.return_value = chain

        result = svc.create_tag(
            BIZ,
            name="Vegan",
            slug="vegan",
            parent_tag_id=parent.id,
        )
        added = db.add.call_args[0][0]
        assert added.hierarchy_level == 1
        assert added.hierarchy_path == "/food/"

    def test_optional_fields(self):
        svc, db = _svc()
        cat_id = uuid.uuid4()
        result = svc.create_tag(
            BIZ,
            name="Organic",
            slug="organic",
            category_id=cat_id,
            description="Organic products",
            color="#00FF00",
            is_system_tag=True,
            auto_apply_rules={"field": "name", "pattern": "organic"},
        )
        added = db.add.call_args[0][0]
        assert added.category_id == cat_id
        assert added.description == "Organic products"
        assert added.color == "#00FF00"
        assert added.is_system_tag is True
        assert added.auto_apply_rules == {"field": "name", "pattern": "organic"}


class TestListTags:
    def test_basic_list(self):
        svc, db = _svc()
        tags = [_mock_tag(), _mock_tag(name="Blue")]
        chain = _chain(rows=tags, count=2)
        db.query.return_value = chain

        items, total = svc.list_tags(BIZ)
        assert items == tags
        assert total == 2

    def test_with_category_filter(self):
        svc, db = _svc()
        cat_id = uuid.uuid4()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_tags(BIZ, category_id=cat_id)
        # filter called multiple times: business_id+deleted_at, then category_id
        assert chain.filter.call_count >= 2

    def test_with_search(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_tags(BIZ, search="red")
        assert chain.filter.call_count >= 2

    def test_pagination(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_tags(BIZ, page=2, per_page=25)
        chain.offset.assert_called_once_with(25)
        chain.limit.assert_called_once_with(25)


class TestGetTag:
    def test_found(self):
        svc, db = _svc()
        tag = _mock_tag()
        chain = _chain(first=tag)
        db.query.return_value = chain

        assert svc.get_tag(tag.id) is tag

    def test_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        assert svc.get_tag(uuid.uuid4()) is None


class TestUpdateTag:
    def test_updates_fields(self):
        svc, db = _svc()
        tag = _mock_tag()
        chain = _chain(first=tag)
        db.query.return_value = chain

        result = svc.update_tag(tag.id, name="Updated")
        assert result is tag
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(tag)

    def test_not_found_returns_none(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.update_tag(uuid.uuid4(), name="X")
        assert result is None
        db.commit.assert_not_called()

    def test_recomputes_hierarchy_on_parent_change(self):
        """When parent_tag_id changes, hierarchy should be recomputed."""
        svc, db = _svc()
        tag = _mock_tag(hierarchy_level=0, hierarchy_path="/")
        new_parent = _mock_tag(slug="drinks", hierarchy_level=0, hierarchy_path="/")

        call_count = 0

        def query_side_effect(model):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # get_tag call
                return _chain(first=tag)
            else:
                # _compute_hierarchy parent lookup
                return _chain(first=new_parent)

        db.query.side_effect = query_side_effect

        result = svc.update_tag(tag.id, parent_tag_id=new_parent.id)
        assert result is tag
        assert tag.hierarchy_level == 1
        assert tag.hierarchy_path == "/drinks/"


class TestDeleteTag:
    def test_soft_deletes(self):
        svc, db = _svc()
        tag = _mock_tag()
        chain = _chain(first=tag)
        db.query.return_value = chain

        result = svc.delete_tag(tag.id)
        assert result is True
        tag.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_not_found_returns_false(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.delete_tag(uuid.uuid4())
        assert result is False
        db.commit.assert_not_called()


# ══════════════════════════════════════════════════════════════════════════════
# Product-Tag associations
# ══════════════════════════════════════════════════════════════════════════════


class TestAssignTag:
    def test_creates_association_and_increments_count(self):
        svc, db = _svc()
        product_id = uuid.uuid4()
        tag = _mock_tag(usage_count=3)
        chain = _chain(first=tag)
        db.query.return_value = chain

        result = svc.assign_tag(product_id, tag.id, assigned_by=uuid.uuid4())
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.product_id == product_id
        assert added.tag_id == tag.id
        assert tag.usage_count == 4
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_tag_not_found_still_commits(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.assign_tag(uuid.uuid4(), uuid.uuid4())
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_source_defaults_to_manual(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        svc.assign_tag(uuid.uuid4(), uuid.uuid4())
        added = db.add.call_args[0][0]
        assert added.assignment_source == "manual"

    def test_custom_source(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        svc.assign_tag(uuid.uuid4(), uuid.uuid4(), source="auto_rule")
        added = db.add.call_args[0][0]
        assert added.assignment_source == "auto_rule"

    def test_usage_count_none_becomes_one(self):
        svc, db = _svc()
        tag = _mock_tag(usage_count=None)
        chain = _chain(first=tag)
        db.query.return_value = chain

        svc.assign_tag(uuid.uuid4(), tag.id)
        assert tag.usage_count == 1


class TestRemoveTag:
    def test_removes_and_decrements_count(self):
        svc, db = _svc()
        product_id = uuid.uuid4()
        tag_id = uuid.uuid4()
        pt = _mock_product_tag(product_id=product_id, tag_id=tag_id)
        tag = _mock_tag(id=tag_id, usage_count=5)

        call_count = 0

        def query_side_effect(model):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return _chain(first=pt)
            else:
                return _chain(first=tag)

        db.query.side_effect = query_side_effect

        result = svc.remove_tag(product_id, tag_id)
        assert result is True
        db.delete.assert_called_once_with(pt)
        assert tag.usage_count == 4
        db.commit.assert_called_once()

    def test_not_found_returns_false(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.remove_tag(uuid.uuid4(), uuid.uuid4())
        assert result is False
        db.delete.assert_not_called()
        db.commit.assert_not_called()

    def test_no_decrement_when_usage_count_zero(self):
        svc, db = _svc()
        product_id = uuid.uuid4()
        tag_id = uuid.uuid4()
        pt = _mock_product_tag(product_id=product_id, tag_id=tag_id)
        tag = _mock_tag(id=tag_id, usage_count=0)

        call_count = 0

        def query_side_effect(model):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return _chain(first=pt)
            else:
                return _chain(first=tag)

        db.query.side_effect = query_side_effect

        svc.remove_tag(product_id, tag_id)
        assert tag.usage_count == 0


class TestGetProductTags:
    def test_returns_tags(self):
        svc, db = _svc()
        product_id = uuid.uuid4()
        pts = [_mock_product_tag(product_id=product_id), _mock_product_tag(product_id=product_id)]
        chain = _chain(rows=pts)
        db.query.return_value = chain

        result = svc.get_product_tags(product_id)
        assert result == pts
        assert len(result) == 2

    def test_empty_list(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        result = svc.get_product_tags(uuid.uuid4())
        assert result == []
