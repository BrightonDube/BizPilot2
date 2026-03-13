"""Unit tests for proforma invoice services.

Tests the ProformaService (CRUD, approval, conversion, audit)
and ProformaReportService (analytics, aging, lost quotes).
"""

import os
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key")


# ── Helpers ───────────────────────────────────────────────────────────


def _make_quote(**overrides):
    """Build a minimal ProformaInvoice-like mock."""
    q = MagicMock()
    q.id = overrides.get("id", uuid.uuid4())
    q.business_id = overrides.get("business_id", uuid.uuid4())
    q.customer_id = overrides.get("customer_id", None)
    q.quote_number = overrides.get("quote_number", "QT-20260301-0001")
    q.status = overrides.get("status", MagicMock(value="draft"))
    q.issue_date = overrides.get("issue_date", date.today())
    q.expiry_date = overrides.get("expiry_date", date.today() + timedelta(days=30))
    q.validity_days = overrides.get("validity_days", 30)
    q.subtotal = overrides.get("subtotal", Decimal("100.00"))
    q.tax_amount = overrides.get("tax_amount", Decimal("15.00"))
    q.discount_amount = overrides.get("discount_amount", Decimal("0"))
    q.discount_pct = overrides.get("discount_pct", Decimal("0"))
    q.total = overrides.get("total", Decimal("115.00"))
    q.notes = overrides.get("notes", None)
    q.terms = overrides.get("terms", None)
    q.approval_token = overrides.get("approval_token", None)
    q.approved_at = overrides.get("approved_at", None)
    q.approved_by_name = overrides.get("approved_by_name", None)
    q.rejection_reason = overrides.get("rejection_reason", None)
    q.rejected_at = overrides.get("rejected_at", None)
    q.viewed_at = overrides.get("viewed_at", None)
    q.cancellation_reason = overrides.get("cancellation_reason", None)
    q.cancelled_at = overrides.get("cancelled_at", None)
    q.converted_invoice_id = overrides.get("converted_invoice_id", None)
    q.converted_at = overrides.get("converted_at", None)
    q.created_by = overrides.get("created_by", None)
    q.created_at = overrides.get("created_at", datetime.now(timezone.utc))
    q.deleted_at = None
    q.items = overrides.get("items", [])
    q.generate_approval_token = MagicMock()
    return q


def _make_item(**overrides):
    """Build a minimal ProformaItem-like mock."""
    item = MagicMock()
    item.id = overrides.get("id", uuid.uuid4())
    item.proforma_id = overrides.get("proforma_id", uuid.uuid4())
    item.product_id = overrides.get("product_id", uuid.uuid4())
    item.description = overrides.get("description", "Test product")
    item.quantity = overrides.get("quantity", Decimal("2"))
    item.unit_price = overrides.get("unit_price", Decimal("50.00"))
    item.discount_pct = overrides.get("discount_pct", Decimal("0"))
    item.tax_rate = overrides.get("tax_rate", Decimal("15"))
    item.line_total = overrides.get("line_total", Decimal("115.00"))
    item.is_converted = overrides.get("is_converted", False)
    item.deleted_at = None
    return item


# ══════════════════════════════════════════════════════════════════════
# ProformaService Tests
# ══════════════════════════════════════════════════════════════════════


class TestProformaServiceCreate:
    """Tests for ProformaService.create_quote."""

    def test_create_quote_basic(self):
        from app.services.proforma_service import ProformaService

        db = MagicMock()
        db.query.return_value.filter.return_value.scalar.return_value = 0
        db.query.return_value.filter.return_value.all.return_value = []

        service = ProformaService(db)
        with patch.object(service, "_recalculate_totals"):
            quote = service.create_quote(
                business_id=str(uuid.uuid4()),
                notes="Test quote",
                validity_days=14,
            )

        db.add.assert_called()
        db.commit.assert_called_once()
        assert quote is not None

    def test_create_quote_with_items(self):
        from app.services.proforma_service import ProformaService

        db = MagicMock()
        db.query.return_value.filter.return_value.scalar.return_value = 0
        db.query.return_value.filter.return_value.all.return_value = []

        service = ProformaService(db)
        with patch.object(service, "_recalculate_totals"):
            service.create_quote(
                business_id=str(uuid.uuid4()),
                items=[
                    {"description": "Widget", "quantity": 2, "unit_price": 100},
                    {"description": "Gadget", "quantity": 1, "unit_price": 50},
                ],
            )

        # 1 quote + 2 items + audit = 4 adds
        assert db.add.call_count >= 3

    def test_create_quote_with_discount(self):
        from app.services.proforma_service import ProformaService

        db = MagicMock()
        db.query.return_value.filter.return_value.scalar.return_value = 0
        db.query.return_value.filter.return_value.all.return_value = []

        service = ProformaService(db)
        with patch.object(service, "_recalculate_totals"):
            quote = service.create_quote(
                business_id=str(uuid.uuid4()),
                discount_pct=Decimal("10"),
                created_by=str(uuid.uuid4()),
            )

        assert quote is not None


class TestProformaServiceCRUD:
    """Tests for get, list, update, duplicate operations."""

    def test_get_quote_found(self):
        from app.services.proforma_service import ProformaService

        mock_quote = _make_quote()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = mock_quote

        service = ProformaService(db)
        result = service.get_quote(str(mock_quote.id), str(mock_quote.business_id))
        assert result == mock_quote

    def test_get_quote_not_found(self):
        from app.services.proforma_service import ProformaService

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        service = ProformaService(db)
        result = service.get_quote(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result is None

    def test_get_quote_by_token(self):
        from app.services.proforma_service import ProformaService

        mock_quote = _make_quote(approval_token="abc123token")
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = mock_quote

        service = ProformaService(db)
        result = service.get_quote_by_token("abc123token")
        assert result == mock_quote

    def test_list_quotes_with_filters(self):
        from app.services.proforma_service import ProformaService

        db = MagicMock()
        q = db.query.return_value.filter.return_value
        q.filter.return_value = q
        q.count.return_value = 5
        q.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
            _make_quote() for _ in range(5)
        ]

        service = ProformaService(db)
        items, total = service.list_quotes(str(uuid.uuid4()), status="draft", page=1)
        assert total == 5
        assert len(items) == 5

    def test_list_quotes_with_search(self):
        from app.services.proforma_service import ProformaService

        db = MagicMock()
        q = db.query.return_value.filter.return_value
        q.filter.return_value = q
        q.count.return_value = 1
        q.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
            _make_quote(quote_number="QT-20260308-0001"),
        ]

        service = ProformaService(db)
        items, total = service.list_quotes(str(uuid.uuid4()), search="QT-2026")
        assert total == 1

    def test_update_draft_quote(self):
        from app.models.proforma import QuoteStatus
        from app.services.proforma_service import ProformaService

        mock_quote = _make_quote()
        mock_quote.status = QuoteStatus.DRAFT
        mock_quote.issue_date = date.today()
        mock_quote.validity_days = 30
        mock_quote.discount_pct = Decimal("0")
        mock_quote.notes = "old"

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = mock_quote
        db.query.return_value.filter.return_value.all.return_value = []

        service = ProformaService(db)
        result = service.update_quote(
            str(mock_quote.id), str(mock_quote.business_id),
            notes="updated notes",
        )
        assert result is not None
        db.commit.assert_called()

    def test_update_non_draft_raises(self):
        from app.models.proforma import QuoteStatus
        from app.services.proforma_service import ProformaService

        mock_quote = _make_quote()
        mock_quote.status = QuoteStatus.SENT

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = mock_quote

        service = ProformaService(db)
        with pytest.raises(ValueError, match="Only draft"):
            service.update_quote(str(mock_quote.id), str(mock_quote.business_id), notes="x")

    def test_duplicate_quote(self):
        from app.services.proforma_service import ProformaService

        item = _make_item()
        mock_quote = _make_quote(items=[item])

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = mock_quote
        db.query.return_value.filter.return_value.scalar.return_value = 0
        db.query.return_value.filter.return_value.all.return_value = []

        service = ProformaService(db)
        with patch.object(service, "_recalculate_totals"):
            with patch.object(service, "get_quote", return_value=mock_quote):
                new_quote = service.duplicate_quote(
                    str(mock_quote.id), str(mock_quote.business_id), str(uuid.uuid4()),
                )

        assert new_quote is not None
        db.commit.assert_called()

    def test_duplicate_not_found(self):
        from app.services.proforma_service import ProformaService

        db = MagicMock()
        service = ProformaService(db)
        with patch.object(service, "get_quote", return_value=None):
            with pytest.raises(ValueError, match="not found"):
                service.duplicate_quote(str(uuid.uuid4()), str(uuid.uuid4()))


class TestProformaServiceApproval:
    """Tests for approval workflow methods."""

    def test_send_quote_from_draft(self):
        from app.models.proforma import QuoteStatus
        from app.services.proforma_service import ProformaService

        mock_quote = _make_quote()
        mock_quote.status = QuoteStatus.DRAFT

        db = MagicMock()
        service = ProformaService(db)
        with patch.object(service, "get_quote", return_value=mock_quote):
            with patch.object(service, "update_status", return_value=mock_quote) as mock_us:
                result = service.send_quote(str(mock_quote.id), str(mock_quote.business_id))

        mock_us.assert_called_once()
        assert result == mock_quote

    def test_send_non_draft_raises(self):
        from app.models.proforma import QuoteStatus
        from app.services.proforma_service import ProformaService

        mock_quote = _make_quote()
        mock_quote.status = QuoteStatus.APPROVED

        db = MagicMock()
        service = ProformaService(db)
        with patch.object(service, "get_quote", return_value=mock_quote):
            with pytest.raises(ValueError, match="Cannot send"):
                service.send_quote(str(mock_quote.id), str(mock_quote.business_id))

    def test_approve_quote(self):
        from app.services.proforma_service import ProformaService

        mock_quote = _make_quote()
        db = MagicMock()
        service = ProformaService(db)
        with patch.object(service, "get_quote", return_value=mock_quote):
            result = service.approve_quote(
                str(mock_quote.id), str(mock_quote.business_id),
                customer_name="John Doe",
                signature_data="base64sig",
            )

        assert result is not None
        db.add.assert_called()  # Approval record added
        db.commit.assert_called()

    def test_approve_quote_not_found(self):
        from app.services.proforma_service import ProformaService

        db = MagicMock()
        service = ProformaService(db)
        with patch.object(service, "get_quote", return_value=None):
            result = service.approve_quote(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result is None

    def test_reject_quote(self):
        from app.services.proforma_service import ProformaService

        mock_quote = _make_quote()
        db = MagicMock()
        service = ProformaService(db)
        with patch.object(service, "get_quote", return_value=mock_quote):
            result = service.reject_quote(
                str(mock_quote.id), str(mock_quote.business_id),
                reason="Too expensive",
            )

        assert result.rejection_reason == "Too expensive"
        db.commit.assert_called()

    def test_cancel_quote(self):
        from app.models.proforma import QuoteStatus
        from app.services.proforma_service import ProformaService

        mock_quote = _make_quote()
        mock_quote.status = QuoteStatus.DRAFT

        db = MagicMock()
        service = ProformaService(db)
        with patch.object(service, "get_quote", return_value=mock_quote):
            with patch.object(service, "update_status", return_value=mock_quote):
                result = service.cancel_quote(
                    str(mock_quote.id), str(mock_quote.business_id), "No longer needed",
                )

        assert result.cancellation_reason == "No longer needed"

    def test_cancel_converted_raises(self):
        from app.models.proforma import QuoteStatus
        from app.services.proforma_service import ProformaService

        mock_quote = _make_quote()
        mock_quote.status = QuoteStatus.CONVERTED

        db = MagicMock()
        service = ProformaService(db)
        with patch.object(service, "get_quote", return_value=mock_quote):
            with pytest.raises(ValueError, match="Cannot cancel"):
                service.cancel_quote(str(mock_quote.id), str(mock_quote.business_id), "reason")

    def test_record_view(self):
        from app.models.proforma import QuoteStatus
        from app.services.proforma_service import ProformaService

        mock_quote = _make_quote()
        mock_quote.status = QuoteStatus.SENT
        mock_quote.viewed_at = None

        db = MagicMock()
        service = ProformaService(db)
        with patch.object(service, "get_quote_by_token", return_value=mock_quote):
            result = service.record_view("token123", ip_address="1.2.3.4")

        assert result.viewed_at is not None
        db.commit.assert_called()


class TestProformaServiceValidity:
    """Tests for validity extension."""

    def test_extend_validity(self):
        from app.services.proforma_service import ProformaService

        mock_quote = _make_quote(
            expiry_date=date.today() + timedelta(days=5),
            validity_days=30,
        )

        db = MagicMock()
        service = ProformaService(db)
        with patch.object(service, "get_quote", return_value=mock_quote):
            result = service.extend_validity(
                str(mock_quote.id), str(mock_quote.business_id), 15,
            )

        assert result.validity_days == 45
        db.commit.assert_called()

    def test_extend_reactivates_expired(self):
        from app.models.proforma import QuoteStatus
        from app.services.proforma_service import ProformaService

        mock_quote = _make_quote(
            status=QuoteStatus.EXPIRED,
            expiry_date=date.today() - timedelta(days=1),
            validity_days=30,
        )

        db = MagicMock()
        service = ProformaService(db)
        with patch.object(service, "get_quote", return_value=mock_quote):
            result = service.extend_validity(
                str(mock_quote.id), str(mock_quote.business_id), 30,
            )

        assert result.status == QuoteStatus.DRAFT


class TestProformaServiceConversion:
    """Tests for quote-to-invoice conversion."""

    def test_convert_full(self):
        from app.models.proforma import QuoteStatus
        from app.services.proforma_service import ProformaService

        item = _make_item()
        mock_quote = _make_quote(status=QuoteStatus.APPROVED, items=[item])

        db = MagicMock()
        db.query.return_value.filter.return_value.scalar.return_value = 0
        db.query.return_value.filter.return_value.all.return_value = [item]

        service = ProformaService(db)
        with patch.object(service, "get_quote", return_value=mock_quote):
            result = service.convert_to_invoice(
                str(mock_quote.id), str(mock_quote.business_id),
            )

        assert result["status"] == "converted"
        assert "invoice_id" in result

    def test_convert_not_found(self):
        from app.services.proforma_service import ProformaService

        db = MagicMock()
        service = ProformaService(db)
        with patch.object(service, "get_quote", return_value=None):
            with pytest.raises(ValueError, match="not found"):
                service.convert_to_invoice(str(uuid.uuid4()), str(uuid.uuid4()))

    def test_convert_wrong_status(self):
        from app.models.proforma import QuoteStatus
        from app.services.proforma_service import ProformaService

        mock_quote = _make_quote()
        mock_quote.status = QuoteStatus.CANCELLED

        db = MagicMock()
        service = ProformaService(db)
        with patch.object(service, "get_quote", return_value=mock_quote):
            with pytest.raises(ValueError, match="Cannot convert"):
                service.convert_to_invoice(str(mock_quote.id), str(mock_quote.business_id))


class TestProformaServiceExpiry:
    """Tests for auto-expiry of old quotes."""

    def test_expire_old_quotes(self):
        from app.services.proforma_service import ProformaService

        db = MagicMock()
        db.query.return_value.filter.return_value.update.return_value = 3

        service = ProformaService(db)
        count = service.expire_old_quotes(str(uuid.uuid4()))
        assert count == 3
        db.commit.assert_called()


class TestProformaServiceAudit:
    """Tests for audit trail operations."""

    def test_get_audit_trail(self):
        from app.services.proforma_service import ProformaService

        mock_entry = MagicMock()
        mock_entry.id = uuid.uuid4()
        mock_entry.action = "created"
        mock_entry.created_at = datetime.now(timezone.utc)

        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
            mock_entry
        ]

        service = ProformaService(db)
        entries = service.get_audit_trail(str(uuid.uuid4()))
        assert len(entries) == 1
        assert entries[0].action == "created"


# ══════════════════════════════════════════════════════════════════════
# ProformaReportService Tests
# ══════════════════════════════════════════════════════════════════════


class TestConversionRateReport:
    """Tests for conversion rate analytics."""

    def test_empty_business(self):
        from app.services.proforma_report_service import ProformaReportService

        db = MagicMock()
        base = db.query.return_value.filter.return_value
        base.count.return_value = 0
        base.filter.return_value.count.return_value = 0

        service = ProformaReportService(db)
        result = service.get_conversion_rate(str(uuid.uuid4()))
        assert result["total_quotes"] == 0
        assert result["conversion_rate"] == 0.0

    def test_with_data(self):
        from app.services.proforma_report_service import ProformaReportService

        db = MagicMock()
        base = db.query.return_value.filter.return_value
        base.count.return_value = 10
        # Each filter for different statuses
        base.filter.return_value.count.side_effect = [3, 2, 1, 2, 1]

        service = ProformaReportService(db)
        result = service.get_conversion_rate(str(uuid.uuid4()))
        assert result["total_quotes"] == 10


class TestValueReport:
    """Tests for quote value statistics."""

    def test_default_date_range(self):
        from app.services.proforma_report_service import ProformaReportService

        mock_row = MagicMock()
        mock_row.cnt = 5
        mock_row.total_val = Decimal("5000.00")
        mock_row.avg_val = Decimal("1000.00")
        mock_row.min_val = Decimal("200.00")
        mock_row.max_val = Decimal("2000.00")

        db = MagicMock()
        db.query.return_value.filter.return_value.one.return_value = mock_row

        service = ProformaReportService(db)
        result = service.get_value_report(str(uuid.uuid4()))
        assert result["total_quotes"] == 5
        assert result["total_value"] == 5000.00


class TestAgingReport:
    """Tests for quote aging buckets."""

    def test_aging_buckets(self):
        from app.services.proforma_report_service import ProformaReportService

        quotes = [
            _make_quote(issue_date=date.today()),                           # 0-7 bucket
            _make_quote(issue_date=date.today() - timedelta(days=10)),      # 8-14 bucket
            _make_quote(issue_date=date.today() - timedelta(days=20)),      # 15-30 bucket
            _make_quote(issue_date=date.today() - timedelta(days=45)),      # 30+ bucket
        ]

        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = quotes

        service = ProformaReportService(db)
        result = service.get_aging_report(str(uuid.uuid4()))
        assert result["bucket_0_7"] == 1
        assert result["bucket_8_14"] == 1
        assert result["bucket_15_30"] == 1
        assert result["bucket_30_plus"] == 1
        assert result["total"] == 4


class TestLostQuotesReport:
    """Tests for lost quotes analysis."""

    def test_lost_quotes_report(self):
        from app.models.proforma import QuoteStatus
        from app.services.proforma_report_service import ProformaReportService

        rejected = _make_quote(
            status=QuoteStatus.REJECTED,
            total=Decimal("500"),
            rejection_reason="Too costly",
        )
        expired = _make_quote(
            status=QuoteStatus.EXPIRED,
            total=Decimal("300"),
        )

        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
            rejected, expired,
        ]

        service = ProformaReportService(db)
        result = service.get_lost_quotes(str(uuid.uuid4()))
        assert result["total_lost"] == 2
        assert result["rejected_count"] == 1
        assert result["expired_count"] == 1
        assert result["total_value"] == 800.00
