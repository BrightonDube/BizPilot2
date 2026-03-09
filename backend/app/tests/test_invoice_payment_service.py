"""Tests for invoice payment service (Paystack integration)."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.invoice import Invoice, InvoiceStatus
from app.services.invoice_payment_service import (
    InvoicePaymentService,
    calculate_gateway_fees,
    PAYSTACK_FEE_CAP,
    PAYSTACK_FEE_FLAT,
    PAYSTACK_FEE_PERCENT,
)
from app.services.paystack_service import PaystackTransaction

BIZ = uuid.uuid4()
INV_ID = uuid.uuid4()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _chain(first=None, rows=None, count=0):
    """Mock that supports common SQLAlchemy chained-call pattern."""
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.first = MagicMock(return_value=first)
    q.all = MagicMock(return_value=rows if rows is not None else [])
    q.count = MagicMock(return_value=count)
    return q


def _make_invoice(**overrides) -> MagicMock:
    """Build a mock Invoice with sensible defaults."""
    inv = MagicMock(spec=Invoice)
    inv.id = overrides.get("id", INV_ID)
    inv.business_id = overrides.get("business_id", BIZ)
    inv.invoice_number = overrides.get("invoice_number", "INV-001")
    inv.total = overrides.get("total", Decimal("1000.00"))
    inv.amount_paid = overrides.get("amount_paid", Decimal("0"))
    inv.balance_due = overrides.get("balance_due", Decimal("1000.00"))
    inv.payment_reference = overrides.get("payment_reference", None)
    inv.payment_gateway_fees = overrides.get("payment_gateway_fees", Decimal("0"))
    inv.gateway_status = overrides.get("gateway_status", None)
    inv.status = overrides.get("status", InvoiceStatus.SENT)
    inv.paid_date = overrides.get("paid_date", None)
    inv.deleted_at = overrides.get("deleted_at", None)
    return inv


def _make_service():
    db = MagicMock()
    return InvoicePaymentService(db), db


# ---------------------------------------------------------------------------
# calculate_gateway_fees
# ---------------------------------------------------------------------------

class TestCalculateGatewayFees:
    """Tests for the module-level calculate_gateway_fees function."""

    def test_normal_amount(self):
        """1.5% of 1000 = 15, plus R2 flat = R17.00 (under cap)."""
        result = calculate_gateway_fees(Decimal("1000"))
        expected = (Decimal("1000") * Decimal("1.5") / 100 + Decimal("2")).quantize(Decimal("0.01"))
        assert result == expected  # 17.00

    def test_small_amount(self):
        """1.5% of 10 = 0.15, plus R2 = R2.15."""
        result = calculate_gateway_fees(Decimal("10"))
        assert result == Decimal("2.15")

    def test_zero_amount(self):
        """0 * 1.5% + R2 = R2.00."""
        result = calculate_gateway_fees(Decimal("0"))
        assert result == Decimal("2.00")

    def test_large_amount_hits_cap(self):
        """When fee exceeds R50 cap, return R50."""
        # 1.5% of 10000 = 150, plus 2 = 152 → capped at 50
        result = calculate_gateway_fees(Decimal("10000"))
        assert result == PAYSTACK_FEE_CAP  # R50.00

    def test_amount_just_below_cap(self):
        """Amount where fee is just under the R50 cap."""
        # Need: 1.5%*X + 2 < 50 → X < 3200
        result = calculate_gateway_fees(Decimal("3100"))
        expected = (Decimal("3100") * Decimal("1.5") / 100 + Decimal("2")).quantize(Decimal("0.01"))
        assert result == expected  # 48.50
        assert result < PAYSTACK_FEE_CAP

    def test_amount_exactly_at_cap_boundary(self):
        """Amount where fee == cap exactly (1.5%*X + 2 = 50 → X = 3200)."""
        result = calculate_gateway_fees(Decimal("3200"))
        # 1.5% of 3200 = 48, + 2 = 50 → exactly at cap, but not > cap
        assert result == Decimal("50.00")

    def test_result_is_quantized(self):
        """Result should always have two decimal places."""
        result = calculate_gateway_fees(Decimal("333"))
        assert result == result.quantize(Decimal("0.01"))

    def test_result_type_is_decimal(self):
        result = calculate_gateway_fees(Decimal("500"))
        assert isinstance(result, Decimal)


# ---------------------------------------------------------------------------
# get_invoice
# ---------------------------------------------------------------------------

class TestGetInvoice:
    """Tests for InvoicePaymentService.get_invoice."""

    def test_found(self):
        inv = _make_invoice()
        svc, db = _make_service()
        db.query.return_value = _chain(first=inv)

        result = svc.get_invoice(str(INV_ID), str(BIZ))
        assert result is inv
        db.query.assert_called_once_with(Invoice)

    def test_not_found(self):
        svc, db = _make_service()
        db.query.return_value = _chain(first=None)

        result = svc.get_invoice(str(INV_ID), str(BIZ))
        assert result is None

    def test_filter_called(self):
        svc, db = _make_service()
        chain = _chain(first=None)
        db.query.return_value = chain

        svc.get_invoice(str(INV_ID), str(BIZ))
        chain.filter.assert_called_once()


# ---------------------------------------------------------------------------
# get_invoice_by_reference
# ---------------------------------------------------------------------------

class TestGetInvoiceByReference:
    """Tests for InvoicePaymentService.get_invoice_by_reference."""

    def test_found(self):
        inv = _make_invoice(payment_reference="REF-123")
        svc, db = _make_service()
        db.query.return_value = _chain(first=inv)

        result = svc.get_invoice_by_reference("REF-123")
        assert result is inv

    def test_not_found(self):
        svc, db = _make_service()
        db.query.return_value = _chain(first=None)

        result = svc.get_invoice_by_reference("NONEXIST")
        assert result is None


# ---------------------------------------------------------------------------
# initiate_payment
# ---------------------------------------------------------------------------

class TestInitiatePayment:
    """Tests for InvoicePaymentService.initiate_payment (async)."""

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_success(self, mock_ps):
        """Successful payment initiation stores reference and computes fees."""
        inv = _make_invoice(balance_due=Decimal("500"))
        svc, db = _make_service()

        mock_ps.generate_reference.return_value = "INV-20250101-ABCD1234"
        tx = PaystackTransaction(
            reference="INV-20250101-ABCD1234",
            authorization_url="https://paystack.co/pay/xyz",
            access_code="ac_xyz",
        )
        mock_ps.initialize_transaction = AsyncMock(return_value=tx)

        result_tx, fees, total = await svc.initiate_payment(
            inv, "user@example.com", "https://callback.url"
        )

        expected_fees = calculate_gateway_fees(Decimal("500"))
        expected_total = Decimal("500") + expected_fees

        assert result_tx is tx
        assert fees == expected_fees
        assert total == expected_total

        # Invoice fields updated
        assert inv.payment_reference == "INV-20250101-ABCD1234"
        assert inv.payment_gateway_fees == expected_fees
        assert inv.gateway_status == "pending"
        db.commit.assert_called_once()

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_zero_balance_returns_none_tuple(self, mock_ps):
        """When balance_due <= 0, returns (None, 0, 0) without calling Paystack."""
        inv = _make_invoice(balance_due=Decimal("0"))
        svc, db = _make_service()

        result_tx, fees, total = await svc.initiate_payment(
            inv, "user@example.com", "https://callback.url"
        )

        assert result_tx is None
        assert fees == Decimal("0")
        assert total == Decimal("0")
        mock_ps.generate_reference.assert_not_called()
        mock_ps.initialize_transaction.assert_not_called()
        db.commit.assert_not_called()

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_negative_balance_returns_none_tuple(self, mock_ps):
        """Negative balance (overpaid) also returns (None, 0, 0)."""
        inv = _make_invoice(balance_due=Decimal("-50"))
        svc, db = _make_service()

        result_tx, fees, total = await svc.initiate_payment(
            inv, "user@example.com", "https://callback.url"
        )

        assert result_tx is None
        assert fees == Decimal("0")
        assert total == Decimal("0")

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_paystack_failure_returns_none(self, mock_ps):
        """When Paystack returns None, transaction is None, no DB commit."""
        inv = _make_invoice(balance_due=Decimal("200"))
        svc, db = _make_service()

        mock_ps.generate_reference.return_value = "INV-REF"
        mock_ps.initialize_transaction = AsyncMock(return_value=None)

        result_tx, fees, total = await svc.initiate_payment(
            inv, "user@example.com", "https://callback.url"
        )

        assert result_tx is None
        # Fees still computed
        expected_fees = calculate_gateway_fees(Decimal("200"))
        assert fees == expected_fees
        assert total == Decimal("200") + expected_fees
        # Invoice reference NOT set since transaction failed
        db.commit.assert_not_called()

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_amount_cents_passed_correctly(self, mock_ps):
        """Verify the amount in cents passed to Paystack is correct."""
        inv = _make_invoice(balance_due=Decimal("100.50"))
        svc, _db = _make_service()

        mock_ps.generate_reference.return_value = "INV-REF"
        tx = PaystackTransaction(
            reference="INV-REF",
            authorization_url="https://paystack.co/pay/xyz",
            access_code="ac_xyz",
        )
        mock_ps.initialize_transaction = AsyncMock(return_value=tx)

        await svc.initiate_payment(inv, "user@example.com", "https://cb.url")

        call_kwargs = mock_ps.initialize_transaction.call_args[1]
        gateway_fees = calculate_gateway_fees(Decimal("100.50"))
        expected_cents = int(((Decimal("100.50") + gateway_fees) * 100).to_integral_value())
        assert call_kwargs["amount_cents"] == expected_cents
        assert call_kwargs["email"] == "user@example.com"
        assert call_kwargs["reference"] == "INV-REF"
        assert call_kwargs["callback_url"] == "https://cb.url"

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_metadata_includes_invoice_details(self, mock_ps):
        """Metadata sent to Paystack contains invoice info."""
        inv = _make_invoice(balance_due=Decimal("300"))
        svc, _db = _make_service()

        mock_ps.generate_reference.return_value = "INV-REF"
        tx = PaystackTransaction(
            reference="INV-REF",
            authorization_url="https://paystack.co/pay/x",
            access_code="ac_x",
        )
        mock_ps.initialize_transaction = AsyncMock(return_value=tx)

        await svc.initiate_payment(inv, "a@b.com", "https://cb.url")

        call_kwargs = mock_ps.initialize_transaction.call_args[1]
        meta = call_kwargs["metadata"]
        assert meta["invoice_id"] == str(inv.id)
        assert meta["invoice_number"] == inv.invoice_number
        assert meta["business_id"] == str(inv.business_id)


# ---------------------------------------------------------------------------
# verify_payment
# ---------------------------------------------------------------------------

class TestVerifyPayment:
    """Tests for InvoicePaymentService.verify_payment (async)."""

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_success_full_payment(self, mock_ps):
        """Full payment sets status to PAID and records paid_date."""
        gateway_fees = calculate_gateway_fees(Decimal("1000"))
        total_cents = int(((Decimal("1000") + gateway_fees) * 100).to_integral_value())

        inv = _make_invoice(
            total=Decimal("1000"),
            amount_paid=Decimal("0"),
            payment_gateway_fees=gateway_fees,
        )
        svc, db = _make_service()
        db.query.return_value = _chain(first=inv)

        mock_ps.verify_transaction = AsyncMock(return_value={
            "status": "success",
            "amount": total_cents,
        })

        success, message, result_inv = await svc.verify_payment("REF-001")

        assert success is True
        assert "successful" in message.lower()
        assert result_inv is inv
        assert inv.gateway_status == "success"
        assert inv.status == InvoiceStatus.PAID
        assert inv.paid_date == date.today()
        db.commit.assert_called_once()

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_success_partial_payment(self, mock_ps):
        """Partial payment sets status to PARTIAL."""
        inv = _make_invoice(
            total=Decimal("1000"),
            amount_paid=Decimal("0"),
            payment_gateway_fees=Decimal("10"),
        )
        svc, db = _make_service()
        db.query.return_value = _chain(first=inv)

        # Pay 500 in cents (includes 10 gateway fees → invoice_payment = 490)
        mock_ps.verify_transaction = AsyncMock(return_value={
            "status": "success",
            "amount": 50000,  # 500.00 in cents
        })

        success, message, result_inv = await svc.verify_payment("REF-002")

        assert success is True
        # amount_paid should be 0 + (500 - 10) = 490
        assert inv.amount_paid == Decimal("490")
        assert inv.status == InvoiceStatus.PARTIAL
        assert inv.paid_date is None
        db.commit.assert_called_once()

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_abandoned_payment(self, mock_ps):
        inv = _make_invoice()
        svc, db = _make_service()
        db.query.return_value = _chain(first=inv)

        mock_ps.verify_transaction = AsyncMock(return_value={
            "status": "abandoned",
        })

        success, message, result_inv = await svc.verify_payment("REF-003")

        assert success is False
        assert "abandoned" in message.lower()
        assert inv.gateway_status == "abandoned"
        db.commit.assert_called_once()

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_failed_payment(self, mock_ps):
        inv = _make_invoice()
        svc, db = _make_service()
        db.query.return_value = _chain(first=inv)

        mock_ps.verify_transaction = AsyncMock(return_value={
            "status": "failed",
        })

        success, message, result_inv = await svc.verify_payment("REF-004")

        assert success is False
        assert "failed" in message.lower()
        assert inv.gateway_status == "failed"
        db.commit.assert_called_once()

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_unknown_status(self, mock_ps):
        inv = _make_invoice()
        svc, db = _make_service()
        db.query.return_value = _chain(first=inv)

        mock_ps.verify_transaction = AsyncMock(return_value={
            "status": "pending",
        })

        success, message, result_inv = await svc.verify_payment("REF-005")

        assert success is False
        assert "pending" in message
        assert inv.gateway_status == "pending"
        db.commit.assert_called_once()

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_unknown_status_none(self, mock_ps):
        """When status key is None, gateway_status is set to 'unknown'."""
        inv = _make_invoice()
        svc, db = _make_service()
        db.query.return_value = _chain(first=inv)

        mock_ps.verify_transaction = AsyncMock(return_value={
            "status": None,
        })

        success, message, result_inv = await svc.verify_payment("REF-006")

        assert success is False
        assert inv.gateway_status == "unknown"

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_invoice_not_found(self, mock_ps):
        """Returns (False, message, None) when invoice is not found."""
        svc, db = _make_service()
        db.query.return_value = _chain(first=None)

        success, message, result_inv = await svc.verify_payment("MISSING-REF")

        assert success is False
        assert "not found" in message.lower()
        assert result_inv is None
        mock_ps.verify_transaction.assert_not_called()

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_paystack_verify_returns_none(self, mock_ps):
        """When Paystack cannot verify, sets verification_failed."""
        inv = _make_invoice()
        svc, db = _make_service()
        db.query.return_value = _chain(first=inv)

        mock_ps.verify_transaction = AsyncMock(return_value=None)

        success, message, result_inv = await svc.verify_payment("REF-007")

        assert success is False
        assert "could not verify" in message.lower()
        assert inv.gateway_status == "verification_failed"
        assert result_inv is inv
        db.commit.assert_called_once()

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_success_accumulates_amount_paid(self, mock_ps):
        """Existing amount_paid is accumulated, not replaced."""
        gateway_fees = Decimal("10")
        inv = _make_invoice(
            total=Decimal("1000"),
            amount_paid=Decimal("400"),
            payment_gateway_fees=gateway_fees,
        )
        svc, db = _make_service()
        db.query.return_value = _chain(first=inv)

        # Pay 610 cents-converted → 610 - 10 fees = 600 invoice payment
        mock_ps.verify_transaction = AsyncMock(return_value={
            "status": "success",
            "amount": 61000,  # 610.00 in cents
        })

        success, _, _ = await svc.verify_payment("REF-ACC")

        assert success is True
        # 400 + 600 = 1000 → fully paid
        assert inv.amount_paid == Decimal("1000")
        assert inv.status == InvoiceStatus.PAID
        assert inv.paid_date == date.today()

    @patch("app.services.invoice_payment_service.paystack_service")
    @pytest.mark.asyncio
    async def test_success_with_none_amount_paid(self, mock_ps):
        """When invoice.amount_paid is None, treats it as 0."""
        inv = _make_invoice(
            total=Decimal("500"),
            amount_paid=None,
            payment_gateway_fees=None,
        )
        svc, db = _make_service()
        db.query.return_value = _chain(first=inv)

        mock_ps.verify_transaction = AsyncMock(return_value={
            "status": "success",
            "amount": 50000,
        })

        success, _, result_inv = await svc.verify_payment("REF-NONE")

        assert success is True
        # gateway_fees defaults to 0, so invoice_payment = 500 - 0 = 500
        assert inv.amount_paid == Decimal("500")
        assert inv.status == InvoiceStatus.PAID


# ---------------------------------------------------------------------------
# reset_payment_reference
# ---------------------------------------------------------------------------

class TestResetPaymentReference:
    """Tests for InvoicePaymentService.reset_payment_reference."""

    def test_clears_reference_and_status(self):
        inv = _make_invoice(payment_reference="REF-OLD", gateway_status="pending")
        svc, db = _make_service()

        svc.reset_payment_reference(inv)

        assert inv.payment_reference is None
        assert inv.gateway_status is None
        db.commit.assert_called_once()

    def test_already_none(self):
        """No-op semantics when fields are already None."""
        inv = _make_invoice(payment_reference=None, gateway_status=None)
        svc, db = _make_service()

        svc.reset_payment_reference(inv)

        assert inv.payment_reference is None
        assert inv.gateway_status is None
        db.commit.assert_called_once()
