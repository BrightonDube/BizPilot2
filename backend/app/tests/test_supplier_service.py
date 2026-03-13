"""Unit tests for SupplierService.

Tests cover:
- Supplier listing with search, tag filter, sort, pagination
- Single supplier retrieval by ID and email
- Supplier creation with all fields and tag defaults
- Supplier update via model_dump(exclude_unset=True)
- Soft deletion
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from unittest.mock import MagicMock


from app.models.supplier import Supplier
from app.services.supplier_service import SupplierService


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = str(uuid.uuid4())


def _svc():
    db = MagicMock()
    return SupplierService(db), db


def _chain(first=None, rows=None, count=0):
    """Return a chainable mock that mimics a SQLAlchemy query."""
    c = MagicMock()
    c.filter.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    return c


def _mock_supplier(**kwargs):
    """Create a mock Supplier."""
    s = MagicMock(spec=Supplier)
    s.id = kwargs.get("id", uuid.uuid4())
    s.business_id = kwargs.get("business_id", BIZ)
    s.name = kwargs.get("name", "Test Supplier")
    s.contact_name = kwargs.get("contact_name", "John Doe")
    s.email = kwargs.get("email", "supplier@example.com")
    s.phone = kwargs.get("phone", "+27123456789")
    s.tax_number = kwargs.get("tax_number", None)
    s.website = kwargs.get("website", None)
    s.address_line1 = kwargs.get("address_line1", None)
    s.address_line2 = kwargs.get("address_line2", None)
    s.city = kwargs.get("city", None)
    s.state = kwargs.get("state", None)
    s.postal_code = kwargs.get("postal_code", None)
    s.country = kwargs.get("country", None)
    s.notes = kwargs.get("notes", None)
    s.tags = kwargs.get("tags", [])
    s.deleted_at = kwargs.get("deleted_at", None)
    return s


# ══════════════════════════════════════════════════════════════════════════════
# get_suppliers
# ══════════════════════════════════════════════════════════════════════════════


class TestGetSuppliers:
    def test_returns_items_and_total(self):
        svc, db = _svc()
        rows = [_mock_supplier(), _mock_supplier()]
        chain = _chain(rows=rows, count=2)
        db.query.return_value = chain

        suppliers, total = svc.get_suppliers(BIZ)

        assert suppliers == rows
        assert total == 2
        db.query.assert_called_once_with(Supplier)

    def test_search_adds_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_suppliers(BIZ, search="acme")

        # base filter + search filter
        assert chain.filter.call_count >= 2

    def test_tag_adds_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_suppliers(BIZ, tag="preferred")

        # base filter + tag filter
        assert chain.filter.call_count >= 2

    def test_pagination_offset_limit_page1(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=5)
        db.query.return_value = chain

        svc.get_suppliers(BIZ, page=1, per_page=20)

        chain.offset.assert_called_once_with(0)
        chain.limit.assert_called_once_with(20)

    def test_pagination_offset_limit_page2(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=30)
        db.query.return_value = chain

        svc.get_suppliers(BIZ, page=2, per_page=10)

        chain.offset.assert_called_once_with(10)
        chain.limit.assert_called_once_with(10)

    def test_pagination_offset_limit_page3(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=50)
        db.query.return_value = chain

        svc.get_suppliers(BIZ, page=3, per_page=15)

        chain.offset.assert_called_once_with(30)
        chain.limit.assert_called_once_with(15)

    def test_sort_order_desc(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_suppliers(BIZ, sort_order="desc")

        chain.order_by.assert_called_once()

    def test_sort_order_asc(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_suppliers(BIZ, sort_order="asc")

        chain.order_by.assert_called_once()

    def test_empty_results(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        suppliers, total = svc.get_suppliers(BIZ)

        assert suppliers == []
        assert total == 0


# ══════════════════════════════════════════════════════════════════════════════
# get_supplier
# ══════════════════════════════════════════════════════════════════════════════


class TestGetSupplier:
    def test_returns_supplier(self):
        svc, db = _svc()
        supplier = _mock_supplier()
        chain = _chain(first=supplier)
        db.query.return_value = chain

        result = svc.get_supplier(str(supplier.id), BIZ)

        assert result is supplier
        db.query.assert_called_once_with(Supplier)

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.get_supplier(str(uuid.uuid4()), BIZ)

        assert result is None


# ══════════════════════════════════════════════════════════════════════════════
# get_supplier_by_email
# ══════════════════════════════════════════════════════════════════════════════


class TestGetSupplierByEmail:
    def test_returns_supplier(self):
        svc, db = _svc()
        supplier = _mock_supplier(email="found@example.com")
        chain = _chain(first=supplier)
        db.query.return_value = chain

        result = svc.get_supplier_by_email("found@example.com", BIZ)

        assert result is supplier
        db.query.assert_called_once_with(Supplier)

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.get_supplier_by_email("missing@example.com", BIZ)

        assert result is None


# ══════════════════════════════════════════════════════════════════════════════
# create_supplier
# ══════════════════════════════════════════════════════════════════════════════


class TestCreateSupplier:
    def test_creates_with_all_fields(self):
        svc, db = _svc()
        data = MagicMock()
        data.name = "Acme Corp"
        data.contact_name = "Jane Smith"
        data.email = "jane@acme.com"
        data.phone = "+27111111111"
        data.tax_number = "TAX123"
        data.website = "https://acme.com"
        data.address_line1 = "123 Main St"
        data.address_line2 = "Suite 4"
        data.city = "Cape Town"
        data.state = "Western Cape"
        data.postal_code = "8001"
        data.country = "ZA"
        data.notes = "Important supplier"
        data.tags = ["preferred", "local"]

        svc.create_supplier(BIZ, data)

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, Supplier)
        assert added.business_id == BIZ
        assert added.name == "Acme Corp"
        assert added.contact_name == "Jane Smith"
        assert added.email == "jane@acme.com"
        assert added.phone == "+27111111111"
        assert added.tax_number == "TAX123"
        assert added.website == "https://acme.com"
        assert added.address_line1 == "123 Main St"
        assert added.address_line2 == "Suite 4"
        assert added.city == "Cape Town"
        assert added.state == "Western Cape"
        assert added.postal_code == "8001"
        assert added.country == "ZA"
        assert added.notes == "Important supplier"
        assert added.tags == ["preferred", "local"]

    def test_tags_default_to_empty_list(self):
        svc, db = _svc()
        data = MagicMock()
        data.name = "No Tags Supplier"
        data.contact_name = None
        data.email = None
        data.phone = None
        data.tax_number = None
        data.website = None
        data.address_line1 = None
        data.address_line2 = None
        data.city = None
        data.state = None
        data.postal_code = None
        data.country = None
        data.notes = None
        data.tags = None

        svc.create_supplier(BIZ, data)

        added = db.add.call_args[0][0]
        assert added.tags == []

    def test_calls_add_commit_refresh(self):
        svc, db = _svc()
        data = MagicMock()
        data.name = "Simple"
        data.contact_name = None
        data.email = None
        data.phone = None
        data.tax_number = None
        data.website = None
        data.address_line1 = None
        data.address_line2 = None
        data.city = None
        data.state = None
        data.postal_code = None
        data.country = None
        data.notes = None
        data.tags = []

        result = svc.create_supplier(BIZ, data)

        assert db.add.call_count == 1
        assert db.commit.call_count == 1
        assert db.refresh.call_count == 1
        assert isinstance(result, Supplier)


# ══════════════════════════════════════════════════════════════════════════════
# update_supplier
# ══════════════════════════════════════════════════════════════════════════════


class TestUpdateSupplier:
    def test_updates_fields_from_model_dump(self):
        svc, db = _svc()
        supplier = _mock_supplier(name="Old Name", phone="+27000000000")
        data = MagicMock()
        data.model_dump.return_value = {"name": "New Name", "phone": "+27999999999"}

        result = svc.update_supplier(supplier, data)

        data.model_dump.assert_called_once_with(exclude_unset=True)
        assert supplier.name == "New Name"
        assert supplier.phone == "+27999999999"
        assert result is supplier

    def test_calls_commit_and_refresh(self):
        svc, db = _svc()
        supplier = _mock_supplier()
        data = MagicMock()
        data.model_dump.return_value = {"notes": "Updated notes"}

        svc.update_supplier(supplier, data)

        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(supplier)

    def test_no_fields_updated_when_empty_dump(self):
        svc, db = _svc()
        supplier = _mock_supplier(name="Stay Same")
        data = MagicMock()
        data.model_dump.return_value = {}

        result = svc.update_supplier(supplier, data)

        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(supplier)
        assert result is supplier


# ══════════════════════════════════════════════════════════════════════════════
# delete_supplier
# ══════════════════════════════════════════════════════════════════════════════


class TestDeleteSupplier:
    def test_calls_soft_delete_and_commit(self):
        svc, db = _svc()
        supplier = _mock_supplier()

        svc.delete_supplier(supplier)

        supplier.soft_delete.assert_called_once()
        db.commit.assert_called_once()
