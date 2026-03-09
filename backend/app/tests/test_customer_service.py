"""Unit tests for CustomerService.

Tests cover:
- Customer CRUD (get, list, create, update, soft-delete)
- Search, type filter, tag filter, sorting, pagination
- Bulk operations (create, delete)
- Customer metrics update
- Top customers retrieval
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.models.customer import Customer, CustomerType
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.services.customer_service import CustomerService


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = str(uuid.uuid4())


def _svc():
    db = MagicMock()
    return CustomerService(db), db


def _chain(first=None, rows=None, count=0):
    """Return a chainable mock that mimics a SQLAlchemy query."""
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.order_by = MagicMock(return_value=q)
    q.offset = MagicMock(return_value=q)
    q.limit = MagicMock(return_value=q)
    q.all = MagicMock(return_value=rows if rows is not None else [])
    q.first = MagicMock(return_value=first)
    q.count = MagicMock(return_value=count)
    q.update = MagicMock(return_value=count)
    return q


def _mock_customer(**kwargs):
    """Create a mock Customer."""
    c = MagicMock(spec=Customer)
    c.id = kwargs.get("id", uuid.uuid4())
    c.business_id = kwargs.get("business_id", BIZ)
    c.customer_type = kwargs.get("customer_type", CustomerType.INDIVIDUAL)
    c.first_name = kwargs.get("first_name", "John")
    c.last_name = kwargs.get("last_name", "Doe")
    c.email = kwargs.get("email", "john@example.com")
    c.phone = kwargs.get("phone", "+27123456789")
    c.company_name = kwargs.get("company_name", None)
    c.tax_number = kwargs.get("tax_number", None)
    c.address_line1 = kwargs.get("address_line1", "123 Main St")
    c.address_line2 = kwargs.get("address_line2", None)
    c.city = kwargs.get("city", "Cape Town")
    c.state = kwargs.get("state", "Western Cape")
    c.postal_code = kwargs.get("postal_code", "8001")
    c.country = kwargs.get("country", "South Africa")
    c.notes = kwargs.get("notes", None)
    c.tags = kwargs.get("tags", [])
    c.total_orders = kwargs.get("total_orders", 0)
    c.total_spent = kwargs.get("total_spent", Decimal("0"))
    c.average_order_value = kwargs.get("average_order_value", Decimal("0"))
    c.deleted_at = kwargs.get("deleted_at", None)
    return c


# ══════════════════════════════════════════════════════════════════════════════
# get_customer
# ══════════════════════════════════════════════════════════════════════════════


class TestGetCustomer:
    def test_found(self):
        svc, db = _svc()
        customer = _mock_customer()
        chain = _chain(first=customer)
        db.query.return_value = chain

        result = svc.get_customer(str(customer.id), BIZ)

        assert result is customer
        db.query.assert_called_once_with(Customer)
        chain.filter.assert_called_once()

    def test_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.get_customer(str(uuid.uuid4()), BIZ)

        assert result is None


# ══════════════════════════════════════════════════════════════════════════════
# get_customer_by_email
# ══════════════════════════════════════════════════════════════════════════════


class TestGetCustomerByEmail:
    def test_found(self):
        svc, db = _svc()
        customer = _mock_customer(email="found@example.com")
        chain = _chain(first=customer)
        db.query.return_value = chain

        result = svc.get_customer_by_email("found@example.com", BIZ)

        assert result is customer
        db.query.assert_called_once_with(Customer)

    def test_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.get_customer_by_email("missing@example.com", BIZ)

        assert result is None


# ══════════════════════════════════════════════════════════════════════════════
# get_customers (list with filters & pagination)
# ══════════════════════════════════════════════════════════════════════════════


class TestGetCustomers:
    def test_basic_pagination_defaults(self):
        svc, db = _svc()
        rows = [_mock_customer(), _mock_customer()]
        chain = _chain(rows=rows, count=2)
        db.query.return_value = chain

        customers, total = svc.get_customers(BIZ)

        assert customers == rows
        assert total == 2
        chain.offset.assert_called_once_with(0)
        chain.limit.assert_called_once_with(20)

    def test_pagination_page_two(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=35)
        db.query.return_value = chain

        _, total = svc.get_customers(BIZ, page=2, per_page=10)

        assert total == 35
        chain.offset.assert_called_once_with(10)
        chain.limit.assert_called_once_with(10)

    def test_pagination_page_three(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=50)
        db.query.return_value = chain

        svc.get_customers(BIZ, page=3, per_page=15)

        chain.offset.assert_called_once_with(30)  # (3-1)*15
        chain.limit.assert_called_once_with(15)

    def test_search_adds_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_customers(BIZ, search="john")

        # Base filter + search filter
        assert chain.filter.call_count >= 2

    def test_customer_type_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_customers(BIZ, customer_type=CustomerType.BUSINESS)

        assert chain.filter.call_count >= 2

    def test_tag_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_customers(BIZ, tag="vip")

        assert chain.filter.call_count >= 2

    def test_all_filters_combined(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_customers(
            BIZ,
            search="acme",
            customer_type=CustomerType.BUSINESS,
            tag="wholesale",
        )

        # base + search + type + tag = at least 4
        assert chain.filter.call_count >= 4

    def test_sort_order_asc(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_customers(BIZ, sort_by="first_name", sort_order="asc")

        chain.order_by.assert_called_once()

    def test_sort_order_desc_default(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_customers(BIZ)

        chain.order_by.assert_called_once()

    def test_empty_results(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        customers, total = svc.get_customers(BIZ)

        assert customers == []
        assert total == 0


# ══════════════════════════════════════════════════════════════════════════════
# create_customer
# ══════════════════════════════════════════════════════════════════════════════


class TestCreateCustomer:
    @patch("app.services.customer_service.Customer")
    def test_create_basic(self, MockCustomer):
        svc, db = _svc()
        fake_customer = MagicMock()
        MockCustomer.return_value = fake_customer
        data = MagicMock(spec=CustomerCreate)
        data.customer_type = CustomerType.INDIVIDUAL
        data.first_name = "Jane"
        data.last_name = "Smith"
        data.email = "jane@example.com"
        data.phone = "+27111111111"
        data.company_name = None
        data.tax_number = None
        data.address_line1 = "456 Oak Ave"
        data.address_line2 = None
        data.city = "Johannesburg"
        data.state = "Gauteng"
        data.postal_code = "2000"
        data.country = "South Africa"
        data.notes = None
        data.tags = ["new"]

        result = svc.create_customer(BIZ, data)

        MockCustomer.assert_called_once_with(
            business_id=BIZ,
            customer_type=CustomerType.INDIVIDUAL,
            first_name="Jane",
            last_name="Smith",
            email="jane@example.com",
            phone="+27111111111",
            company_name=None,
            tax_number=None,
            address_line1="456 Oak Ave",
            address_line2=None,
            city="Johannesburg",
            state="Gauteng",
            postal_code="2000",
            country="South Africa",
            notes=None,
            tags=["new"],
        )
        db.add.assert_called_once_with(fake_customer)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(fake_customer)
        assert result is fake_customer

    @patch("app.services.customer_service.Customer")
    def test_create_tags_default_empty(self, MockCustomer):
        svc, db = _svc()
        fake_customer = MagicMock()
        MockCustomer.return_value = fake_customer
        data = MagicMock(spec=CustomerCreate)
        data.customer_type = CustomerType.INDIVIDUAL
        data.first_name = "No"
        data.last_name = "Tags"
        data.email = None
        data.phone = None
        data.company_name = None
        data.tax_number = None
        data.address_line1 = None
        data.address_line2 = None
        data.city = None
        data.state = None
        data.postal_code = None
        data.country = None
        data.notes = None
        data.tags = None  # None should become []

        svc.create_customer(BIZ, data)

        call_kwargs = MockCustomer.call_args[1]
        assert call_kwargs["tags"] == []

    @patch("app.services.customer_service.Customer")
    def test_create_business_customer(self, MockCustomer):
        svc, db = _svc()
        fake_customer = MagicMock()
        MockCustomer.return_value = fake_customer
        data = MagicMock(spec=CustomerCreate)
        data.customer_type = CustomerType.BUSINESS
        data.first_name = "Bob"
        data.last_name = "Builder"
        data.email = "bob@acme.com"
        data.phone = "+27222222222"
        data.company_name = "Acme Corp"
        data.tax_number = "VAT123456"
        data.address_line1 = "789 Industrial Rd"
        data.address_line2 = "Unit 5"
        data.city = "Durban"
        data.state = "KwaZulu-Natal"
        data.postal_code = "4001"
        data.country = "South Africa"
        data.notes = "Important client"
        data.tags = ["wholesale", "priority"]

        svc.create_customer(BIZ, data)

        call_kwargs = MockCustomer.call_args[1]
        assert call_kwargs["customer_type"] == CustomerType.BUSINESS
        assert call_kwargs["company_name"] == "Acme Corp"
        assert call_kwargs["tax_number"] == "VAT123456"
        assert call_kwargs["tags"] == ["wholesale", "priority"]


# ══════════════════════════════════════════════════════════════════════════════
# update_customer
# ══════════════════════════════════════════════════════════════════════════════


class TestUpdateCustomer:
    def test_update_partial_fields(self):
        svc, db = _svc()
        customer = _mock_customer()
        data = MagicMock(spec=CustomerUpdate)
        data.model_dump.return_value = {"first_name": "Updated", "city": "Pretoria"}

        result = svc.update_customer(customer, data)

        data.model_dump.assert_called_once_with(exclude_unset=True)
        assert customer.first_name == "Updated"
        assert customer.city == "Pretoria"
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(customer)
        assert result is customer

    def test_update_single_field(self):
        svc, db = _svc()
        customer = _mock_customer()
        data = MagicMock(spec=CustomerUpdate)
        data.model_dump.return_value = {"email": "new@example.com"}

        svc.update_customer(customer, data)

        assert customer.email == "new@example.com"
        db.commit.assert_called_once()

    def test_update_no_fields(self):
        svc, db = _svc()
        customer = _mock_customer(first_name="Original")
        data = MagicMock(spec=CustomerUpdate)
        data.model_dump.return_value = {}

        result = svc.update_customer(customer, data)

        # commit + refresh should still be called even with no changes
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(customer)
        assert result is customer

    def test_update_customer_type(self):
        svc, db = _svc()
        customer = _mock_customer(customer_type=CustomerType.INDIVIDUAL)
        data = MagicMock(spec=CustomerUpdate)
        data.model_dump.return_value = {
            "customer_type": CustomerType.BUSINESS,
            "company_name": "New Co",
        }

        svc.update_customer(customer, data)

        assert customer.customer_type == CustomerType.BUSINESS
        assert customer.company_name == "New Co"

    def test_update_tags(self):
        svc, db = _svc()
        customer = _mock_customer(tags=["old"])
        data = MagicMock(spec=CustomerUpdate)
        data.model_dump.return_value = {"tags": ["vip", "wholesale"]}

        svc.update_customer(customer, data)

        assert customer.tags == ["vip", "wholesale"]


# ══════════════════════════════════════════════════════════════════════════════
# delete_customer (soft delete)
# ══════════════════════════════════════════════════════════════════════════════


class TestDeleteCustomer:
    def test_soft_delete(self):
        svc, db = _svc()
        customer = _mock_customer()

        svc.delete_customer(customer)

        customer.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_soft_delete_returns_none(self):
        svc, db = _svc()
        customer = _mock_customer()

        result = svc.delete_customer(customer)

        assert result is None


# ══════════════════════════════════════════════════════════════════════════════
# bulk_create_customers
# ══════════════════════════════════════════════════════════════════════════════


class TestBulkCreateCustomers:
    @patch("app.services.customer_service.Customer")
    def test_bulk_create_multiple(self, MockCustomer):
        svc, db = _svc()
        fake1, fake2 = MagicMock(), MagicMock()
        MockCustomer.side_effect = [fake1, fake2]

        d1 = MagicMock(spec=CustomerCreate)
        d1.customer_type = CustomerType.INDIVIDUAL
        d1.first_name = "Alice"
        d1.last_name = "A"
        d1.email = "alice@example.com"
        d1.phone = None
        d1.company_name = None
        d1.tax_number = None
        d1.address_line1 = None
        d1.address_line2 = None
        d1.city = None
        d1.state = None
        d1.postal_code = None
        d1.country = None
        d1.notes = None
        d1.tags = ["tag1"]

        d2 = MagicMock(spec=CustomerCreate)
        d2.customer_type = CustomerType.BUSINESS
        d2.first_name = "Bob"
        d2.last_name = "B"
        d2.email = "bob@example.com"
        d2.phone = None
        d2.company_name = "Bob LLC"
        d2.tax_number = None
        d2.address_line1 = None
        d2.address_line2 = None
        d2.city = None
        d2.state = None
        d2.postal_code = None
        d2.country = None
        d2.notes = None
        d2.tags = None  # should become []

        result = svc.bulk_create_customers(BIZ, [d1, d2])

        assert len(result) == 2
        db.add_all.assert_called_once_with([fake1, fake2])
        db.commit.assert_called_once()
        assert db.refresh.call_count == 2

    @patch("app.services.customer_service.Customer")
    def test_bulk_create_empty_list(self, MockCustomer):
        svc, db = _svc()

        result = svc.bulk_create_customers(BIZ, [])

        assert result == []
        db.add_all.assert_called_once_with([])
        db.commit.assert_called_once()

    @patch("app.services.customer_service.Customer")
    def test_bulk_create_single(self, MockCustomer):
        svc, db = _svc()
        fake = MagicMock()
        MockCustomer.return_value = fake

        d = MagicMock(spec=CustomerCreate)
        d.customer_type = CustomerType.INDIVIDUAL
        d.first_name = "Solo"
        d.last_name = "Person"
        d.email = "solo@example.com"
        d.phone = None
        d.company_name = None
        d.tax_number = None
        d.address_line1 = None
        d.address_line2 = None
        d.city = None
        d.state = None
        d.postal_code = None
        d.country = None
        d.notes = None
        d.tags = []

        result = svc.bulk_create_customers(BIZ, [d])

        assert len(result) == 1
        db.add_all.assert_called_once()
        db.refresh.assert_called_once_with(fake)


# ══════════════════════════════════════════════════════════════════════════════
# bulk_delete_customers
# ══════════════════════════════════════════════════════════════════════════════


class TestBulkDeleteCustomers:
    @patch("app.models.base.utc_now")
    def test_bulk_delete_returns_count(self, mock_utc_now):
        svc, db = _svc()
        ids = [str(uuid.uuid4()) for _ in range(3)]
        chain = _chain(count=3)
        db.query.return_value = chain

        result = svc.bulk_delete_customers(BIZ, ids)

        assert result == 3
        db.query.assert_called_once_with(Customer)
        chain.filter.assert_called_once()
        chain.update.assert_called_once()
        db.commit.assert_called_once()

    @patch("app.models.base.utc_now")
    def test_bulk_delete_none_matched(self, mock_utc_now):
        svc, db = _svc()
        ids = [str(uuid.uuid4())]
        chain = _chain(count=0)
        db.query.return_value = chain

        result = svc.bulk_delete_customers(BIZ, ids)

        assert result == 0
        db.commit.assert_called_once()

    @patch("app.models.base.utc_now")
    def test_bulk_delete_partial_match(self, mock_utc_now):
        svc, db = _svc()
        ids = [str(uuid.uuid4()) for _ in range(5)]
        chain = _chain(count=2)  # only 2 of 5 existed
        db.query.return_value = chain

        result = svc.bulk_delete_customers(BIZ, ids)

        assert result == 2

    @patch("app.models.base.utc_now")
    def test_bulk_delete_empty_list(self, mock_utc_now):
        svc, db = _svc()
        chain = _chain(count=0)
        db.query.return_value = chain

        result = svc.bulk_delete_customers(BIZ, [])

        assert result == 0


# ══════════════════════════════════════════════════════════════════════════════
# update_customer_metrics
# ══════════════════════════════════════════════════════════════════════════════


class TestUpdateCustomerMetrics:
    def test_first_order(self):
        svc, db = _svc()
        customer = _mock_customer(
            total_orders=0,
            total_spent=Decimal("0"),
            average_order_value=Decimal("0"),
        )

        svc.update_customer_metrics(customer, Decimal("250.00"))

        assert customer.total_orders == 1
        assert customer.total_spent == Decimal("250.00")
        assert customer.average_order_value == Decimal("250.00")
        db.commit.assert_called_once()

    def test_subsequent_order(self):
        """total_orders=5, total_spent=500. Add 100 → 6 orders, 600 spent, avg=100."""
        svc, db = _svc()
        customer = _mock_customer(
            total_orders=5,
            total_spent=Decimal("500.00"),
            average_order_value=Decimal("100.00"),
        )

        svc.update_customer_metrics(customer, Decimal("100.00"))

        assert customer.total_orders == 6
        assert customer.total_spent == Decimal("600.00")
        assert customer.average_order_value == Decimal("100.00")
        db.commit.assert_called_once()

    def test_average_recalculation(self):
        """total_orders=2, total_spent=200. Add 400 → 3 orders, 600 spent, avg=200."""
        svc, db = _svc()
        customer = _mock_customer(
            total_orders=2,
            total_spent=Decimal("200.00"),
            average_order_value=Decimal("100.00"),
        )

        svc.update_customer_metrics(customer, Decimal("400.00"))

        assert customer.total_orders == 3
        assert customer.total_spent == Decimal("600.00")
        assert customer.average_order_value == Decimal("200.00")

    def test_small_order(self):
        svc, db = _svc()
        customer = _mock_customer(
            total_orders=9,
            total_spent=Decimal("900.00"),
            average_order_value=Decimal("100.00"),
        )

        svc.update_customer_metrics(customer, Decimal("50.00"))

        assert customer.total_orders == 10
        assert customer.total_spent == Decimal("950.00")
        assert customer.average_order_value == Decimal("95.00")

    def test_large_order(self):
        svc, db = _svc()
        customer = _mock_customer(
            total_orders=0,
            total_spent=Decimal("0"),
            average_order_value=Decimal("0"),
        )

        svc.update_customer_metrics(customer, Decimal("10000.00"))

        assert customer.total_orders == 1
        assert customer.total_spent == Decimal("10000.00")
        assert customer.average_order_value == Decimal("10000.00")


# ══════════════════════════════════════════════════════════════════════════════
# get_top_customers
# ══════════════════════════════════════════════════════════════════════════════


class TestGetTopCustomers:
    def test_returns_limited_results(self):
        svc, db = _svc()
        rows = [_mock_customer(total_spent=Decimal(str(i * 100))) for i in range(5)]
        chain = _chain(rows=rows)
        db.query.return_value = chain

        result = svc.get_top_customers(BIZ, limit=5)

        assert result == rows
        assert len(result) == 5
        chain.limit.assert_called_once_with(5)
        chain.order_by.assert_called_once()

    def test_default_limit_ten(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.get_top_customers(BIZ)

        chain.limit.assert_called_once_with(10)

    def test_empty_results(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        result = svc.get_top_customers(BIZ)

        assert result == []

    def test_custom_limit(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.get_top_customers(BIZ, limit=3)

        chain.limit.assert_called_once_with(3)

    def test_queries_correct_model(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.get_top_customers(BIZ)

        db.query.assert_called_once_with(Customer)
