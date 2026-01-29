"""
Unit tests for balance management functionality (Task 6.5).

This test suite provides comprehensive coverage for all balance management
methods in the CustomerAccountService, including:
- Balance calculation with all transaction types
- Balance verification and reconciliation
- Available credit calculation
- Credit limit alerts
- Balance adjustments
- get_balance with aging breakdown

Tests validate Requirement 3: Balance Management
"""

import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pytest

from app.models.customer_account import (
    CustomerAccount,
    AccountStatus,
    AccountTransaction,
    TransactionType,
)
from app.services.customer_account_service import CustomerAccountService
from app.schemas.customer_account import AccountBalance


class FakeQuery:
    """Fake query object for testing."""

    def __init__(self, items: List[Any]):
        self._items = list(items)
        self._filters = []
        self._scalar_value = None

    def filter(self, *args, **kwargs):
        """Apply filter."""
        self._filters.append((args, kwargs))
        return self

    def order_by(self, *args, **kwargs):
        """Apply ordering."""
        return self

    def all(self):
        """Return all items."""
        return self._items
    
    def scalar(self):
        """Return scalar value (for aggregate queries)."""
        return self._scalar_value


class FakeSession:
    """Fake database session for testing."""

    def __init__(self, data_by_model: Optional[Dict[Any, List[Any]]] = None):
        self.data_by_model = data_by_model or {}
        self.added: List[Any] = []
        self.commits = 0
        self.refreshed: List[Any] = []

    def query(self, model_or_expr):
        """Create a query for the given model."""
        return FakeQuery(self.data_by_model.get(model_or_expr, []))

    def add(self, obj: Any):
        """Add object to session."""
        self.added.append(obj)

    def commit(self):
        """Commit transaction."""
        self.commits += 1

    def refresh(self, obj: Any):
        """Refresh object from database."""
        self.refreshed.append(obj)


@pytest.fixture
def business_id():
    """Generate a test business ID."""
    return uuid.uuid4()


@pytest.fixture
def customer_id():
    """Generate a test customer ID."""
    return uuid.uuid4()


@pytest.fixture
def user_id():
    """Generate a test user ID."""
    return uuid.uuid4()


def _make_account(
    customer_id: uuid.UUID,
    business_id: uuid.UUID,
    *,
    current_balance: Decimal = Decimal("0"),
    credit_limit: Decimal = Decimal("1000"),
    status: AccountStatus = AccountStatus.ACTIVE,
) -> CustomerAccount:
    """Create a test customer account."""
    account = CustomerAccount(
        id=uuid.uuid4(),
        customer_id=customer_id,
        business_id=business_id,
        account_number="ACC-TEST-00001",
        status=status,
        credit_limit=credit_limit,
        current_balance=current_balance,
        payment_terms=30,
    )
    return account


def _make_transaction(
    account_id: uuid.UUID,
    transaction_type: TransactionType,
    amount: Decimal,
    balance_after: Decimal,
    created_at: Optional[datetime] = None,
    due_date: Optional[datetime] = None,
) -> AccountTransaction:
    """Create a test transaction."""
    return AccountTransaction(
        id=uuid.uuid4(),
        account_id=account_id,
        transaction_type=transaction_type,
        amount=amount,
        balance_after=balance_after,
        created_at=created_at or datetime.utcnow(),
        due_date=due_date,
    )


# ============================================================================
# Balance Calculation with All Transaction Types
# ============================================================================

def test_calculate_balance_with_all_transaction_types(business_id, customer_id):
    """Test balance calculation with charges, payments, adjustments, and write-offs."""
    account = _make_account(customer_id, business_id)
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("500"), Decimal("500")),
        _make_transaction(account.id, TransactionType.PAYMENT, Decimal("100"), Decimal("400")),
        _make_transaction(account.id, TransactionType.ADJUSTMENT, Decimal("50"), Decimal("450")),
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("200"), Decimal("650")),
        _make_transaction(account.id, TransactionType.WRITE_OFF, Decimal("50"), Decimal("600")),
        _make_transaction(account.id, TransactionType.PAYMENT, Decimal("100"), Decimal("500")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    calculated_balance = svc.calculate_balance_from_transactions(account)
    
    # 500 (charge) - 100 (payment) + 50 (adjustment) + 200 (charge) - 50 (write-off) - 100 (payment)
    assert calculated_balance == Decimal("500")


def test_calculate_balance_with_negative_adjustments(business_id, customer_id):
    """Test balance calculation with negative adjustments."""
    account = _make_account(customer_id, business_id)
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("1000"), Decimal("1000")),
        _make_transaction(account.id, TransactionType.ADJUSTMENT, Decimal("-100"), Decimal("900")),
        _make_transaction(account.id, TransactionType.ADJUSTMENT, Decimal("-50"), Decimal("850")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    calculated_balance = svc.calculate_balance_from_transactions(account)
    
    # 1000 (charge) - 100 (adjustment) - 50 (adjustment)
    assert calculated_balance == Decimal("850")


def test_calculate_balance_with_large_numbers(business_id, customer_id):
    """Test balance calculation with large transaction amounts."""
    account = _make_account(customer_id, business_id)
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("999999.99"), Decimal("999999.99")),
        _make_transaction(account.id, TransactionType.PAYMENT, Decimal("500000.00"), Decimal("499999.99")),
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("100000.00"), Decimal("599999.99")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    calculated_balance = svc.calculate_balance_from_transactions(account)
    
    assert calculated_balance == Decimal("599999.99")


def test_calculate_balance_with_decimal_precision(business_id, customer_id):
    """Test balance calculation maintains decimal precision."""
    account = _make_account(customer_id, business_id)
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("100.33"), Decimal("100.33")),
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("200.67"), Decimal("301.00")),
        _make_transaction(account.id, TransactionType.PAYMENT, Decimal("50.25"), Decimal("250.75")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    calculated_balance = svc.calculate_balance_from_transactions(account)
    
    assert calculated_balance == Decimal("250.75")


# ============================================================================
# Balance Verification Tests
# ============================================================================

def test_verify_balance_accuracy_with_tolerance(business_id, customer_id):
    """Test balance verification respects tolerance parameter."""
    account = _make_account(customer_id, business_id, current_balance=Decimal("300.01"))
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("300"), Decimal("300")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    # Should pass with default tolerance (0.01)
    result = svc.verify_balance_accuracy(account)
    assert result['is_accurate'] is True
    assert result['difference'] == Decimal("0.01")


def test_verify_balance_accuracy_exceeds_tolerance(business_id, customer_id):
    """Test balance verification fails when difference exceeds tolerance."""
    account = _make_account(customer_id, business_id, current_balance=Decimal("300.02"))
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("300"), Decimal("300")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    # Should fail with default tolerance (0.01)
    result = svc.verify_balance_accuracy(account)
    assert result['is_accurate'] is False
    assert result['difference'] == Decimal("0.02")


def test_verify_balance_accuracy_custom_tolerance(business_id, customer_id):
    """Test balance verification with custom tolerance."""
    account = _make_account(customer_id, business_id, current_balance=Decimal("300.05"))
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("300"), Decimal("300")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    # Should pass with custom tolerance (0.10)
    result = svc.verify_balance_accuracy(account, tolerance=Decimal("0.10"))
    assert result['is_accurate'] is True
    assert result['difference'] == Decimal("0.05")


# ============================================================================
# Balance Reconciliation Tests
# ============================================================================

def test_recalculate_and_fix_balance_updates_notes(business_id, customer_id, user_id):
    """Test balance reconciliation adds audit note to account."""
    account = _make_account(customer_id, business_id, current_balance=Decimal("250"))
    account.notes = "Existing notes"
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("300"), Decimal("300")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    result = svc.recalculate_and_fix_balance(account, user_id)
    
    assert result['was_fixed'] is True
    assert "Balance reconciliation" in account.notes
    assert "Existing notes" in account.notes
    assert "Old: 250" in account.notes
    assert "New: 300" in account.notes


def test_recalculate_and_fix_balance_no_fix_needed(business_id, customer_id, user_id):
    """Test balance reconciliation when balance is already accurate."""
    account = _make_account(customer_id, business_id, current_balance=Decimal("300"))
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("300"), Decimal("300")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    result = svc.recalculate_and_fix_balance(account, user_id)
    
    assert result['was_fixed'] is False
    assert result['old_balance'] == Decimal("300")
    assert result['new_balance'] == Decimal("300")
    assert result['adjustment_amount'] == Decimal("0")


def test_recalculate_and_fix_balance_with_custom_reason(business_id, customer_id, user_id):
    """Test balance reconciliation with custom reason."""
    account = _make_account(customer_id, business_id, current_balance=Decimal("250"))
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("300"), Decimal("300")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    custom_reason = "Monthly audit correction"
    result = svc.recalculate_and_fix_balance(account, user_id, reason=custom_reason)
    
    assert result['was_fixed'] is True
    assert custom_reason in account.notes


# ============================================================================
# get_balance Tests
# ============================================================================

def test_get_balance_returns_account_balance_object(business_id, customer_id):
    """Test get_balance returns AccountBalance schema."""
    account = _make_account(
        customer_id,
        business_id,
        current_balance=Decimal("500"),
        credit_limit=Decimal("1000"),
    )
    
    db = FakeSession(data_by_model={AccountTransaction: []})
    svc = CustomerAccountService(db)
    
    balance = svc.get_balance(account)
    
    assert isinstance(balance, AccountBalance)
    assert balance.account_id == account.id
    assert balance.current_balance == Decimal("500")
    assert balance.credit_limit == Decimal("1000")
    assert balance.available_credit == Decimal("500")


def test_get_balance_calculates_credit_utilization(business_id, customer_id):
    """Test get_balance includes credit utilization percentage."""
    account = _make_account(
        customer_id,
        business_id,
        current_balance=Decimal("750"),
        credit_limit=Decimal("1000"),
    )
    
    db = FakeSession(data_by_model={AccountTransaction: []})
    svc = CustomerAccountService(db)
    
    balance = svc.get_balance(account)
    
    assert balance.credit_utilization == 75.0


def test_get_balance_detects_over_limit_status(business_id, customer_id):
    """Test get_balance correctly identifies over-limit accounts."""
    account = _make_account(
        customer_id,
        business_id,
        current_balance=Decimal("1200"),
        credit_limit=Decimal("1000"),
    )
    
    db = FakeSession(data_by_model={AccountTransaction: []})
    svc = CustomerAccountService(db)
    
    balance = svc.get_balance(account)
    
    assert balance.is_over_limit is True
    assert balance.available_credit == Decimal("-200")


def test_get_balance_with_aging_breakdown(business_id, customer_id):
    """Test get_balance includes aging breakdown when requested."""
    account = _make_account(customer_id, business_id, current_balance=Decimal("500"))
    
    # Create transactions with different due dates
    now = datetime.utcnow()
    transactions = [
        _make_transaction(
            account.id,
            TransactionType.CHARGE,
            Decimal("100"),
            Decimal("100"),
            created_at=now - timedelta(days=5),
            due_date=(now - timedelta(days=5)).date(),
        ),
        _make_transaction(
            account.id,
            TransactionType.CHARGE,
            Decimal("150"),
            Decimal("250"),
            created_at=now - timedelta(days=35),
            due_date=(now - timedelta(days=35)).date(),
        ),
        _make_transaction(
            account.id,
            TransactionType.CHARGE,
            Decimal("250"),
            Decimal("500"),
            created_at=now - timedelta(days=65),
            due_date=(now - timedelta(days=65)).date(),
        ),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    balance = svc.get_balance(account, include_aging=True)
    
    assert balance.aging is not None
    # Aging is returned as a dict
    assert isinstance(balance.aging, dict)
    assert 'total' in balance.aging


def test_get_balance_without_aging_breakdown(business_id, customer_id):
    """Test get_balance excludes aging when not requested."""
    account = _make_account(customer_id, business_id, current_balance=Decimal("500"))
    
    db = FakeSession(data_by_model={AccountTransaction: []})
    svc = CustomerAccountService(db)
    
    balance = svc.get_balance(account, include_aging=False)
    
    assert balance.aging is None


# ============================================================================
# Available Credit Calculation Tests
# ============================================================================

def test_available_credit_with_zero_balance(business_id, customer_id):
    """Test available credit equals credit limit when balance is zero."""
    account = _make_account(
        customer_id,
        business_id,
        current_balance=Decimal("0"),
        credit_limit=Decimal("1000"),
    )
    
    db = FakeSession(data_by_model={AccountTransaction: []})
    svc = CustomerAccountService(db)
    
    balance = svc.get_balance(account)
    
    assert balance.available_credit == Decimal("1000")


def test_available_credit_with_partial_balance(business_id, customer_id):
    """Test available credit calculation with partial balance."""
    account = _make_account(
        customer_id,
        business_id,
        current_balance=Decimal("300"),
        credit_limit=Decimal("1000"),
    )
    
    db = FakeSession(data_by_model={AccountTransaction: []})
    svc = CustomerAccountService(db)
    
    balance = svc.get_balance(account)
    
    assert balance.available_credit == Decimal("700")


def test_available_credit_at_limit(business_id, customer_id):
    """Test available credit is zero when at credit limit."""
    account = _make_account(
        customer_id,
        business_id,
        current_balance=Decimal("1000"),
        credit_limit=Decimal("1000"),
    )
    
    db = FakeSession(data_by_model={AccountTransaction: []})
    svc = CustomerAccountService(db)
    
    balance = svc.get_balance(account)
    
    assert balance.available_credit == Decimal("0")
    assert balance.credit_utilization == 100.0


def test_available_credit_over_limit(business_id, customer_id):
    """Test available credit is negative when over limit."""
    account = _make_account(
        customer_id,
        business_id,
        current_balance=Decimal("1500"),
        credit_limit=Decimal("1000"),
    )
    
    db = FakeSession(data_by_model={AccountTransaction: []})
    svc = CustomerAccountService(db)
    
    balance = svc.get_balance(account)
    
    assert balance.available_credit == Decimal("-500")
    assert balance.is_over_limit is True


# ============================================================================
# Edge Cases and Boundary Tests
# ============================================================================

def test_balance_calculation_with_empty_transaction_list(business_id, customer_id):
    """Test balance calculation handles empty transaction list gracefully."""
    account = _make_account(customer_id, business_id, current_balance=Decimal("100"))
    
    db = FakeSession(data_by_model={AccountTransaction: []})
    svc = CustomerAccountService(db)
    
    calculated_balance = svc.calculate_balance_from_transactions(account)
    
    assert calculated_balance == Decimal("0")


def test_get_balance_with_zero_credit_limit(business_id, customer_id):
    """Test get_balance handles zero credit limit."""
    account = _make_account(
        customer_id,
        business_id,
        current_balance=Decimal("0"),
        credit_limit=Decimal("0"),
    )
    
    db = FakeSession(data_by_model={AccountTransaction: []})
    svc = CustomerAccountService(db)
    
    balance = svc.get_balance(account)
    
    assert balance.credit_limit == Decimal("0")
    assert balance.available_credit == Decimal("0")


def test_balance_calculation_preserves_decimal_places(business_id, customer_id):
    """Test balance calculation preserves two decimal places."""
    account = _make_account(customer_id, business_id)
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("10.99"), Decimal("10.99")),
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("20.01"), Decimal("31.00")),
        _make_transaction(account.id, TransactionType.PAYMENT, Decimal("5.50"), Decimal("25.50")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    calculated_balance = svc.calculate_balance_from_transactions(account)
    
    assert calculated_balance == Decimal("25.50")
    # Verify it has exactly 2 decimal places
    assert calculated_balance.as_tuple().exponent == -2


def test_get_balance_with_suspended_account(business_id, customer_id):
    """Test get_balance works for suspended accounts."""
    account = _make_account(
        customer_id,
        business_id,
        current_balance=Decimal("500"),
        credit_limit=Decimal("1000"),
        status=AccountStatus.SUSPENDED,
    )
    
    db = FakeSession(data_by_model={AccountTransaction: []})
    svc = CustomerAccountService(db)
    
    balance = svc.get_balance(account)
    
    assert balance.current_balance == Decimal("500")
    assert balance.available_credit == Decimal("500")


def test_get_balance_with_pending_account(business_id, customer_id):
    """Test get_balance works for pending accounts."""
    account = _make_account(
        customer_id,
        business_id,
        current_balance=Decimal("0"),
        credit_limit=Decimal("1000"),
        status=AccountStatus.PENDING,
    )
    
    db = FakeSession(data_by_model={AccountTransaction: []})
    svc = CustomerAccountService(db)
    
    balance = svc.get_balance(account)
    
    assert balance.current_balance == Decimal("0")
    assert balance.available_credit == Decimal("1000")


# ============================================================================
# Integration Tests - Multiple Operations
# ============================================================================

def test_balance_accuracy_after_multiple_operations(business_id, customer_id, user_id):
    """Test balance remains accurate after multiple charge and payment operations."""
    account = _make_account(customer_id, business_id, current_balance=Decimal("0"))
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("100"), Decimal("100")),
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("200"), Decimal("300")),
        _make_transaction(account.id, TransactionType.PAYMENT, Decimal("50"), Decimal("250")),
        _make_transaction(account.id, TransactionType.ADJUSTMENT, Decimal("25"), Decimal("275")),
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("100"), Decimal("375")),
        _make_transaction(account.id, TransactionType.PAYMENT, Decimal("75"), Decimal("300")),
    ]
    
    # Update account balance to match final transaction
    account.current_balance = Decimal("300")
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    # Verify balance is accurate
    verification = svc.verify_balance_accuracy(account)
    assert verification['is_accurate'] is True
    assert verification['stored_balance'] == Decimal("300")
    assert verification['calculated_balance'] == Decimal("300")
    
    # Get balance info
    balance = svc.get_balance(account)
    assert balance.current_balance == Decimal("300")
    assert balance.available_credit == Decimal("700")


def test_balance_reconciliation_workflow(business_id, customer_id, user_id):
    """Test complete balance reconciliation workflow."""
    # Start with incorrect balance
    account = _make_account(customer_id, business_id, current_balance=Decimal("250"))
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("500"), Decimal("500")),
        _make_transaction(account.id, TransactionType.PAYMENT, Decimal("200"), Decimal("300")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    # Step 1: Verify balance is inaccurate
    verification = svc.verify_balance_accuracy(account)
    assert verification['is_accurate'] is False
    assert verification['difference'] == Decimal("50")
    
    # Step 2: Fix the balance
    fix_result = svc.recalculate_and_fix_balance(account, user_id, reason="Monthly reconciliation")
    assert fix_result['was_fixed'] is True
    assert fix_result['old_balance'] == Decimal("250")
    assert fix_result['new_balance'] == Decimal("300")
    
    # Step 3: Verify balance is now accurate
    verification_after = svc.verify_balance_accuracy(account)
    assert verification_after['is_accurate'] is True
    
    # Step 4: Get balance info
    balance = svc.get_balance(account)
    assert balance.current_balance == Decimal("300")
