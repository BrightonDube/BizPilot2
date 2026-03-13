"""
Tests for SmartCollectionService.

Covers CRUD for collections, product membership (add/remove/list/exclude),
the product-count helper, and the refresh-collection stub.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from unittest.mock import MagicMock, patch


from app.models.tag import SmartCollection, CollectionProduct
from app.services.smart_collection_service import SmartCollectionService


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _svc():
    db = MagicMock()
    return SmartCollectionService(db), db


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
    return c


BIZ_ID = uuid.uuid4()
USER_ID = uuid.uuid4()


def _mock_collection(**overrides):
    c = MagicMock(spec=SmartCollection)
    c.id = overrides.get("id", uuid.uuid4())
    c.business_id = overrides.get("business_id", BIZ_ID)
    c.name = overrides.get("name", "Summer Sale")
    c.slug = overrides.get("slug", "summer-sale")
    c.description = overrides.get("description", None)
    c.rules = overrides.get("rules", None)
    c.rule_logic = overrides.get("rule_logic", "and")
    c.is_active = overrides.get("is_active", True)
    c.auto_update = overrides.get("auto_update", True)
    c.product_count = overrides.get("product_count", 0)
    c.last_refresh_at = overrides.get("last_refresh_at", None)
    c.created_by = overrides.get("created_by", None)
    c.deleted_at = overrides.get("deleted_at", None)
    return c


def _mock_membership(**overrides):
    m = MagicMock(spec=CollectionProduct)
    m.id = overrides.get("id", uuid.uuid4())
    m.collection_id = overrides.get("collection_id", uuid.uuid4())
    m.product_id = overrides.get("product_id", uuid.uuid4())
    m.manually_included = overrides.get("manually_included", False)
    m.manually_excluded = overrides.get("manually_excluded", False)
    m.added_at = overrides.get("added_at", None)
    return m


# ==================================================================
# Collection CRUD
# ==================================================================


class TestCreateCollection:
    """Tests for SmartCollectionService.create_collection."""

    @patch("app.services.smart_collection_service.SmartCollection")
    def test_create_with_defaults(self, MockSC):
        svc, db = _svc()
        instance = MagicMock()
        MockSC.return_value = instance

        result = svc.create_collection(BIZ_ID, "Promo", "promo")

        MockSC.assert_called_once_with(
            business_id=BIZ_ID,
            name="Promo",
            slug="promo",
            description=None,
            rules=None,
            rule_logic="and",
            is_active=True,
            auto_update=True,
            product_count=0,
            created_by=None,
        )
        db.add.assert_called_once_with(instance)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(instance)
        assert result is instance

    @patch("app.services.smart_collection_service.SmartCollection")
    def test_create_with_all_fields(self, MockSC):
        svc, db = _svc()
        instance = MagicMock()
        MockSC.return_value = instance
        rules = [{"field": "price", "op": "gt", "value": 100}]

        result = svc.create_collection(
            business_id=BIZ_ID,
            name="Expensive",
            slug="expensive",
            rules=rules,
            rule_logic="or",
            description="High-priced items",
            auto_update=False,
            created_by=USER_ID,
        )

        MockSC.assert_called_once_with(
            business_id=BIZ_ID,
            name="Expensive",
            slug="expensive",
            description="High-priced items",
            rules=rules,
            rule_logic="or",
            is_active=True,
            auto_update=False,
            product_count=0,
            created_by=USER_ID,
        )
        assert result is instance


class TestListCollections:
    """Tests for SmartCollectionService.list_collections."""

    def test_active_only_default(self):
        svc, db = _svc()
        col = _mock_collection()
        chain = _chain(rows=[col], count=1)
        db.query.return_value = chain

        items, total = svc.list_collections(BIZ_ID)

        assert items == [col]
        assert total == 1
        # filter called twice: once in base query, once for active_only
        assert chain.filter.call_count == 2

    def test_include_inactive(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        items, total = svc.list_collections(BIZ_ID, active_only=False)

        assert items == []
        assert total == 0
        # filter called once: only the base business_id + deleted_at filter
        assert chain.filter.call_count == 1

    def test_pagination_offset_limit(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=5)
        db.query.return_value = chain

        svc.list_collections(BIZ_ID, page=3, per_page=10)

        chain.offset.assert_called_once_with(20)  # (3-1)*10
        chain.limit.assert_called_once_with(10)


class TestGetCollection:
    """Tests for SmartCollectionService.get_collection."""

    def test_found(self):
        svc, db = _svc()
        col = _mock_collection()
        db.query.return_value = _chain(first=col)

        assert svc.get_collection(col.id) is col

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        assert svc.get_collection(uuid.uuid4()) is None


class TestUpdateCollection:
    """Tests for SmartCollectionService.update_collection."""

    def test_updates_fields(self):
        svc, db = _svc()
        col = _mock_collection()
        db.query.return_value = _chain(first=col)

        result = svc.update_collection(
            col.id,
            name="Winter Sale",
            description="Cold deals",
            rules=[{"field": "tag", "value": "winter"}],
            rule_logic="or",
            is_active=False,
            auto_update=False,
        )

        assert result is col
        assert col.name == "Winter Sale"
        assert col.description == "Cold deals"
        assert col.rules == [{"field": "tag", "value": "winter"}]
        assert col.rule_logic == "or"
        assert col.is_active is False
        assert col.auto_update is False
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(col)

    def test_not_found_returns_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        assert svc.update_collection(uuid.uuid4(), name="X") is None
        db.commit.assert_not_called()

    def test_partial_update_leaves_other_fields(self):
        svc, db = _svc()
        col = _mock_collection(name="Old", description="Orig")
        db.query.return_value = _chain(first=col)

        svc.update_collection(col.id, name="New")

        assert col.name == "New"
        # description should NOT have been reassigned
        assert col.description == "Orig"


class TestDeleteCollection:
    """Tests for SmartCollectionService.delete_collection."""

    def test_found(self):
        svc, db = _svc()
        col = _mock_collection()
        db.query.return_value = _chain(first=col)

        assert svc.delete_collection(col.id) is True
        col.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        assert svc.delete_collection(uuid.uuid4()) is False
        db.commit.assert_not_called()


# ==================================================================
# Product membership
# ==================================================================


class TestAddProduct:
    """Tests for SmartCollectionService.add_product."""

    @patch("app.services.smart_collection_service.CollectionProduct")
    def test_add_product(self, MockCP):
        svc, db = _svc()
        col_id = uuid.uuid4()
        prod_id = uuid.uuid4()
        membership = MagicMock()
        MockCP.return_value = membership
        col = _mock_collection(id=col_id)

        # _update_product_count issues 2 db.query calls:
        #   1) func.count → scalar
        #   2) SmartCollection lookup → first
        call_count = 0

        def query_side_effect(*args):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return _chain(scalar=3)
            else:
                return _chain(first=col)

        db.query.side_effect = query_side_effect

        result = svc.add_product(col_id, prod_id, manually_included=True)

        assert result is membership
        db.add.assert_called_once_with(membership)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(membership)
        assert col.product_count == 3

    @patch("app.services.smart_collection_service.CollectionProduct")
    def test_add_product_default_flags(self, MockCP):
        svc, db = _svc()
        col_id = uuid.uuid4()
        prod_id = uuid.uuid4()
        MockCP.return_value = MagicMock()

        db.query.side_effect = lambda *a: _chain(scalar=0, first=_mock_collection())

        svc.add_product(col_id, prod_id)

        _, kwargs = MockCP.call_args
        assert kwargs["manually_included"] is False
        assert kwargs["manually_excluded"] is False


class TestRemoveProduct:
    """Tests for SmartCollectionService.remove_product."""

    def test_found(self):
        svc, db = _svc()
        col_id = uuid.uuid4()
        prod_id = uuid.uuid4()
        membership = _mock_membership(collection_id=col_id, product_id=prod_id)
        col = _mock_collection(id=col_id)

        # 3 db.query calls: find membership, count, collection lookup
        call_count = 0

        def query_side_effect(*args):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return _chain(first=membership)
            elif call_count == 2:
                return _chain(scalar=0)
            else:
                return _chain(first=col)

        db.query.side_effect = query_side_effect

        assert svc.remove_product(col_id, prod_id) is True
        db.delete.assert_called_once_with(membership)
        db.commit.assert_called_once()

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        assert svc.remove_product(uuid.uuid4(), uuid.uuid4()) is False
        db.delete.assert_not_called()
        db.commit.assert_not_called()


class TestListProducts:
    """Tests for SmartCollectionService.list_products."""

    def test_returns_non_excluded(self):
        svc, db = _svc()
        m1 = _mock_membership()
        m2 = _mock_membership()
        db.query.return_value = _chain(rows=[m1, m2])

        result = svc.list_products(uuid.uuid4())

        assert result == [m1, m2]

    def test_empty(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])

        assert svc.list_products(uuid.uuid4()) == []


class TestExcludeProduct:
    """Tests for SmartCollectionService.exclude_product."""

    def test_found(self):
        svc, db = _svc()
        col_id = uuid.uuid4()
        prod_id = uuid.uuid4()
        membership = _mock_membership(collection_id=col_id, product_id=prod_id)
        col = _mock_collection(id=col_id)

        call_count = 0

        def query_side_effect(*args):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return _chain(first=membership)
            elif call_count == 2:
                return _chain(scalar=2)
            else:
                return _chain(first=col)

        db.query.side_effect = query_side_effect

        assert svc.exclude_product(col_id, prod_id) is True
        assert membership.manually_excluded is True
        db.commit.assert_called_once()
        assert col.product_count == 2

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        assert svc.exclude_product(uuid.uuid4(), uuid.uuid4()) is False
        db.commit.assert_not_called()


# ==================================================================
# Helpers / Refresh
# ==================================================================


class TestUpdateProductCount:
    """Tests for _update_product_count (private helper)."""

    def test_sets_count_on_collection(self):
        svc, db = _svc()
        col_id = uuid.uuid4()
        col = _mock_collection(id=col_id, product_count=0)

        call_count = 0

        def query_side_effect(*args):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return _chain(scalar=7)
            else:
                return _chain(first=col)

        db.query.side_effect = query_side_effect

        svc._update_product_count(col_id)

        assert col.product_count == 7

    def test_defaults_to_zero_when_scalar_is_none(self):
        svc, db = _svc()
        col_id = uuid.uuid4()
        col = _mock_collection(id=col_id, product_count=5)

        call_count = 0

        def query_side_effect(*args):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return _chain(scalar=None)
            else:
                return _chain(first=col)

        db.query.side_effect = query_side_effect

        svc._update_product_count(col_id)

        assert col.product_count == 0

    def test_no_collection_found(self):
        """When collection lookup returns None, no assignment happens."""
        svc, db = _svc()
        col_id = uuid.uuid4()

        call_count = 0

        def query_side_effect(*args):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return _chain(scalar=5)
            else:
                return _chain(first=None)

        db.query.side_effect = query_side_effect

        # Should not raise
        svc._update_product_count(col_id)


class TestRefreshCollection:
    """Tests for SmartCollectionService.refresh_collection."""

    def test_found(self):
        svc, db = _svc()
        col = _mock_collection()
        col.last_refresh_at = None
        db.query.return_value = _chain(first=col)

        result = svc.refresh_collection(col.id)

        assert result is col
        assert col.last_refresh_at is not None
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(col)

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        assert svc.refresh_collection(uuid.uuid4()) is None
        db.commit.assert_not_called()
