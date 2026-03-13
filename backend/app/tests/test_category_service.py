"""Unit tests for CategoryService.

Tests cover:
- Business lookup (_get_user_business_id)
- Category listing with pagination and parent filtering
- Category tree building (flat and hierarchical)
- Category CRUD (create, get, update, delete)
- Category reordering (objects and dicts)
- Edge cases (no business, not found, self-parent, missing parent)
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from unittest.mock import MagicMock

import pytest

from app.models.product import ProductCategory
from app.models.business_user import BusinessUser
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryReorderItem
from app.services.category_service import CategoryService


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = uuid.uuid4()
USER = uuid.uuid4()


def _svc():
    db = MagicMock()
    return CategoryService(db), db


def _chain(first=None, rows=None, count=0, scalar=None):
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
    c.scalar.return_value = scalar
    c.update.return_value = count
    c.group_by.return_value = c
    return c


def _sides(*chains):
    """Create a db.query.side_effect; last chain repeats for overflow calls."""
    call_count = 0

    def side_effect(*args):
        nonlocal call_count
        idx = min(call_count, len(chains) - 1)
        call_count += 1
        return chains[idx]

    return side_effect


def _bu():
    bu = MagicMock(spec=BusinessUser)
    bu.user_id = USER
    bu.business_id = BIZ
    return bu


def _cat(**kw):
    c = MagicMock(spec=ProductCategory)
    c.id = kw.get("id", uuid.uuid4())
    c.business_id = kw.get("business_id", BIZ)
    c.parent_id = kw.get("parent_id", None)
    c.name = kw.get("name", "Test Category")
    c.description = kw.get("description", None)
    c.color = kw.get("color", None)
    c.image_url = kw.get("image_url", None)
    c.sort_order = kw.get("sort_order", 0)
    return c


def _refresh_sets_id(obj):
    """Side-effect for db.refresh that assigns an id when missing."""
    if getattr(obj, "id", None) is None:
        obj.id = uuid.uuid4()


# ══════════════════════════════════════════════════════════════════════════════
# _get_user_business_id
# ══════════════════════════════════════════════════════════════════════════════


class TestGetUserBusinessId:
    def test_returns_business_id(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=_bu())
        assert svc._get_user_business_id(USER) == BIZ

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc._get_user_business_id(USER) is None


# ══════════════════════════════════════════════════════════════════════════════
# list_categories
# ══════════════════════════════════════════════════════════════════════════════


class TestListCategories:
    def test_empty_when_no_business(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        items, total = svc.list_categories(USER)
        assert items == []
        assert total == 0

    def test_returns_items_and_total(self):
        svc, db = _svc()
        c1, c2 = _cat(name="A"), _cat(name="B")
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(rows=[c1, c2], count=2),
            _chain(scalar=0),
        )

        items, total = svc.list_categories(USER)
        assert total == 2
        assert len(items) == 2
        assert items[0].name == "A"
        assert items[1].name == "B"

    def test_filters_by_parent_id(self):
        svc, db = _svc()
        cat_chain = _chain(rows=[], count=0)
        db.query.side_effect = _sides(_chain(first=_bu()), cat_chain)

        svc.list_categories(USER, parent_id=uuid.uuid4())
        # business_id filter + parent_id filter
        assert cat_chain.filter.call_count >= 2

    def test_pagination(self):
        svc, db = _svc()
        cat_chain = _chain(rows=[], count=50)
        db.query.side_effect = _sides(_chain(first=_bu()), cat_chain)

        _, total = svc.list_categories(USER, skip=20, limit=10)
        assert total == 50
        cat_chain.offset.assert_called_once_with(20)
        cat_chain.limit.assert_called_once_with(10)


# ══════════════════════════════════════════════════════════════════════════════
# get_category_tree
# ══════════════════════════════════════════════════════════════════════════════


class TestGetCategoryTree:
    def test_empty_when_no_business(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.get_category_tree(USER) == []

    def test_flat_categories(self):
        svc, db = _svc()
        c1, c2 = _cat(name="A"), _cat(name="B")
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(rows=[c1, c2]),
            _chain(rows=[]),  # product counts
        )

        result = svc.get_category_tree(USER)
        assert len(result) == 2
        assert result[0].name == "A"
        assert result[0].children == []
        assert result[1].name == "B"

    def test_hierarchical_tree(self):
        svc, db = _svc()
        root_id, child_id = uuid.uuid4(), uuid.uuid4()
        root = _cat(id=root_id, name="Root")
        child = _cat(id=child_id, name="Child", parent_id=root_id)

        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(rows=[root, child]),
            _chain(rows=[(root_id, 3), (child_id, 1)]),
        )

        result = svc.get_category_tree(USER)
        assert len(result) == 1
        assert result[0].name == "Root"
        assert result[0].product_count == 3
        assert len(result[0].children) == 1
        assert result[0].children[0].name == "Child"
        assert result[0].children[0].product_count == 1


# ══════════════════════════════════════════════════════════════════════════════
# create_category
# ══════════════════════════════════════════════════════════════════════════════


class TestCreateCategory:
    def test_creates_and_commits(self):
        svc, db = _svc()
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(scalar=0),
        )
        db.refresh.side_effect = _refresh_sets_id

        result = svc.create_category(CategoryCreate(name="New"), USER)

        db.add.assert_called_once()
        db.commit.assert_called_once()
        assert result.name == "New"
        assert result.product_count == 0

    def test_raises_when_no_business(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        with pytest.raises(ValueError, match="not associated"):
            svc.create_category(CategoryCreate(name="X"), USER)

    def test_validates_parent(self):
        svc, db = _svc()
        parent = _cat()
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(first=parent),
            _chain(scalar=0),
        )
        db.refresh.side_effect = _refresh_sets_id

        result = svc.create_category(
            CategoryCreate(name="Child", parent_id=parent.id), USER
        )
        assert result.name == "Child"

    def test_parent_not_found_raises(self):
        svc, db = _svc()
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(first=None),
        )

        with pytest.raises(ValueError, match="Parent category not found"):
            svc.create_category(
                CategoryCreate(name="Child", parent_id=uuid.uuid4()), USER
            )


# ══════════════════════════════════════════════════════════════════════════════
# get_category
# ══════════════════════════════════════════════════════════════════════════════


class TestGetCategory:
    def test_found(self):
        svc, db = _svc()
        cat = _cat(name="Found")
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(first=cat),
            _chain(scalar=5),
        )

        result = svc.get_category(cat.id, USER)
        assert result is not None
        assert result.name == "Found"
        assert result.product_count == 5

    def test_not_found(self):
        svc, db = _svc()
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(first=None),
        )
        assert svc.get_category(uuid.uuid4(), USER) is None

    def test_no_business_returns_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.get_category(uuid.uuid4(), USER) is None


# ══════════════════════════════════════════════════════════════════════════════
# update_category
# ══════════════════════════════════════════════════════════════════════════════


class TestUpdateCategory:
    def test_updates_fields(self):
        svc, db = _svc()
        cat = _cat(name="Old")
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(first=cat),
            _chain(scalar=0),
        )

        result = svc.update_category(cat.id, CategoryUpdate(name="New"), USER)
        assert result.name == "New"
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(cat)

    def test_not_found_returns_none(self):
        svc, db = _svc()
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(first=None),
        )

        result = svc.update_category(uuid.uuid4(), CategoryUpdate(name="X"), USER)
        assert result is None
        db.commit.assert_not_called()

    def test_no_business_returns_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.update_category(uuid.uuid4(), CategoryUpdate(name="X"), USER)
        assert result is None

    def test_self_parent_raises(self):
        svc, db = _svc()
        cat = _cat()
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(first=cat),
        )

        with pytest.raises(ValueError, match="cannot be its own parent"):
            svc.update_category(cat.id, CategoryUpdate(parent_id=cat.id), USER)

    def test_invalid_parent_raises(self):
        svc, db = _svc()
        cat = _cat()
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(first=cat),
            _chain(first=None),
        )

        with pytest.raises(ValueError, match="Parent category not found"):
            svc.update_category(
                cat.id, CategoryUpdate(parent_id=uuid.uuid4()), USER
            )


# ══════════════════════════════════════════════════════════════════════════════
# delete_category
# ══════════════════════════════════════════════════════════════════════════════


class TestDeleteCategory:
    def test_deletes_and_reparents_children(self):
        svc, db = _svc()
        cat = _cat()
        children_chain = _chain()
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(first=cat),
            children_chain,
        )

        assert svc.delete_category(cat.id, USER) is True
        db.delete.assert_called_once_with(cat)
        db.commit.assert_called_once()
        children_chain.update.assert_called_once()

    def test_not_found_returns_false(self):
        svc, db = _svc()
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(first=None),
        )

        assert svc.delete_category(uuid.uuid4(), USER) is False
        db.delete.assert_not_called()

    def test_no_business_returns_false(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        assert svc.delete_category(uuid.uuid4(), USER) is False


# ══════════════════════════════════════════════════════════════════════════════
# reorder_categories
# ══════════════════════════════════════════════════════════════════════════════


class TestReorderCategories:
    def test_reorders_with_objects(self):
        svc, db = _svc()
        c1, c2 = _cat(), _cat()
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(first=c1),
            _chain(first=c2),
        )

        orders = [
            CategoryReorderItem(id=c1.id, sort_order=2),
            CategoryReorderItem(id=c2.id, sort_order=1),
        ]
        assert svc.reorder_categories(orders, USER) is True
        assert c1.sort_order == 2
        assert c2.sort_order == 1
        db.commit.assert_called_once()

    def test_reorders_with_dicts(self):
        svc, db = _svc()
        cat = _cat()
        new_parent = uuid.uuid4()
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(first=cat),
        )

        orders = [{"id": cat.id, "sort_order": 5, "parent_id": new_parent}]
        assert svc.reorder_categories(orders, USER) is True
        assert cat.sort_order == 5
        assert cat.parent_id == new_parent

    def test_no_business_returns_false(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        assert svc.reorder_categories([], USER) is False

    def test_skips_missing_categories(self):
        svc, db = _svc()
        db.query.side_effect = _sides(
            _chain(first=_bu()),
            _chain(first=None),
        )

        orders = [CategoryReorderItem(id=uuid.uuid4(), sort_order=1)]
        assert svc.reorder_categories(orders, USER) is True
        db.commit.assert_called_once()
