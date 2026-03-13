"""Unit tests for BulkOperationsService.

Covers price updates, stock adjustments, category assignment,
activate/deactivate, soft delete, and CSV import/export.
"""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.models.product import Product, ProductStatus
from app.models.inventory import InventoryItem
from app.models.customer import Customer
from app.services.bulk_operations_service import BulkOperationsService


BIZ_ID = str(uuid.uuid4())


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def service(db):
    return BulkOperationsService(db)


# ---------------------------------------------------------------------------
# bulk_price_update
# ---------------------------------------------------------------------------

class TestBulkPriceUpdate:
    """Tests for BulkOperationsService.bulk_price_update."""

    def test_percentage_increase(self, service, db):
        """Increases price by percentage."""
        p1 = MagicMock(spec=Product)
        p1.selling_price = Decimal("100.00")
        db.query.return_value.filter.return_value.all.return_value = [p1]

        count = service.bulk_price_update(BIZ_ID, ["id1"], "percentage", 10)
        assert count == 1
        assert p1.selling_price == Decimal("110.00")
        db.commit.assert_called()

    def test_fixed_price(self, service, db):
        """Sets a fixed price."""
        p1 = MagicMock(spec=Product)
        p1.selling_price = Decimal("100.00")
        db.query.return_value.filter.return_value.all.return_value = [p1]

        count = service.bulk_price_update(BIZ_ID, ["id1"], "fixed", 75.50)
        assert count == 1
        assert p1.selling_price == Decimal("75.50")

    def test_increment_price(self, service, db):
        """Adds a fixed amount to price."""
        p1 = MagicMock(spec=Product)
        p1.selling_price = Decimal("100.00")
        db.query.return_value.filter.return_value.all.return_value = [p1]

        count = service.bulk_price_update(BIZ_ID, ["id1"], "increment", 25)
        assert count == 1
        assert p1.selling_price == Decimal("125.00")

    def test_no_products_found(self, service, db):
        """Returns 0 when no products match."""
        db.query.return_value.filter.return_value.all.return_value = []
        count = service.bulk_price_update(BIZ_ID, ["bad"], "fixed", 100)
        assert count == 0

    def test_multiple_products(self, service, db):
        """Updates multiple products at once."""
        p1 = MagicMock(spec=Product, selling_price=Decimal("50.00"))
        p2 = MagicMock(spec=Product, selling_price=Decimal("80.00"))
        db.query.return_value.filter.return_value.all.return_value = [p1, p2]

        count = service.bulk_price_update(BIZ_ID, ["id1", "id2"], "percentage", 10)
        assert count == 2


# ---------------------------------------------------------------------------
# bulk_stock_adjust
# ---------------------------------------------------------------------------

class TestBulkStockAdjust:
    """Tests for BulkOperationsService.bulk_stock_adjust."""

    def test_adjust_stock(self, service, db):
        """Adjusts inventory quantity."""
        item = MagicMock(spec=InventoryItem)
        item.quantity_on_hand = 100
        db.query.return_value.filter.return_value.first.return_value = item

        count = service.bulk_stock_adjust(BIZ_ID, [
            {"product_id": "p1", "quantity_change": -10, "reason": "sold"},
        ])
        assert count == 1
        assert item.quantity_on_hand == 90
        db.commit.assert_called()

    def test_skip_missing_items(self, service, db):
        """Skips adjustments for items not found."""
        db.query.return_value.filter.return_value.first.return_value = None
        count = service.bulk_stock_adjust(BIZ_ID, [
            {"product_id": "missing", "quantity_change": 5, "reason": "test"},
        ])
        assert count == 0


# ---------------------------------------------------------------------------
# bulk_category_assign
# ---------------------------------------------------------------------------

class TestBulkCategoryAssign:
    """Tests for BulkOperationsService.bulk_category_assign."""

    def test_assign_category(self, service, db):
        """Assigns category to products."""
        db.query.return_value.filter.return_value.update.return_value = 3
        count = service.bulk_category_assign(BIZ_ID, ["p1", "p2", "p3"], "cat1")
        assert count == 3
        db.commit.assert_called()


# ---------------------------------------------------------------------------
# bulk_activate_products
# ---------------------------------------------------------------------------

class TestBulkActivateProducts:
    """Tests for BulkOperationsService.bulk_activate_products."""

    def test_activate(self, service, db):
        """Activates products."""
        db.query.return_value.filter.return_value.update.return_value = 2
        count = service.bulk_activate_products(BIZ_ID, ["p1", "p2"], True)
        assert count == 2

    def test_deactivate(self, service, db):
        """Archives products."""
        db.query.return_value.filter.return_value.update.return_value = 1
        count = service.bulk_activate_products(BIZ_ID, ["p1"], False)
        assert count == 1


# ---------------------------------------------------------------------------
# bulk_delete_products
# ---------------------------------------------------------------------------

class TestBulkDeleteProducts:
    """Tests for BulkOperationsService.bulk_delete_products."""

    def test_soft_delete(self, service, db):
        """Soft-deletes products by setting deleted_at."""
        db.query.return_value.filter.return_value.update.return_value = 2
        count = service.bulk_delete_products(BIZ_ID, ["p1", "p2"])
        assert count == 2
        db.commit.assert_called()


# ---------------------------------------------------------------------------
# export_products_csv
# ---------------------------------------------------------------------------

class TestExportProductsCsv:
    """Tests for BulkOperationsService.export_products_csv."""

    def test_export_returns_dicts(self, service, db):
        """Returns a list of product dicts."""
        p = MagicMock(spec=Product)
        p.id = uuid.uuid4()
        p.name = "Widget"
        p.sku = "SKU-1"
        p.barcode = "123456"
        p.cost_price = Decimal("50.00")
        p.selling_price = Decimal("100.00")
        p.quantity = 25
        p.status = ProductStatus.ACTIVE
        p.category_id = uuid.uuid4()
        p.description = "A widget"
        db.query.return_value.filter.return_value.all.return_value = [p]

        result = service.export_products_csv(BIZ_ID)
        assert len(result) == 1
        assert result[0]["name"] == "Widget"
        assert result[0]["selling_price"] == 100.0

    def test_export_empty(self, service, db):
        """Returns empty list when no products."""
        db.query.return_value.filter.return_value.all.return_value = []
        result = service.export_products_csv(BIZ_ID)
        assert result == []


# ---------------------------------------------------------------------------
# import_products_csv
# ---------------------------------------------------------------------------

class TestImportProductsCsv:
    """Tests for BulkOperationsService.import_products_csv."""

    def test_import_rows(self, service, db):
        """Imports products from CSV rows."""
        rows = [
            {"name": "Product A", "selling_price": "99.99", "cost_price": "50", "quantity": "10"},
            {"name": "Product B", "selling_price": "149.99"},
        ]
        count = service.import_products_csv(BIZ_ID, rows)
        assert count == 2
        assert db.add.call_count == 2
        db.commit.assert_called()


# ---------------------------------------------------------------------------
# export_customers_csv
# ---------------------------------------------------------------------------

class TestExportCustomersCsv:
    """Tests for BulkOperationsService.export_customers_csv."""

    def test_export_customers(self, service, db):
        """Returns customer dicts."""
        c = MagicMock(spec=Customer)
        c.id = uuid.uuid4()
        c.customer_type = MagicMock(value="individual")
        c.first_name = "John"
        c.last_name = "Doe"
        c.email = "john@test.com"
        c.phone = "0821234567"
        c.company_name = ""
        c.tax_number = ""
        c.address_line1 = "123 Main St"
        c.address_line2 = ""
        c.city = "Cape Town"
        c.state = "WC"
        c.postal_code = "8000"
        c.country = "ZA"
        c.notes = ""
        db.query.return_value.filter.return_value.all.return_value = [c]

        result = service.export_customers_csv(BIZ_ID)
        assert len(result) == 1
        assert result[0]["first_name"] == "John"


# ---------------------------------------------------------------------------
# import_customers_csv
# ---------------------------------------------------------------------------

class TestImportCustomersCsv:
    """Tests for BulkOperationsService.import_customers_csv."""

    def test_import_customers(self, service, db):
        """Imports customers from CSV rows."""
        rows = [
            {"first_name": "Alice", "last_name": "Smith", "email": "alice@test.com"},
        ]
        count = service.import_customers_csv(BIZ_ID, rows)
        assert count == 1
        db.add.assert_called_once()
        db.commit.assert_called()
