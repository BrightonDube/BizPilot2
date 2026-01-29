"""Unit tests for balance calculation functionality (Task 6.1)."""

import uuid
from decimal import Decimal
from datetime import datetime
from typing import Any, Dict, List, Optional

import pytest

from app.models.customer_account import (
    CustomerAccount,
    AccountStatus,
    AccountTransaction,
    TransactionType,
)
from app.services.customer_account_service import CustomerAccountService


class FakeQuery:
    """Fake query object for testing."""

    def __init__(self, items: List[Any]):
        self._items = list(items)
        self._filters = []

    def filter(self, *args, **kwargs):
        """Apply filter."""
        self._filters.append((args, kwargs))
        return self

    def all(self):
        """Return all items."""
        return self._items


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
) -> CustomerAccount:
    """Create a test customer account."""
    account = CustomerAccount(
        id=uuid.uuid4(),
        customer_id=customer_id,
        business_id=business_id,
        account_number="ACC-TEST-00001",
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=current_balance,
        payment_terms=30,
    )
    return account


def _make_transaction(
    account_id: uuid.UUID,
    transaction_type: TransactionType,
    amount: Decimal,
    balance_after: Decimal,
) -> AccountTransaction:
    """Create a test transaction."""
    return AccountTransaction(
        id=uuid.uuid4(),
        account_id=account_id,
        transaction_type=transaction_type,
        amount=amount,
        balance_after=balance_after,
        created_at=datetime.utcnow(),
    )


# ============================================================================
# Balance Calculation Tests
# ============================================================================

def test_calculate_balance_from_transactions_with_no_transactions(business_id, customer_id):
    """Test balance calculation with no transactions returns zero."""
    account = _make_account(customer_id, business_id)
    db = FakeSession(data_by_model={AccountTransaction: []})
    svc = CustomerAccountService(db)
    
    calculated_balance = svc.calculate_balance_from_transactions(account)
    
    assert calculated_balance == Decimal("0")


def test_calculate_balance_from_transactions_with_only_charges(business_id, customer_id):
    """Test balance calculation with only charge transactions."""
    account = _make_account(customer_id, business_id, current_balance=Decimal("500"))
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("100"), Decimal("100")),
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("200"), Decimal("300")),
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("200"), Decimal("500")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    calculated_balance = svc.calculate_balance_from_transactions(account)
    
    assert calculated_balance == Decimal("500")


def test_calculate_balance_from_transactions_with_charges_and_payments(business_id, customer_id):
    """Test balance calculation with both charges and payments."""
    account = _make_account(customer_id, business_id, current_balance=Decimal("200"))
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("500"), Decimal("500")),
        _make_transaction(account.id, TransactionType.PAYMENT, Decimal("200"), Decimal("300")),
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("100"), Decimal("400")),
        _make_transaction(account.id, TransactionType.PAYMENT, Decimal("200"), Decimal("200")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    calculated_balance = svc.calculate_balance_from_transactions(account)
    
    assert calculated_balance == Decimal("200")


def test_verify_balance_accuracy_when_accurate(business_id, customer_id):
    """Test balance verification when stored balance matches calculated balance."""
    account = _make_account(customer_id, business_id, current_balance=Decimal("300"))
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("500"), Decimal("500")),
        _make_transaction(account.id, TransactionType.PAYMENT, Decimal("200"), Decimal("300")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    result = svc.verify_balance_accuracy(account)
    
    assert result['is_accurate'] is True
    assert result['stored_balance'] == Decimal("300")
    assert result['calculated_balance'] == Decimal("300")
    assert result['difference'] == Decimal("0")


def test_verify_balance_accuracy_when_inaccurate(business_id, customer_id):
    """Test balance verification when stored balance doesn't match calculated balance."""
    account = _make_account(customer_id, business_id, current_balance=Decimal("250"))
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("500"), Decimal("500")),
        _make_transaction(account.id, TransactionType.PAYMENT, Decimal("200"), Decimal("300")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    result = svc.verify_balance_accuracy(account)
    
    assert result['is_accurate'] is False
    assert result['stored_balance'] == Decimal("250")
    assert result['calculated_balance'] == Decimal("300")
    assert result['difference'] == Decimal("50")


def test_recalculate_and_fix_balance_when_inaccurate(business_id, customer_id, user_id):
    """Test balance reconciliation fixes inaccurate balance."""
    account = _make_account(customer_id, business_id, current_balance=Decimal("250"))
    
    transactions = [
        _make_transaction(account.id, TransactionType.CHARGE, Decimal("500"), Decimal("500")),
        _make_transaction(account.id, TransactionType.PAYMENT, Decimal("200"), Decimal("300")),
    ]
    
    db = FakeSession(data_by_model={AccountTransaction: transactions})
    svc = CustomerAccountService(db)
    
    result = svc.recalculate_and_fix_balance(account, user_id)
    
    assert result['was_fixed'] is True
    assert result['old_balance'] == Decimal("250")
    assert result['new_balance'] == Decimal("300")
    assert account.current_balance == Decimal("300")
    assert db.commits >= 1
