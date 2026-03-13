"""Unit tests for PaymentService.

Tests cover:
- Payment method CRUD (create, list, get, update, delete)
- Transaction lifecycle (create, complete, refund)
- Payment summary report aggregation
- Report by payment method breakdown
- Export data formatting
- Security helpers (reference masking, response sanitisation)
"""

import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

os.environ.setdefault("SECRET_KEY", "test-secret-key")


from app.services.payment_service import PaymentService
from app.models.payment import PaymentTransactionStatus


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = uuid.uuid4()


def _make_service():
    db = MagicMock()
    return PaymentService(db), db


def _mock_method(**kwargs):
    """Mock a PaymentMethod."""
    m = MagicMock()
    m.id = kwargs.get("id", uuid.uuid4())
    m.business_id = kwargs.get("business_id", BIZ)
    m.name = kwargs.get("name", "Card Terminal #1")
    m.method_type = kwargs.get("method_type", "card")
    m.provider = kwargs.get("provider", "yoco")
    m.config = kwargs.get("config", {})
    m.is_active = kwargs.get("is_active", True)
    m.sort_order = kwargs.get("sort_order", 0)
    m.deleted_at = None
    return m


def _mock_txn(**kwargs):
    """Mock a PaymentTransaction."""
    t = MagicMock()
    t.id = kwargs.get("id", uuid.uuid4())
    t.business_id = kwargs.get("business_id", BIZ)
    t.order_id = kwargs.get("order_id", uuid.uuid4())
    t.payment_method_id = kwargs.get("payment_method_id", uuid.uuid4())
    t.amount = kwargs.get("amount", Decimal("100.00"))
    t.tip_amount = kwargs.get("tip_amount", Decimal("10.00"))
    t.status = kwargs.get("status", PaymentTransactionStatus.COMPLETED.value)
    t.gateway_reference = kwargs.get("gateway_reference", "GW-REF-12345678")
    t.gateway_response = kwargs.get("gateway_response", {"status": "ok"})
    t.refund_of_id = kwargs.get("refund_of_id", None)
    t.processed_at = kwargs.get("processed_at", datetime.now(timezone.utc))
    t.created_at = kwargs.get("created_at", datetime.now(timezone.utc))
    return t


# ══════════════════════════════════════════════════════════════════════════════
# Payment Method Tests
# ══════════════════════════════════════════════════════════════════════════════


class TestPaymentMethods:
    """Test payment method CRUD operations."""

    def test_create_method(self):
        """create_method persists and returns a PaymentMethod."""
        svc, db = _make_service()
        svc.create_method(BIZ, name="Cash", method_type="cash")
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_list_methods_active_only(self):
        """list_methods with active_only=True filters inactive methods."""
        svc, db = _make_service()
        method = _mock_method()
        q = db.query.return_value.filter.return_value
        q.filter.return_value = q
        q.count.return_value = 1
        q.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [method]

        items, total = svc.list_methods(BIZ, active_only=True)
        assert total == 1
        assert items == [method]

    def test_get_method_found(self):
        """get_method returns the method when found."""
        svc, db = _make_service()
        method = _mock_method()
        db.query.return_value.filter.return_value.first.return_value = method
        assert svc.get_method(method.id) == method

    def test_get_method_not_found(self):
        """get_method returns None when not found."""
        svc, db = _make_service()
        db.query.return_value.filter.return_value.first.return_value = None
        assert svc.get_method(uuid.uuid4()) is None

    def test_delete_method_soft_deletes(self):
        """delete_method calls soft_delete on the method."""
        svc, db = _make_service()
        method = _mock_method()
        db.query.return_value.filter.return_value.first.return_value = method
        assert svc.delete_method(method.id) is True
        method.soft_delete.assert_called_once()
        db.commit.assert_called()


# ══════════════════════════════════════════════════════════════════════════════
# Transaction Tests
# ══════════════════════════════════════════════════════════════════════════════


class TestTransactions:
    """Test transaction lifecycle."""

    def test_create_transaction(self):
        """create_transaction persists with PENDING status."""
        svc, db = _make_service()
        svc.create_transaction(
            BIZ, order_id=uuid.uuid4(), amount=Decimal("250.00")
        )
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_complete_transaction(self):
        """complete_transaction sets COMPLETED status and processed_at."""
        svc, db = _make_service()
        txn = _mock_txn(status=PaymentTransactionStatus.PENDING.value)
        db.query.return_value.filter.return_value.first.return_value = txn

        result = svc.complete_transaction(txn.id, "GW-12345")
        assert result.status == PaymentTransactionStatus.COMPLETED.value

    def test_refund_rejects_over_amount(self):
        """refund_transaction returns None if amount exceeds original."""
        svc, db = _make_service()
        txn = _mock_txn(amount=Decimal("100.00"))
        db.query.return_value.filter.return_value.first.return_value = txn

        result = svc.refund_transaction(txn.id, Decimal("200.00"))
        assert result is None

    def test_refund_creates_linked_transaction(self):
        """refund_transaction creates a new txn linked to original."""
        svc, db = _make_service()
        txn = _mock_txn(amount=Decimal("100.00"))
        db.query.return_value.filter.return_value.first.return_value = txn

        svc.refund_transaction(txn.id, Decimal("50.00"))
        db.add.assert_called_once()
        db.commit.assert_called()


# ══════════════════════════════════════════════════════════════════════════════
# Report Tests
# ══════════════════════════════════════════════════════════════════════════════


class TestPaymentReports:
    """Test payment report aggregation methods."""

    def test_summary_report_structure(self):
        """Summary report returns all expected fields."""
        svc, db = _make_service()

        base_q = MagicMock()
        db.query.return_value.filter.return_value = base_q
        base_q.count.return_value = 10

        # completed query chain
        completed_q = MagicMock()
        base_q.filter.return_value = completed_q
        completed_q.count.return_value = 8
        completed_q.with_entities.return_value.first.return_value = (
            Decimal("5000.00"),
            Decimal("200.00"),
        )

        # refund query chain
        refund_q = MagicMock()
        completed_q.filter.return_value = refund_q
        refund_q.with_entities.return_value.first.return_value = (2, Decimal("300.00"))

        # failed count
        refund_q.filter.return_value.count.return_value = 0

        result = svc.get_payment_summary(BIZ, days=30)
        assert result["total_transactions"] == 10
        assert "total_revenue" in result
        assert "net_revenue" in result
        assert "success_rate_pct" in result

    def test_summary_report_empty(self):
        """Summary report handles zero transactions gracefully."""
        svc, db = _make_service()

        base_q = MagicMock()
        db.query.return_value.filter.return_value = base_q
        base_q.count.return_value = 0

        completed_q = MagicMock()
        base_q.filter.return_value = completed_q
        completed_q.count.return_value = 0
        completed_q.with_entities.return_value.first.return_value = (0, 0)

        refund_q = MagicMock()
        completed_q.filter.return_value = refund_q
        refund_q.with_entities.return_value.first.return_value = (0, 0)
        refund_q.filter.return_value.count.return_value = 0

        result = svc.get_payment_summary(BIZ, days=7)
        assert result["total_transactions"] == 0
        assert result["total_revenue"] == 0
        assert result["success_rate_pct"] == 0.0

    def test_report_by_method(self):
        """by-method report returns correct fields per method."""
        svc, db = _make_service()

        row = MagicMock()
        row.method_type = "card"
        row.name = "Yoco Terminal"
        row.txn_count = 15
        row.total_amount = Decimal("3000.00")
        row.total_tips = Decimal("100.00")
        row.completed_count = 14

        chain = db.query.return_value
        chain.join.return_value.filter.return_value.group_by.return_value.order_by.return_value.all.return_value = [row]

        result = svc.get_report_by_method(BIZ, days=30)
        assert len(result) == 1
        assert result[0]["method_type"] == "card"
        assert result[0]["transaction_count"] == 15
        assert result[0]["total_amount"] == 3000.0

    def test_export_masks_references(self):
        """Export data masks gateway references."""
        svc, db = _make_service()
        txn = _mock_txn(gateway_reference="GW-REF-12345678")

        chain = db.query.return_value
        chain.outerjoin.return_value.filter.return_value.order_by.return_value.all.return_value = [txn]

        rows = svc.get_transactions_for_export(BIZ, days=30)
        assert len(rows) == 1
        # Gateway reference should be masked (only last 4 chars visible)
        assert rows[0]["gateway_reference"].endswith("5678")
        assert rows[0]["gateway_reference"].startswith("*")


# ══════════════════════════════════════════════════════════════════════════════
# Security Helper Tests
# ══════════════════════════════════════════════════════════════════════════════


class TestSecurityHelpers:
    """Test data masking and sanitisation utilities."""

    def test_mask_reference_long(self):
        """Long reference shows only last 4 characters."""
        masked = PaymentService.mask_reference("GW-REF-12345678")
        assert masked.endswith("5678")
        assert masked.startswith("*")
        assert len(masked) == len("GW-REF-12345678")

    def test_mask_reference_short(self):
        """Reference of 4 chars or less is returned as-is."""
        assert PaymentService.mask_reference("1234") == "1234"

    def test_mask_reference_none(self):
        """None reference returns None."""
        assert PaymentService.mask_reference(None) is None

    def test_mask_gateway_response_strips_sensitive(self):
        """Sensitive keys are replaced with REDACTED."""
        response = {
            "status": "success",
            "card_number": "4111111111111111",
            "cvv": "123",
            "transaction_id": "txn-abc",
        }
        masked = PaymentService.mask_gateway_response(response)
        assert masked["status"] == "success"
        assert masked["transaction_id"] == "txn-abc"
        assert masked["card_number"] == "***REDACTED***"
        assert masked["cvv"] == "***REDACTED***"

    def test_mask_gateway_response_nested(self):
        """Nested dicts have sensitive fields masked recursively."""
        response = {
            "data": {
                "token": "secret-token-value",
                "amount": 100,
            }
        }
        masked = PaymentService.mask_gateway_response(response)
        assert masked["data"]["token"] == "***REDACTED***"
        assert masked["data"]["amount"] == 100

    def test_mask_gateway_response_none(self):
        """None response returns None."""
        assert PaymentService.mask_gateway_response(None) is None
