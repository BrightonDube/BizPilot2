"""Unit tests for payment schemas."""

import pytest
from decimal import Decimal
from uuid import uuid4
from pydantic import ValidationError

from app.schemas.customer_account import (
    PaymentCreate,
    PaymentCreateWithAllocations,
    PaymentAllocationCreate,
)


class TestPaymentCreate:
    """Test PaymentCreate schema."""

    def test_valid_payment_create(self):
        """Test creating a valid payment."""
        data = {
            "amount": Decimal("100.00"),
            "payment_method": "cash",
            "reference_number": "REF123",
            "notes": "Test payment"
        }
        payment = PaymentCreate(**data)
        assert payment.amount == Decimal("100.00")
        assert payment.payment_method == "cash"
        assert payment.reference_number == "REF123"
        assert payment.notes == "Test payment"

    def test_payment_create_minimal(self):
        """Test creating a payment with minimal fields."""
        data = {
            "amount": Decimal("50.00"),
            "payment_method": "card"
        }
        payment = PaymentCreate(**data)
        assert payment.amount == Decimal("50.00")
        assert payment.payment_method == "card"
        assert payment.reference_number is None
        assert payment.notes is None

    def test_payment_create_zero_amount(self):
        """Test that zero amount is rejected."""
        data = {
            "amount": Decimal("0.00"),
            "payment_method": "cash"
        }
        with pytest.raises(ValidationError) as exc_info:
            PaymentCreate(**data)
        assert "greater than 0" in str(exc_info.value).lower()

    def test_payment_create_negative_amount(self):
        """Test that negative amount is rejected."""
        data = {
            "amount": Decimal("-50.00"),
            "payment_method": "cash"
        }
        with pytest.raises(ValidationError) as exc_info:
            PaymentCreate(**data)
        assert "greater than 0" in str(exc_info.value).lower()

    def test_payment_create_empty_payment_method(self):
        """Test that empty payment method is rejected."""
        data = {
            "amount": Decimal("100.00"),
            "payment_method": ""
        }
        with pytest.raises(ValidationError) as exc_info:
            PaymentCreate(**data)
        assert "at least 1 character" in str(exc_info.value).lower()

    def test_payment_create_long_payment_method(self):
        """Test that payment method exceeding max length is rejected."""
        data = {
            "amount": Decimal("100.00"),
            "payment_method": "a" * 51  # Max is 50
        }
        with pytest.raises(ValidationError) as exc_info:
            PaymentCreate(**data)
        assert "at most 50 characters" in str(exc_info.value).lower()

    def test_payment_create_long_reference_number(self):
        """Test that reference number exceeding max length is rejected."""
        data = {
            "amount": Decimal("100.00"),
            "payment_method": "cash",
            "reference_number": "a" * 101  # Max is 100
        }
        with pytest.raises(ValidationError) as exc_info:
            PaymentCreate(**data)
        assert "at most 100 characters" in str(exc_info.value).lower()


class TestPaymentAllocationCreate:
    """Test PaymentAllocationCreate schema."""

    def test_valid_allocation_create(self):
        """Test creating a valid payment allocation."""
        transaction_id = uuid4()
        data = {
            "transaction_id": transaction_id,
            "amount": Decimal("50.00")
        }
        allocation = PaymentAllocationCreate(**data)
        assert allocation.transaction_id == transaction_id
        assert allocation.amount == Decimal("50.00")

    def test_allocation_create_zero_amount(self):
        """Test that zero allocation amount is rejected."""
        data = {
            "transaction_id": uuid4(),
            "amount": Decimal("0.00")
        }
        with pytest.raises(ValidationError) as exc_info:
            PaymentAllocationCreate(**data)
        assert "greater than 0" in str(exc_info.value).lower()

    def test_allocation_create_negative_amount(self):
        """Test that negative allocation amount is rejected."""
        data = {
            "transaction_id": uuid4(),
            "amount": Decimal("-25.00")
        }
        with pytest.raises(ValidationError) as exc_info:
            PaymentAllocationCreate(**data)
        assert "greater than 0" in str(exc_info.value).lower()


class TestPaymentCreateWithAllocations:
    """Test PaymentCreateWithAllocations schema."""

    def test_valid_payment_with_allocations(self):
        """Test creating a payment with valid allocations."""
        transaction_id_1 = uuid4()
        transaction_id_2 = uuid4()
        data = {
            "amount": Decimal("100.00"),
            "payment_method": "cash",
            "allocations": [
                {"transaction_id": transaction_id_1, "amount": Decimal("60.00")},
                {"transaction_id": transaction_id_2, "amount": Decimal("40.00")}
            ]
        }
        payment = PaymentCreateWithAllocations(**data)
        assert payment.amount == Decimal("100.00")
        assert len(payment.allocations) == 2
        assert payment.allocations[0].amount == Decimal("60.00")
        assert payment.allocations[1].amount == Decimal("40.00")

    def test_payment_with_no_allocations(self):
        """Test creating a payment without allocations (FIFO will be used)."""
        data = {
            "amount": Decimal("100.00"),
            "payment_method": "cash"
        }
        payment = PaymentCreateWithAllocations(**data)
        assert payment.amount == Decimal("100.00")
        assert payment.allocations is None

    def test_payment_with_empty_allocations(self):
        """Test creating a payment with empty allocations list."""
        data = {
            "amount": Decimal("100.00"),
            "payment_method": "cash",
            "allocations": []
        }
        payment = PaymentCreateWithAllocations(**data)
        assert payment.amount == Decimal("100.00")
        assert payment.allocations == []

    def test_payment_allocations_sum_mismatch(self):
        """Test that allocations must sum to payment amount."""
        transaction_id_1 = uuid4()
        transaction_id_2 = uuid4()
        data = {
            "amount": Decimal("100.00"),
            "payment_method": "cash",
            "allocations": [
                {"transaction_id": transaction_id_1, "amount": Decimal("60.00")},
                {"transaction_id": transaction_id_2, "amount": Decimal("30.00")}  # Sum is 90, not 100
            ]
        }
        with pytest.raises(ValidationError) as exc_info:
            PaymentCreateWithAllocations(**data)
        assert "must equal payment amount" in str(exc_info.value).lower()

    def test_payment_allocations_sum_exceeds(self):
        """Test that allocations cannot exceed payment amount."""
        transaction_id_1 = uuid4()
        transaction_id_2 = uuid4()
        data = {
            "amount": Decimal("100.00"),
            "payment_method": "cash",
            "allocations": [
                {"transaction_id": transaction_id_1, "amount": Decimal("60.00")},
                {"transaction_id": transaction_id_2, "amount": Decimal("50.00")}  # Sum is 110, exceeds 100
            ]
        }
        with pytest.raises(ValidationError) as exc_info:
            PaymentCreateWithAllocations(**data)
        assert "must equal payment amount" in str(exc_info.value).lower()

    def test_payment_single_allocation(self):
        """Test creating a payment with a single allocation."""
        transaction_id = uuid4()
        data = {
            "amount": Decimal("100.00"),
            "payment_method": "cash",
            "allocations": [
                {"transaction_id": transaction_id, "amount": Decimal("100.00")}
            ]
        }
        payment = PaymentCreateWithAllocations(**data)
        assert payment.amount == Decimal("100.00")
        assert len(payment.allocations) == 1
        assert payment.allocations[0].amount == Decimal("100.00")
