"""Unit tests for CustomerAccountService."""

import uuid
from decimal import Decimal
from datetime import datetime
from typing import Any, Dict, List, Optional

import pytest

from app.models.customer_account import (
    CustomerAccount,
    AccountStatus,
    TransactionType,
)
from app.models.customer import Customer
from app.schemas.customer_account import (
    AccountCreate,
)
from app.services.customer_account_service import CustomerAccountService


class FakeQuery:
    """Fake query object for testing."""

    def __init__(self, items: List[Any]):
        self._items = list(items)
        self._filters = []
        self._offset = 0
        self._limit = None

    def filter(self, *args, **kwargs):
        """Apply filter (stores for inspection but doesn't actually filter)."""
        self._filters.append((args, kwargs))
        return self

    def count(self):
        """Return count of items."""
        return len(self._items)

    def order_by(self, *args, **kwargs):
        """Apply ordering."""
        return self

    def offset(self, n: int):
        """Apply offset."""
        self._offset = n
        return self

    def limit(self, n: int):
        """Apply limit."""
        self._limit = n
        return self

    def all(self):
        """Return all items."""
        items = self._items[self._offset:]
        if self._limit is not None:
            items = items[:self._limit]
        return items

    def first(self):
        """Return first item or None."""
        return self._items[0] if self._items else None

    def scalar(self):
        """Return scalar value (for count queries)."""
        if not self._items:
            return 0
        return self._items[0] if isinstance(self._items[0], (int, float)) else len(self._items)


class FakeSession:
    """Fake database session for testing."""

    def __init__(self, data_by_model: Optional[Dict[Any, List[Any]]] = None):
        self.data_by_model = data_by_model or {}
        self.added: List[Any] = []
        self.deleted: List[Any] = []
        self.commits = 0
        self.refreshed: List[Any] = []

    def query(self, model_or_expr):
        """Create a query for the given model."""
        return FakeQuery(self.data_by_model.get(model_or_expr, []))

    def add(self, obj: Any):
        """Add object to session."""
        if getattr(obj, "id", None) is None:
            try:
                obj.id = uuid.uuid4()
            except Exception:
                pass
        self.added.append(obj)

    def delete(self, obj: Any):
        """Delete object from session."""
        self.deleted.append(obj)

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


def _make_customer(customer_id: uuid.UUID, business_id: uuid.UUID) -> Customer:
    """Create a test customer."""
    customer = Customer(
        id=customer_id,
        business_id=business_id,
        first_name="Test",
        last_name="Customer",
        email="test@example.com",
        phone=None,
    )
    return customer


def _make_account(
    customer_id: uuid.UUID,
    business_id: uuid.UUID,
    *,
    status: AccountStatus = AccountStatus.ACTIVE,
    credit_limit: Decimal = Decimal("1000"),
    current_balance: Decimal = Decimal("0"),
    account_number: str = "ACC-TEST-00001",
) -> CustomerAccount:
    """Create a test customer account."""
    account = CustomerAccount(
        id=uuid.uuid4(),
        customer_id=customer_id,
        business_id=business_id,
        account_number=account_number,
        status=status,
        credit_limit=credit_limit,
        current_balance=current_balance,
        payment_terms=30,
        account_pin=None,
        notes=None,
        opened_at=datetime.utcnow() if status == AccountStatus.ACTIVE else None,
        suspended_at=None,
        closed_at=None,
    )
    return account


# ============================================================================
# Account Creation Tests
# ============================================================================

def test_create_account_generates_unique_number(business_id, customer_id):
    """Test that account creation generates a unique account number."""
    customer = _make_customer(customer_id, business_id)
    db = FakeSession(data_by_model={
        Customer: [customer],
        CustomerAccount: [],  # No existing accounts
    })
    svc = CustomerAccountService(db)

    account_data = AccountCreate(
        customer_id=customer_id,
        credit_limit=Decimal("5000"),
        payment_terms=30,
    )

    account = svc.create_account(business_id, account_data)

    assert db.commits >= 1
    assert account.account_number.startswith("ACC-")
    assert account.business_id == business_id
    assert account.customer_id == customer_id
    assert account.credit_limit == Decimal("5000")
    assert account.current_balance == Decimal("0")
    assert account.status == AccountStatus.PENDING


def test_create_account_raises_if_customer_not_found(business_id, customer_id):
    """Test that account creation fails if customer doesn't exist."""
    db = FakeSession(data_by_model={
        Customer: [],  # No customers
        CustomerAccount: [],
    })
    svc = CustomerAccountService(db)

    account_data = AccountCreate(
        customer_id=customer_id,
        credit_limit=Decimal("5000"),
        payment_terms=30,
    )

    with pytest.raises(ValueError, match="not found"):
        svc.create_account(business_id, account_data)


def test_create_account_raises_if_account_exists(business_id, customer_id):
    """Test that account creation fails if customer already has an account."""
    customer = _make_customer(customer_id, business_id)
    existing_account = _make_account(customer_id, business_id)
    
    db = FakeSession(data_by_model={
        Customer: [customer],
        CustomerAccount: [existing_account],
    })
    svc = CustomerAccountService(db)

    account_data = AccountCreate(
        customer_id=customer_id,
        credit_limit=Decimal("5000"),
        payment_terms=30,
    )

    with pytest.raises(ValueError, match="already has an account"):
        svc.create_account(business_id, account_data)


# ============================================================================
# Credit Validation Tests
# ============================================================================

def test_validate_credit_succeeds_for_valid_charge(business_id, customer_id):
    """Test that credit validation succeeds for valid charge."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("200"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    validation = svc.validate_credit(account, Decimal("500"))

    assert validation.is_valid is True
    assert validation.available_credit == Decimal("800")
    assert validation.requested_amount == Decimal("500")
    assert "successful" in validation.message.lower()


def test_validate_credit_fails_for_inactive_account(business_id, customer_id):
    """Test that credit validation fails for inactive account."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.SUSPENDED,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("200"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    validation = svc.validate_credit(account, Decimal("500"))

    assert validation.is_valid is False
    assert "suspended" in validation.message.lower()


def test_validate_credit_fails_for_negative_amount(business_id, customer_id):
    """Test that credit validation fails for negative amount."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("200"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    validation = svc.validate_credit(account, Decimal("-100"))

    assert validation.is_valid is False
    assert "positive" in validation.message.lower()


def test_validate_credit_fails_for_insufficient_credit(business_id, customer_id):
    """Test that credit validation fails when exceeding available credit."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("900"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    validation = svc.validate_credit(account, Decimal("200"))

    assert validation.is_valid is False
    assert "insufficient" in validation.message.lower()
    assert validation.available_credit == Decimal("100")


# ============================================================================
# Charge to Account Tests
# ============================================================================

def test_charge_to_account_creates_transaction_and_updates_balance(
    business_id, customer_id, user_id
):
    """Test that charging to account creates transaction and updates balance."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("200"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    transaction = svc.charge_to_account(
        account=account,
        amount=Decimal("150"),
        user_id=user_id,
        reference_type="order",
        reference_id=uuid.uuid4(),
        description="Test charge",
    )

    # Verify transaction was created
    assert transaction in db.added
    assert transaction.transaction_type == TransactionType.CHARGE
    assert transaction.amount == Decimal("150")
    assert transaction.balance_after == Decimal("350")
    assert transaction.account_id == account.id
    assert transaction.created_by == user_id
    assert transaction.reference_type == "order"
    assert transaction.description == "Test charge"

    # Verify account balance was updated
    assert account.current_balance == Decimal("350")

    # Verify commit was called
    assert db.commits >= 1


def test_charge_to_account_raises_for_insufficient_credit(
    business_id, customer_id, user_id
):
    """Test that charging to account fails when exceeding credit limit."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("900"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    with pytest.raises(ValueError, match="Insufficient credit"):
        svc.charge_to_account(
            account=account,
            amount=Decimal("200"),
            user_id=user_id,
        )

    # Verify no transaction was created
    assert len(db.added) == 0
    # Verify balance was not updated
    assert account.current_balance == Decimal("900")


def test_charge_to_account_raises_for_inactive_account(
    business_id, customer_id, user_id
):
    """Test that charging to account fails for inactive account."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.SUSPENDED,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("200"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    with pytest.raises(ValueError, match="suspended"):
        svc.charge_to_account(
            account=account,
            amount=Decimal("100"),
            user_id=user_id,
        )

    # Verify no transaction was created
    assert len(db.added) == 0


def test_charge_to_account_raises_for_negative_amount(
    business_id, customer_id, user_id
):
    """Test that charging to account fails for negative amount."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("200"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    with pytest.raises(ValueError, match="positive"):
        svc.charge_to_account(
            account=account,
            amount=Decimal("-50"),
            user_id=user_id,
        )

    # Verify no transaction was created
    assert len(db.added) == 0


def test_charge_to_account_with_due_date(business_id, customer_id, user_id):
    """Test that charging to account can include a due date."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("200"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    due_date = datetime(2024, 12, 31)
    transaction = svc.charge_to_account(
        account=account,
        amount=Decimal("100"),
        user_id=user_id,
        due_date=due_date,
    )

    assert transaction.due_date == due_date


def test_charge_to_account_updates_balance_correctly_with_multiple_charges(
    business_id, customer_id, user_id
):
    """Test that multiple charges update balance correctly."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("0"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    # First charge
    transaction1 = svc.charge_to_account(
        account=account,
        amount=Decimal("100"),
        user_id=user_id,
    )
    assert transaction1.balance_after == Decimal("100")
    assert account.current_balance == Decimal("100")

    # Second charge
    transaction2 = svc.charge_to_account(
        account=account,
        amount=Decimal("200"),
        user_id=user_id,
    )
    assert transaction2.balance_after == Decimal("300")
    assert account.current_balance == Decimal("300")

    # Third charge
    transaction3 = svc.charge_to_account(
        account=account,
        amount=Decimal("150"),
        user_id=user_id,
    )
    assert transaction3.balance_after == Decimal("450")
    assert account.current_balance == Decimal("450")


# ============================================================================
# Account Status Management Tests
# ============================================================================

def test_activate_account_sets_status_and_opened_date(business_id, customer_id):
    """Test that activating an account sets status and opened date."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.PENDING,
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    activated = svc.activate_account(account)

    assert activated.status == AccountStatus.ACTIVE
    assert activated.opened_at is not None
    assert db.commits >= 1


def test_suspend_account_sets_status_and_suspended_date(business_id, customer_id):
    """Test that suspending an account sets status and suspended date."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    suspended = svc.suspend_account(account, reason="Payment overdue")

    assert suspended.status == AccountStatus.SUSPENDED
    assert suspended.suspended_at is not None
    assert "Payment overdue" in suspended.notes
    assert db.commits >= 1


def test_close_account_raises_if_balance_outstanding(business_id, customer_id):
    """Test that closing an account fails if balance is outstanding."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        current_balance=Decimal("100"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    with pytest.raises(ValueError, match="outstanding balance"):
        svc.close_account(account)


def test_close_account_succeeds_with_zero_balance(business_id, customer_id):
    """Test that closing an account succeeds with zero balance."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        current_balance=Decimal("0"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    closed = svc.close_account(account, reason="Customer request")

    assert closed.status == AccountStatus.CLOSED
    assert closed.closed_at is not None
    assert "Customer request" in closed.notes
    assert db.commits >= 1
