"""Unit tests for Invoice API endpoints."""

from decimal import Decimal
from datetime import date, datetime


class TestInvoiceSchemas:
    """Tests for invoice schema validation."""

    def test_invoice_status_enum(self):
        """Test InvoiceStatus enum values."""
        from app.models.invoice import InvoiceStatus
        
        assert InvoiceStatus.DRAFT.value == "draft"
        assert InvoiceStatus.SENT.value == "sent"
        assert InvoiceStatus.VIEWED.value == "viewed"
        assert InvoiceStatus.PAID.value == "paid"
        assert InvoiceStatus.PARTIAL.value == "partial"
        assert InvoiceStatus.OVERDUE.value == "overdue"
        assert InvoiceStatus.CANCELLED.value == "cancelled"

    def test_invoice_item_create_schema(self):
        """Test InvoiceItemCreate schema."""
        from app.schemas.invoice import InvoiceItemCreate
        
        data = InvoiceItemCreate(
            description="Consulting Services",
            unit_price=Decimal("150.00"),
            quantity=Decimal("8"),
            tax_rate=Decimal("15.0"),
        )
        
        assert data.description == "Consulting Services"
        assert data.unit_price == Decimal("150.00")
        assert data.quantity == Decimal("8")

    def test_invoice_create_schema(self):
        """Test InvoiceCreate schema."""
        from app.schemas.invoice import InvoiceCreate, InvoiceItemCreate
        from app.models.invoice import InvoiceStatus
        
        items = [
            InvoiceItemCreate(description="Service 1", unit_price=Decimal("100.00")),
            InvoiceItemCreate(description="Service 2", unit_price=Decimal("200.00"), quantity=Decimal("2")),
        ]
        
        data = InvoiceCreate(
            status=InvoiceStatus.DRAFT,
            notes="Test invoice",
            items=items,
        )
        
        assert len(data.items) == 2
        assert data.status == InvoiceStatus.DRAFT

    def test_invoice_update_schema(self):
        """Test InvoiceUpdate schema for partial updates."""
        from app.schemas.invoice import InvoiceUpdate
        from app.models.invoice import InvoiceStatus
        
        data = InvoiceUpdate(status=InvoiceStatus.SENT)
        
        assert data.status == InvoiceStatus.SENT
        assert data.notes is None

    def test_payment_record_schema(self):
        """Test PaymentRecord schema."""
        from app.schemas.invoice import PaymentRecord
        
        data = PaymentRecord(
            amount=Decimal("500.00"),
            payment_method="bank_transfer",
            reference="REF123",
        )
        
        assert data.amount == Decimal("500.00")
        assert data.payment_method == "bank_transfer"


class TestInvoiceModel:
    """Tests for Invoice model."""

    def test_invoice_balance_due(self):
        """Test balance_due property."""
        from app.models.invoice import Invoice
        
        invoice = Invoice(
            total=Decimal("1000.00"),
            amount_paid=Decimal("300.00"),
        )
        
        assert invoice.balance_due == 700.0

    def test_invoice_is_paid_false(self):
        """Test is_paid when not fully paid."""
        from app.models.invoice import Invoice
        
        invoice = Invoice(
            total=Decimal("1000.00"),
            amount_paid=Decimal("500.00"),
        )
        
        assert invoice.is_paid is False

    def test_invoice_is_paid_true(self):
        """Test is_paid when fully paid."""
        from app.models.invoice import Invoice
        
        invoice = Invoice(
            total=Decimal("1000.00"),
            amount_paid=Decimal("1000.00"),
        )
        
        assert invoice.is_paid is True

    def test_invoice_is_overdue_false_no_due_date(self):
        """Test is_overdue with no due date."""
        from app.models.invoice import Invoice
        
        invoice = Invoice(
            total=Decimal("1000.00"),
            amount_paid=Decimal("0"),
            due_date=None,
        )
        
        assert invoice.is_overdue is False

    def test_invoice_is_overdue_false_paid(self):
        """Test is_overdue when paid."""
        from app.models.invoice import Invoice
        from datetime import date, timedelta
        
        invoice = Invoice(
            total=Decimal("1000.00"),
            amount_paid=Decimal("1000.00"),
            due_date=date.today() - timedelta(days=30),
        )
        
        assert invoice.is_overdue is False


class TestInvoiceItemModel:
    """Tests for InvoiceItem model."""

    def test_invoice_item_line_total(self):
        """Test line_total property."""
        from app.models.invoice import InvoiceItem
        
        item = InvoiceItem(
            unit_price=Decimal("100.00"),
            quantity=Decimal("5"),
            discount_amount=Decimal("50.00"),
        )
        
        assert item.line_total == 450.0  # 100 * 5 - 50


class TestInvoiceService:
    """Tests for InvoiceService business logic."""

    def test_invoice_service_init(self):
        """Test InvoiceService initialization."""
        from app.services.invoice_service import InvoiceService
        from unittest.mock import MagicMock
        
        mock_db = MagicMock()
        service = InvoiceService(mock_db)
        
        assert service.db == mock_db

    def test_generate_invoice_number_format(self):
        """Test invoice number format."""
        from app.services.invoice_service import InvoiceService
        from unittest.mock import MagicMock
        
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.count.return_value = 0
        
        service = InvoiceService(mock_db)
        invoice_number = service.generate_invoice_number("test-business-id")
        
        # Should be INV-YYYYMMDD-XXXXX format
        assert invoice_number.startswith("INV-")
        parts = invoice_number.split("-")
        assert len(parts) == 3
        assert len(parts[1]) == 8  # YYYYMMDD


class TestInvoiceAPI:
    """Tests for Invoice API endpoints."""

    def test_invoice_router_exists(self):
        """Test that invoice router is properly configured."""
        from app.api.invoices import router
        
        assert router.prefix == "/invoices"
        assert "Invoices" in router.tags

    def test_invoice_endpoints_exist(self):
        """Test that all required endpoints exist."""
        from app.api.invoices import router
        
        routes = [route.path for route in router.routes]
        
        assert "/invoices" in routes  # list/create
        assert "/invoices/{invoice_id}" in routes  # get/update/delete
        assert "/invoices/stats" in routes  # stats
        assert "/invoices/{invoice_id}/send" in routes  # send
        assert "/invoices/{invoice_id}/payment" in routes  # payment
        assert "/invoices/{invoice_id}/items" in routes  # items
        assert "/invoices/{invoice_id}/pdf" in routes  # pdf


class TestInvoiceSummary:
    """Tests for invoice summary functionality."""

    def test_invoice_summary_schema(self):
        """Test InvoiceSummary schema."""
        from app.schemas.invoice import InvoiceSummary
        
        summary = InvoiceSummary(
            total_invoices=50,
            total_amount=Decimal("100000.00"),
            total_paid=Decimal("75000.00"),
            total_outstanding=Decimal("25000.00"),
            overdue_count=5,
            overdue_amount=Decimal("10000.00"),
        )
        
        assert summary.total_invoices == 50
        assert summary.total_outstanding == Decimal("25000.00")
        assert summary.overdue_count == 5


class TestInvoiceListResponse:
    """Tests for invoice list response."""

    def test_invoice_list_response_schema(self):
        """Test InvoiceListResponse schema."""
        from app.schemas.invoice import InvoiceListResponse, InvoiceResponse
        from app.models.invoice import InvoiceStatus
        
        item = InvoiceResponse(
            id="123",
            business_id="456",
            invoice_number="INV-20241212-00001",
            status=InvoiceStatus.DRAFT,
            issue_date=date.today(),
            due_date=None,
            billing_address=None,
            notes=None,
            terms=None,
            footer=None,
            subtotal=Decimal("1000.00"),
            tax_amount=Decimal("150.00"),
            discount_amount=Decimal("0"),
            total=Decimal("1150.00"),
            amount_paid=Decimal("0"),
            balance_due=1150.0,
            is_paid=False,
            is_overdue=False,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            items=[],
        )
        
        response = InvoiceListResponse(
            items=[item],
            total=1,
            page=1,
            per_page=20,
            pages=1,
        )
        
        assert len(response.items) == 1
        assert response.total == 1
