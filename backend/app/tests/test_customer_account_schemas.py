"""Unit tests for customer account schemas."""

import pytest
from decimal import Decimal
from datetime import date
from uuid import uuid4
from pydantic import ValidationError

from app.schemas.customer_account import (
    AccountCreate,
    AccountUpdate,
    ChargeCreate,
    PaymentCreate,
    AdjustmentCreate,
    ActivityCreate,
    WriteOffCreate,
    AgingBreakdown,
    StatementGenerate,
)
from app.models.customer_account import ActivityType


class TestAccountSchemas:
    """Test account creation and update schemas."""

    def test_account_create_valid(self):
        """Test creating a valid account."""
        data = {
            "customer_id": str(uuid4()),
            "credit_limit": Decimal("5000.00"),
            "payment_terms": 30,
            "account_pin": "1234",
            "notes": "Test account"
        }
        account = AccountCreate(**data)
        assert account.credit_limit == Decimal("5000.00")
        assert account.payment_terms == 30
        assert account.account_pin == "1234"

    def test_account_create_minimal(self):
        """Test creating account with minimal data."""
        data = {
            "customer_id": str(uuid4()),
        }
        account = AccountCreate(**data)
        assert account.credit_limit == Decimal("0")
        assert account.payment_terms == 30
        assert account.account_pin is None

    def test_account_create_invalid_pin(self):
        """Test that non-numeric PIN is rejected."""
        data = {
            "customer_id": str(uuid4()),
            "account_pin": "abcd"
        }
        with pytest.raises(ValidationError) as exc_info:
            AccountCreate(**data)
        assert "PIN must contain only digits" in str(exc_info.value)

    def test_account_create_negative_credit_limit(self):
        """Test that negative credit limit is rejected."""
        data = {
            "customer_id": str(uuid4()),
            "credit_limit": Decimal("-1000.00")
        }
        with pytest.raises(ValidationError):
            AccountCreate(**data)

    def test_account_update_valid(self):
        """Test updating account with valid data."""
        data = {
            "credit_limit": Decimal("10000.00"),
            "payment_terms": 60,
            "notes": "Updated notes"
        }
        update = AccountUpdate(**data)
        assert update.credit_limit == Decimal("10000.00")
        assert update.payment_terms == 60

    def test_account_update_partial(self):
        """Test partial account update."""
        data = {
            "credit_limit": Decimal("7500.00")
        }
        update = AccountUpdate(**data)
        assert update.credit_limit == Decimal("7500.00")
        assert update.payment_terms is None


class TestTransactionSchemas:
    """Test transaction-related schemas."""

    def test_charge_create_valid(self):
        """Test creating a valid charge."""
        data = {
            "amount": Decimal("150.00"),
            "reference_type": "order",
            "reference_id": str(uuid4()),
            "description": "Test charge",
            "due_date": date.today()
        }
        charge = ChargeCreate(**data)
        assert charge.amount == Decimal("150.00")
        assert charge.reference_type == "order"

    def test_charge_create_negative_amount(self):
        """Test that negative charge amount is rejected."""
        data = {
            "amount": Decimal("-50.00")
        }
        with pytest.raises(ValidationError) as exc_info:
            ChargeCreate(**data)
        assert "Charge amount must be positive" in str(exc_info.value)

    def test_charge_create_zero_amount(self):
        """Test that zero charge amount is rejected."""
        data = {
            "amount": Decimal("0.00")
        }
        with pytest.raises(ValidationError) as exc_info:
            ChargeCreate(**data)
        assert "Charge amount must be positive" in str(exc_info.value)

    def test_adjustment_create_valid_positive(self):
        """Test creating a positive adjustment."""
        data = {
            "amount": Decimal("100.00"),
            "description": "Credit adjustment",
            "reason": "Customer complaint resolution"
        }
        adjustment = AdjustmentCreate(**data)
        assert adjustment.amount == Decimal("100.00")
        assert adjustment.reason == "Customer complaint resolution"

    def test_adjustment_create_valid_negative(self):
        """Test creating a negative adjustment."""
        data = {
            "amount": Decimal("-50.00"),
            "description": "Debit adjustment",
            "reason": "Correction for underpayment"
        }
        adjustment = AdjustmentCreate(**data)
        assert adjustment.amount == Decimal("-50.00")

    def test_adjustment_create_zero_amount(self):
        """Test that zero adjustment amount is rejected."""
        data = {
            "amount": Decimal("0.00"),
            "reason": "Test"
        }
        with pytest.raises(ValidationError) as exc_info:
            AdjustmentCreate(**data)
        assert "Adjustment amount cannot be zero" in str(exc_info.value)


class TestPaymentSchemas:
    """Test payment-related schemas."""

    def test_payment_create_valid(self):
        """Test creating a valid payment."""
        data = {
            "amount": Decimal("500.00"),
            "payment_method": "cash",
            "reference_number": "REF123",
            "notes": "Payment received"
        }
        payment = PaymentCreate(**data)
        assert payment.amount == Decimal("500.00")
        assert payment.payment_method == "cash"

    def test_payment_create_minimal(self):
        """Test creating payment with minimal data."""
        data = {
            "amount": Decimal("250.00"),
            "payment_method": "card"
        }
        payment = PaymentCreate(**data)
        assert payment.amount == Decimal("250.00")
        assert payment.reference_number is None

    def test_payment_create_negative_amount(self):
        """Test that negative payment amount is rejected."""
        data = {
            "amount": Decimal("-100.00"),
            "payment_method": "cash"
        }
        with pytest.raises(ValidationError):
            PaymentCreate(**data)

    def test_payment_create_zero_amount(self):
        """Test that zero payment amount is rejected."""
        data = {
            "amount": Decimal("0.00"),
            "payment_method": "cash"
        }
        with pytest.raises(ValidationError):
            PaymentCreate(**data)


class TestStatementSchemas:
    """Test statement-related schemas."""

    def test_aging_breakdown_valid(self):
        """Test creating aging breakdown."""
        data = {
            "current": Decimal("1000.00"),
            "days_30": Decimal("500.00"),
            "days_60": Decimal("250.00"),
            "days_90_plus": Decimal("100.00"),
            "total": Decimal("1850.00")
        }
        aging = AgingBreakdown(**data)
        assert aging.current == Decimal("1000.00")
        assert aging.total == Decimal("1850.00")

    def test_aging_breakdown_defaults(self):
        """Test aging breakdown with default values."""
        aging = AgingBreakdown()
        assert aging.current == Decimal("0")
        assert aging.days_30 == Decimal("0")
        assert aging.total == Decimal("0")

    def test_statement_generate_valid(self):
        """Test statement generation request."""
        data = {
            "period_end": date.today(),
            "period_start": date(2024, 1, 1)
        }
        statement = StatementGenerate(**data)
        assert statement.period_end == date.today()
        assert statement.period_start == date(2024, 1, 1)

    def test_statement_generate_minimal(self):
        """Test statement generation with minimal data."""
        data = {
            "period_end": date.today()
        }
        statement = StatementGenerate(**data)
        assert statement.period_end == date.today()
        assert statement.period_start is None


class TestCollectionSchemas:
    """Test collection activity schemas."""

    def test_activity_create_valid(self):
        """Test creating a collection activity."""
        data = {
            "activity_type": ActivityType.PHONE_CALL,
            "notes": "Called customer, no answer",
            "outcome": "no_answer"
        }
        activity = ActivityCreate(**data)
        assert activity.activity_type == ActivityType.PHONE_CALL
        assert activity.outcome == "no_answer"

    def test_activity_create_with_promise(self):
        """Test creating activity with payment promise."""
        data = {
            "activity_type": ActivityType.PROMISE,
            "notes": "Customer promised to pay",
            "promise_date": date.today(),
            "promise_amount": Decimal("1000.00"),
            "outcome": "promised"
        }
        activity = ActivityCreate(**data)
        assert activity.promise_date == date.today()
        assert activity.promise_amount == Decimal("1000.00")

    def test_activity_create_promise_without_date(self):
        """Test that promise amount without date is rejected."""
        data = {
            "activity_type": ActivityType.PROMISE,
            "promise_amount": Decimal("1000.00")
        }
        with pytest.raises(ValidationError) as exc_info:
            ActivityCreate(**data)
        assert "promise_date is required" in str(exc_info.value)


class TestWriteOffSchemas:
    """Test write-off schemas."""

    def test_write_off_create_valid(self):
        """Test creating a write-off."""
        data = {
            "amount": Decimal("500.00"),
            "reason": "Customer bankruptcy - uncollectable"
        }
        write_off = WriteOffCreate(**data)
        assert write_off.amount == Decimal("500.00")
        assert write_off.reason == "Customer bankruptcy - uncollectable"

    def test_write_off_create_negative_amount(self):
        """Test that negative write-off amount is rejected."""
        data = {
            "amount": Decimal("-100.00"),
            "reason": "Test"
        }
        with pytest.raises(ValidationError):
            WriteOffCreate(**data)

    def test_write_off_create_zero_amount(self):
        """Test that zero write-off amount is rejected."""
        data = {
            "amount": Decimal("0.00"),
            "reason": "Test"
        }
        with pytest.raises(ValidationError):
            WriteOffCreate(**data)

    def test_write_off_create_empty_reason(self):
        """Test that empty reason is rejected."""
        data = {
            "amount": Decimal("100.00"),
            "reason": ""
        }
        with pytest.raises(ValidationError):
            WriteOffCreate(**data)
