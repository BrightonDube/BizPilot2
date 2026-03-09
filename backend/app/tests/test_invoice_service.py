"""Unit tests for InvoiceService.

Covers invoice CRUD, payment recording, send/delete,
item calculations, filtering, pagination, and statistics.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")

import uuid
from datetime import date, datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.models.invoice import Invoice, InvoiceItem, InvoiceStatus
from app.schemas.invoice import (
    AddressSchema,
    InvoiceCreate,
    InvoiceItemCreate,
    InvoiceUpdate,
)
from app.services.invoice_service import InvoiceService


BIZ_ID = str(uuid.uuid4())
INVOICE_ID = str(uuid.uuid4())
CUSTOMER_ID = str(uuid.uuid4())
ORDER_ID = str(uuid.uuid4())


def _chain(first=None, rows=None, count=0, scalar=None):
    """Reusable mock that supports the common SQLAlchemy chained-call pattern."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.notin_.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = scalar
    return c


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def svc(db):
    return InvoiceService(db)


# ── generate_invoice_number ──────────────────────────────────────


class TestGenerateInvoiceNumber:
    def test_first_invoice_number(self, svc, db):
        db.query.return_value = _chain(count=0)
        result = svc.generate_invoice_number(BIZ_ID)
        today = datetime.now().strftime("%Y%m%d")
        assert result == f"INV-{today}-00001"

    def test_increments_sequence(self, svc, db):
        db.query.return_value = _chain(count=42)
        result = svc.generate_invoice_number(BIZ_ID)
        today = datetime.now().strftime("%Y%m%d")
        assert result == f"INV-{today}-00043"


# ── get_invoices ─────────────────────────────────────────────────


class TestGetInvoices:
    def test_returns_invoices_and_total(self, svc, db):
        inv1, inv2 = MagicMock(spec=Invoice), MagicMock(spec=Invoice)
        db.query.return_value = _chain(rows=[inv1, inv2], count=2)
        invoices, total = svc.get_invoices(BIZ_ID)
        assert invoices == [inv1, inv2]
        assert total == 2

    def test_empty_result(self, svc, db):
        db.query.return_value = _chain(rows=[], count=0)
        invoices, total = svc.get_invoices(BIZ_ID)
        assert invoices == []
        assert total == 0

    def test_pagination_offset(self, svc, db):
        chain = _chain(rows=[], count=50)
        db.query.return_value = chain
        svc.get_invoices(BIZ_ID, page=3, per_page=10)
        chain.offset.assert_called_with(20)
        chain.limit.assert_called_with(10)

    def test_search_filter(self, svc, db):
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.get_invoices(BIZ_ID, search="INV-2024")
        assert chain.filter.call_count >= 2  # base filter + search filter

    def test_customer_filter(self, svc, db):
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.get_invoices(BIZ_ID, customer_id=CUSTOMER_ID)
        assert chain.filter.call_count >= 2

    def test_status_filter(self, svc, db):
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.get_invoices(BIZ_ID, status=InvoiceStatus.PAID)
        assert chain.filter.call_count >= 2

    def test_date_range_filter(self, svc, db):
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.get_invoices(BIZ_ID, date_from=date(2024, 1, 1), date_to=date(2024, 12, 31))
        assert chain.filter.call_count >= 3  # base + date_from + date_to

    def test_overdue_only_filter(self, svc, db):
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.get_invoices(BIZ_ID, overdue_only=True)
        assert chain.filter.call_count >= 2

    def test_sort_ascending(self, svc, db):
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.get_invoices(BIZ_ID, sort_order="asc")
        chain.order_by.assert_called_once()


# ── get_invoice ──────────────────────────────────────────────────


class TestGetInvoice:
    def test_returns_invoice(self, svc, db):
        inv = MagicMock(spec=Invoice)
        db.query.return_value = _chain(first=inv)
        result = svc.get_invoice(INVOICE_ID, BIZ_ID)
        assert result is inv

    def test_returns_none_when_missing(self, svc, db):
        db.query.return_value = _chain(first=None)
        assert svc.get_invoice(INVOICE_ID, BIZ_ID) is None


# ── get_invoice_by_number ────────────────────────────────────────


class TestGetInvoiceByNumber:
    def test_returns_invoice(self, svc, db):
        inv = MagicMock(spec=Invoice)
        db.query.return_value = _chain(first=inv)
        result = svc.get_invoice_by_number("INV-20240101-00001", BIZ_ID)
        assert result is inv

    def test_returns_none_when_missing(self, svc, db):
        db.query.return_value = _chain(first=None)
        assert svc.get_invoice_by_number("NOPE", BIZ_ID) is None


# ── create_invoice ───────────────────────────────────────────────


class TestCreateInvoice:
    def _make_item_data(self, **kwargs):
        defaults = {
            "description": "Widget",
            "quantity": Decimal("2"),
            "unit_price": Decimal("100"),
            "tax_rate": Decimal("15"),
            "discount_percent": Decimal("10"),
        }
        defaults.update(kwargs)
        return InvoiceItemCreate(**defaults)

    def test_creates_invoice_with_items(self, svc, db):
        item_data = self._make_item_data()
        data = InvoiceCreate(
            customer_id=CUSTOMER_ID,
            issue_date=date(2024, 6, 1),
            due_date=date(2024, 7, 1),
            notes="Test",
            items=[item_data],
        )

        # Query calls: generate_invoice_number (count), _calculate_invoice_totals (items)
        call_counter = {"n": 0}

        mock_item = MagicMock(spec=InvoiceItem)
        mock_item.unit_price = Decimal("100")
        mock_item.quantity = Decimal("2")
        mock_item.tax_amount = Decimal("27")  # (200-20)*15% = 27
        mock_item.discount_amount = Decimal("20")  # 200*10% = 20

        chains = [
            _chain(count=0),                # generate_invoice_number
            _chain(rows=[mock_item]),        # _calculate_invoice_totals
        ]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[min(idx, len(chains) - 1)]

        db.query.side_effect = query_side_effect

        result = svc.create_invoice(BIZ_ID, data)
        # Invoice added + 1 item added = 2 add calls
        assert db.add.call_count == 2
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_creates_invoice_with_no_items(self, svc, db):
        data = InvoiceCreate(
            customer_id=CUSTOMER_ID,
            issue_date=date(2024, 6, 1),
            items=[],
        )

        call_counter = {"n": 0}
        chains = [
            _chain(count=5),          # generate_invoice_number
            _chain(rows=[]),           # _calculate_invoice_totals (no items)
        ]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[min(idx, len(chains) - 1)]

        db.query.side_effect = query_side_effect

        result = svc.create_invoice(BIZ_ID, data)
        # Only the invoice itself is added (no items)
        assert db.add.call_count == 1
        db.commit.assert_called_once()

    def test_creates_invoice_with_billing_address(self, svc, db):
        addr = AddressSchema(line1="123 Main St", city="Cape Town", country="ZA")
        data = InvoiceCreate(
            customer_id=CUSTOMER_ID,
            billing_address=addr,
            items=[],
        )

        call_counter = {"n": 0}
        chains = [_chain(count=0), _chain(rows=[])]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[min(idx, len(chains) - 1)]

        db.query.side_effect = query_side_effect

        result = svc.create_invoice(BIZ_ID, data)
        added_invoice = db.add.call_args_list[0][0][0]
        assert isinstance(added_invoice, Invoice)
        assert added_invoice.billing_address == addr.model_dump()

    def test_item_calculation_accuracy(self, svc, db):
        """Verify _create_invoice_item calculates correctly."""
        item_data = self._make_item_data(
            quantity=Decimal("3"),
            unit_price=Decimal("200"),
            tax_rate=Decimal("15"),
            discount_percent=Decimal("10"),
        )
        data = InvoiceCreate(customer_id=CUSTOMER_ID, items=[item_data])

        call_counter = {"n": 0}
        chains = [_chain(count=0), _chain(rows=[])]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[min(idx, len(chains) - 1)]

        db.query.side_effect = query_side_effect

        svc.create_invoice(BIZ_ID, data)

        # The second db.add call is the InvoiceItem
        item_added = db.add.call_args_list[1][0][0]
        assert isinstance(item_added, InvoiceItem)
        # line_total = 200 * 3 = 600
        # discount = 600 * 10% = 60
        # taxable = 600 - 60 = 540
        # tax = 540 * 15% = 81
        # total = 540 + 81 = 621
        assert item_added.discount_amount == Decimal("60")
        assert item_added.tax_amount == Decimal("81")
        assert item_added.total == Decimal("621")


# ── update_invoice ───────────────────────────────────────────────


class TestUpdateInvoice:
    def test_updates_fields(self, svc, db):
        invoice = MagicMock(spec=Invoice)
        invoice.discount_amount = Decimal("0")
        data = InvoiceUpdate(notes="Updated notes", terms="Net 30")

        db.query.return_value = _chain(rows=[])  # _calculate_invoice_totals

        result = svc.update_invoice(invoice, data)
        assert invoice.notes == "Updated notes"
        assert invoice.terms == "Net 30"
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(invoice)

    def test_updates_billing_address(self, svc, db):
        invoice = MagicMock(spec=Invoice)
        invoice.discount_amount = Decimal("0")
        addr = AddressSchema(line1="456 New St", city="Joburg")
        data = InvoiceUpdate(billing_address=addr)

        db.query.return_value = _chain(rows=[])

        svc.update_invoice(invoice, data)
        # model_dump(exclude_unset=True) only includes fields explicitly set
        assert invoice.billing_address == {"line1": "456 New St", "city": "Joburg"}

    def test_recalculates_totals(self, svc, db):
        invoice = MagicMock(spec=Invoice)
        invoice.discount_amount = Decimal("0")

        mock_item = MagicMock(spec=InvoiceItem)
        mock_item.unit_price = Decimal("50")
        mock_item.quantity = Decimal("4")
        mock_item.tax_amount = Decimal("30")
        mock_item.discount_amount = Decimal("10")

        db.query.return_value = _chain(rows=[mock_item])
        data = InvoiceUpdate(notes="test")

        svc.update_invoice(invoice, data)
        # subtotal = 50 * 4 = 200
        assert invoice.subtotal == Decimal("200")
        assert invoice.tax_amount == Decimal("30")
        # total = 200 + 30 - 0 (invoice discount) - 10 (item discount) = 220
        assert invoice.total == Decimal("220")


# ── record_payment ───────────────────────────────────────────────


class TestRecordPayment:
    def test_partial_payment(self, svc, db):
        invoice = MagicMock(spec=Invoice)
        invoice.amount_paid = Decimal("0")
        invoice.total = Decimal("1000")

        result = svc.record_payment(invoice, Decimal("300"), "card")
        assert invoice.amount_paid == Decimal("300")
        assert invoice.status == InvoiceStatus.PARTIAL
        db.commit.assert_called_once()

    def test_full_payment(self, svc, db):
        invoice = MagicMock(spec=Invoice)
        invoice.amount_paid = Decimal("500")
        invoice.total = Decimal("1000")

        result = svc.record_payment(invoice, Decimal("500"), "cash")
        assert invoice.amount_paid == Decimal("1000")
        assert invoice.status == InvoiceStatus.PAID
        assert invoice.paid_date == date.today()
        db.commit.assert_called_once()

    def test_overpayment_marks_paid(self, svc, db):
        invoice = MagicMock(spec=Invoice)
        invoice.amount_paid = Decimal("900")
        invoice.total = Decimal("1000")

        svc.record_payment(invoice, Decimal("200"), "eft")
        assert invoice.amount_paid == Decimal("1100")
        assert invoice.status == InvoiceStatus.PAID


# ── send_invoice ─────────────────────────────────────────────────


class TestSendInvoice:
    def test_marks_as_sent(self, svc, db):
        invoice = MagicMock(spec=Invoice)
        result = svc.send_invoice(invoice)
        assert invoice.status == InvoiceStatus.SENT
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(invoice)
        assert result is invoice


# ── delete_invoice ───────────────────────────────────────────────


class TestDeleteInvoice:
    def test_soft_deletes(self, svc, db):
        invoice = MagicMock(spec=Invoice)
        svc.delete_invoice(invoice)
        invoice.soft_delete.assert_called_once()
        db.commit.assert_called_once()


# ── get_invoice_items ────────────────────────────────────────────


class TestGetInvoiceItems:
    def test_returns_items(self, svc, db):
        items = [MagicMock(spec=InvoiceItem), MagicMock(spec=InvoiceItem)]
        db.query.return_value = _chain(rows=items)
        result = svc.get_invoice_items(INVOICE_ID)
        assert result == items

    def test_returns_empty_list(self, svc, db):
        db.query.return_value = _chain(rows=[])
        result = svc.get_invoice_items(INVOICE_ID)
        assert result == []


# ── get_invoice_stats ────────────────────────────────────────────


class TestGetInvoiceStats:
    def test_returns_stats(self, svc, db):
        # Calls:
        # 1. db.query(Invoice).filter(...) -> invoices query (count + overdue filter)
        # 2. db.query(func.sum(Invoice.total)).filter(...).scalar() -> total_amount
        # 3. db.query(func.sum(Invoice.amount_paid)).filter(...).scalar() -> total_paid
        # 4. invoices.filter(...) -> overdue query (count)
        # 5. db.query(func.sum(...)).filter(...).scalar() -> overdue_amount

        invoices_chain = MagicMock()
        invoices_chain.filter.return_value = invoices_chain
        invoices_chain.count.return_value = 10

        overdue_chain = MagicMock()
        overdue_chain.filter.return_value = overdue_chain
        overdue_chain.count.return_value = 3
        # The first .filter() on invoices_chain returns overdue_chain for overdue
        # We need invoices_chain.filter() to return itself for the base,
        # but return overdue_chain for the overdue filter.
        # Since both use .filter(), we can use side_effect on count.

        # Simpler approach: make the base chain return count=10,
        # and its .filter() to return a chain with count=3
        base_chain = MagicMock()
        base_chain.filter.return_value = base_chain
        base_chain.count.return_value = 10

        overdue_sub = MagicMock()
        overdue_sub.count.return_value = 3

        count_tracker = {"n": 0}
        original_count = base_chain.count

        def count_side_effect():
            idx = count_tracker["n"]
            count_tracker["n"] += 1
            if idx == 0:
                return 10  # total_invoices
            return 3  # overdue_count

        base_chain.count.side_effect = count_side_effect

        call_counter = {"n": 0}
        chains = [
            base_chain,                     # db.query(Invoice) for base invoices
            _chain(scalar=Decimal("5000")), # func.sum(Invoice.total)
            _chain(scalar=Decimal("3000")), # func.sum(Invoice.amount_paid)
            _chain(scalar=Decimal("800")),  # func.sum(overdue amount)
        ]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[min(idx, len(chains) - 1)]

        db.query.side_effect = query_side_effect

        result = svc.get_invoice_stats(BIZ_ID)
        assert result["total_invoices"] == 10
        assert result["total_amount"] == Decimal("5000")
        assert result["total_paid"] == Decimal("3000")
        assert result["total_outstanding"] == Decimal("2000")
        assert result["overdue_count"] == 3
        assert result["overdue_amount"] == Decimal("800")

    def test_stats_with_zero_values(self, svc, db):
        base_chain = MagicMock()
        base_chain.filter.return_value = base_chain
        base_chain.count.return_value = 0

        call_counter = {"n": 0}
        chains = [
            base_chain,            # db.query(Invoice)
            _chain(scalar=None),   # total_amount -> falls back to 0
            _chain(scalar=None),   # total_paid -> falls back to 0
            _chain(scalar=None),   # overdue_amount -> falls back to 0
        ]

        def query_side_effect(model):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[min(idx, len(chains) - 1)]

        db.query.side_effect = query_side_effect

        result = svc.get_invoice_stats(BIZ_ID)
        assert result["total_invoices"] == 0
        assert result["total_amount"] == Decimal("0")
        assert result["total_paid"] == Decimal("0")
        assert result["total_outstanding"] == Decimal("0")
        assert result["overdue_count"] == 0
        assert result["overdue_amount"] == Decimal("0")
