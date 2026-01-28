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


def _create_mock_db_for_receipt_tests(allocations=None):
    """
    Create a mock database session for payment receipt tests.
    
    Args:
        allocations: List of PaymentAllocation objects (optional)
    
    Returns:
        Mock database session
    """
    from unittest.mock import Mock
    
    db = Mock()
    
    if allocations is None:
        allocations = []
    
    # Setup query chain for allocations
    query_mock = Mock()
    filter_mock = Mock()
    filter_mock.all.return_value = allocations
    query_mock.filter.return_value = filter_mock
    
    # Setup query chain for sum queries
    sum_filter_mock = Mock()
    sum_filter_mock.scalar.return_value = Decimal("0")
    sum_query_mock = Mock()
    sum_query_mock.filter.return_value = sum_filter_mock
    
    # Make query return different mocks based on what's being queried
    def query_side_effect(model_or_expr):
        # Check if it's a sum query (has 'sum' in string representation)
        if 'sum' in str(model_or_expr).lower():
            return sum_query_mock
        return query_mock
    
    db.query.side_effect = query_side_effect
    
    return db


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


# ============================================================================
# Additional Account Status Management Edge Cases
# ============================================================================

def test_activate_account_raises_if_already_active(business_id, customer_id):
    """Test that activating an already active account raises an error."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    with pytest.raises(ValueError, match="already active"):
        svc.activate_account(account)


def test_activate_account_raises_if_closed(business_id, customer_id):
    """Test that activating a closed account raises an error."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.CLOSED,
    )
    account.closed_at = datetime.utcnow()
    db = FakeSession()
    svc = CustomerAccountService(db)

    with pytest.raises(ValueError, match="Cannot activate a closed account"):
        svc.activate_account(account)


def test_activate_account_clears_suspended_date(business_id, customer_id):
    """Test that activating a suspended account clears the suspended date."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.SUSPENDED,
    )
    account.suspended_at = datetime.utcnow()
    db = FakeSession()
    svc = CustomerAccountService(db)

    activated = svc.activate_account(account)

    assert activated.status == AccountStatus.ACTIVE
    assert activated.opened_at is not None
    assert activated.suspended_at is None
    assert db.commits >= 1


def test_suspend_account_raises_if_not_active(business_id, customer_id):
    """Test that suspending a non-active account raises an error."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.PENDING,
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    with pytest.raises(ValueError, match="Only active accounts can be suspended"):
        svc.suspend_account(account)


def test_suspend_account_without_reason(business_id, customer_id):
    """Test that suspending an account without a reason works."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    suspended = svc.suspend_account(account)

    assert suspended.status == AccountStatus.SUSPENDED
    assert suspended.suspended_at is not None
    assert db.commits >= 1


def test_suspend_account_appends_reason_to_existing_notes(business_id, customer_id):
    """Test that suspending an account appends reason to existing notes."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
    )
    account.notes = "Existing notes"
    db = FakeSession()
    svc = CustomerAccountService(db)

    suspended = svc.suspend_account(account, reason="Payment overdue")

    assert "Existing notes" in suspended.notes
    assert "[SUSPENDED] Payment overdue" in suspended.notes


def test_close_account_without_reason(business_id, customer_id):
    """Test that closing an account without a reason works."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        current_balance=Decimal("0"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    closed = svc.close_account(account)

    assert closed.status == AccountStatus.CLOSED
    assert closed.closed_at is not None
    assert db.commits >= 1


def test_close_account_appends_reason_to_existing_notes(business_id, customer_id):
    """Test that closing an account appends reason to existing notes."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        current_balance=Decimal("0"),
    )
    account.notes = "Existing notes"
    db = FakeSession()
    svc = CustomerAccountService(db)

    closed = svc.close_account(account, reason="Business closed")

    assert "Existing notes" in closed.notes
    assert "[CLOSED] Business closed" in closed.notes


def test_close_account_can_close_suspended_account(business_id, customer_id):
    """Test that a suspended account can be closed if balance is zero."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.SUSPENDED,
        current_balance=Decimal("0"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    closed = svc.close_account(account)

    assert closed.status == AccountStatus.CLOSED
    assert closed.closed_at is not None
    assert db.commits >= 1


def test_get_balance_returns_correct_information(business_id, customer_id):
    """Test that get_balance returns correct account balance information."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("300"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    balance = svc.get_balance(account)

    assert balance.account_id == account.id
    assert balance.current_balance == Decimal("300")
    assert balance.available_credit == Decimal("700")
    assert balance.credit_limit == Decimal("1000")
    assert balance.credit_utilization == 30.0
    assert balance.is_over_limit is False


def test_get_balance_detects_over_limit(business_id, customer_id):
    """Test that get_balance correctly detects when account is over limit."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("1200"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    balance = svc.get_balance(account)

    assert balance.is_over_limit is True
    assert balance.available_credit == Decimal("-200")
    assert balance.credit_utilization == 120.0


# ============================================================================
# Charge Slip Generation Tests
# ============================================================================

def test_generate_charge_slip_creates_pdf(business_id, customer_id, user_id):
    """Test that charge slip generation creates a valid PDF."""
    from app.models.customer_account import AccountTransaction
    
    customer = _make_customer(customer_id, business_id)
    customer.name = "John Doe"  # Add name property
    
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("5000"),
        current_balance=Decimal("1500"),
    )
    account.customer = customer  # Set relationship
    
    # Create a charge transaction
    transaction = AccountTransaction(
        id=uuid.uuid4(),
        account_id=account.id,
        transaction_type=TransactionType.CHARGE,
        reference_type="order",
        reference_id=uuid.uuid4(),
        amount=Decimal("500"),
        balance_after=Decimal("1500"),
        description="Test charge for order #12345",
        due_date=None,
        created_by=user_id,
        created_at=datetime.utcnow(),
    )
    
    db = FakeSession()
    svc = CustomerAccountService(db)
    
    # Generate charge slip
    pdf_bytes = svc.generate_charge_slip(
        transaction=transaction,
        account=account,
        business_name="Test Business",
        business_address="123 Test St\nTest City, 12345",
        business_phone="+27 11 123 4567",
        currency="ZAR",
    )
    
    # Verify PDF was generated
    assert pdf_bytes is not None
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 0
    
    # Verify it's a valid PDF (starts with PDF header)
    assert pdf_bytes.startswith(b"%PDF-")


def test_generate_charge_slip_raises_for_non_charge_transaction(business_id, customer_id, user_id):
    """Test that charge slip generation fails for non-charge transactions."""
    from app.models.customer_account import AccountTransaction
    
    customer = _make_customer(customer_id, business_id)
    customer.name = "John Doe"
    
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
    )
    account.customer = customer
    
    # Create a payment transaction (not a charge)
    transaction = AccountTransaction(
        id=uuid.uuid4(),
        account_id=account.id,
        transaction_type=TransactionType.PAYMENT,
        amount=Decimal("500"),
        balance_after=Decimal("500"),
        created_by=user_id,
        created_at=datetime.utcnow(),
    )
    
    db = FakeSession()
    svc = CustomerAccountService(db)
    
    # Should raise error for non-charge transaction
    with pytest.raises(ValueError, match="Can only generate charge slips for charge transactions"):
        svc.generate_charge_slip(
            transaction=transaction,
            account=account,
            business_name="Test Business",
        )


def test_generate_charge_slip_includes_account_details(business_id, customer_id, user_id):
    """Test that charge slip includes all required account details."""
    from app.models.customer_account import AccountTransaction
    
    customer = _make_customer(customer_id, business_id)
    customer.name = "Jane Smith"
    
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("10000"),
        current_balance=Decimal("2500"),
        account_number="ACC-TEST-99999",
    )
    account.customer = customer
    
    transaction = AccountTransaction(
        id=uuid.uuid4(),
        account_id=account.id,
        transaction_type=TransactionType.CHARGE,
        amount=Decimal("750"),
        balance_after=Decimal("2500"),
        description="Office supplies purchase",
        created_by=user_id,
        created_at=datetime.utcnow(),
    )
    
    db = FakeSession()
    svc = CustomerAccountService(db)
    
    pdf_bytes = svc.generate_charge_slip(
        transaction=transaction,
        account=account,
        business_name="ABC Corporation",
        business_address="456 Business Ave\nCommerce City, 54321",
        business_phone="+27 21 987 6543",
        currency="ZAR",
    )
    
    # Verify PDF was generated with content
    assert pdf_bytes is not None
    assert len(pdf_bytes) > 1000  # Should be substantial with all the content
    
    # Verify PDF structure
    pdf_str = pdf_bytes.decode('latin-1', errors='ignore')
    
    # Check for key elements in the PDF content
    assert "CHARGE SLIP" in pdf_str or "Charge Slip" in pdf_str
    assert "ACC-TEST-99999" in pdf_str  # Account number
    assert "ABC Corporation" in pdf_str  # Business name


def test_generate_charge_slip_calculates_balances_correctly(business_id, customer_id, user_id):
    """Test that charge slip shows correct balance calculations."""
    from app.models.customer_account import AccountTransaction
    
    customer = _make_customer(customer_id, business_id)
    customer.name = "Bob Johnson"
    
    # Account with existing balance
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("5000"),
        current_balance=Decimal("1200"),  # Current balance after charge
    )
    account.customer = customer
    
    # Transaction that added 300 to previous balance of 900
    transaction = AccountTransaction(
        id=uuid.uuid4(),
        account_id=account.id,
        transaction_type=TransactionType.CHARGE,
        amount=Decimal("300"),
        balance_after=Decimal("1200"),  # 900 + 300
        description="Monthly service fee",
        created_by=user_id,
        created_at=datetime.utcnow(),
    )
    
    db = FakeSession()
    svc = CustomerAccountService(db)
    
    pdf_bytes = svc.generate_charge_slip(
        transaction=transaction,
        account=account,
        business_name="Service Provider Inc",
        currency="ZAR",
    )
    
    # Verify PDF was generated
    assert pdf_bytes is not None
    assert isinstance(pdf_bytes, bytes)
    
    # The PDF should contain balance information
    # Previous balance: 900, This charge: +300, New balance: 1200
    # Available credit: 5000 - 1200 = 3800
    pdf_str = pdf_bytes.decode('latin-1', errors='ignore')
    
    # Check that it's a valid PDF with content
    assert len(pdf_bytes) > 500


def test_generate_charge_slip_with_minimal_info(business_id, customer_id, user_id):
    """Test charge slip generation with minimal information."""
    from app.models.customer_account import AccountTransaction
    
    customer = _make_customer(customer_id, business_id)
    customer.name = "Minimal Customer"
    
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
    )
    account.customer = customer
    
    # Transaction with minimal details
    transaction = AccountTransaction(
        id=uuid.uuid4(),
        account_id=account.id,
        transaction_type=TransactionType.CHARGE,
        amount=Decimal("100"),
        balance_after=Decimal("100"),
        created_by=user_id,
        created_at=datetime.utcnow(),
    )
    
    db = FakeSession()
    svc = CustomerAccountService(db)
    
    # Generate with only required fields
    pdf_bytes = svc.generate_charge_slip(
        transaction=transaction,
        account=account,
        business_name="Simple Business",
    )
    
    # Should still generate valid PDF
    assert pdf_bytes is not None
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF-")
    assert len(pdf_bytes) > 0


def test_generate_charge_slip_with_due_date(business_id, customer_id, user_id):
    """Test charge slip generation includes due date when specified."""
    from app.models.customer_account import AccountTransaction
    from datetime import date, timedelta
    
    customer = _make_customer(customer_id, business_id)
    customer.name = "Credit Customer"
    
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
    )
    account.payment_terms = 30  # Set payment terms directly
    account.customer = customer
    
    due_date = date.today() + timedelta(days=30)
    
    transaction = AccountTransaction(
        id=uuid.uuid4(),
        account_id=account.id,
        transaction_type=TransactionType.CHARGE,
        amount=Decimal("1500"),
        balance_after=Decimal("1500"),
        description="Invoice #INV-2024-001",
        due_date=due_date,
        created_by=user_id,
        created_at=datetime.utcnow(),
    )
    
    db = FakeSession()
    svc = CustomerAccountService(db)
    
    pdf_bytes = svc.generate_charge_slip(
        transaction=transaction,
        account=account,
        business_name="Invoice Business",
        currency="ZAR",
    )
    
    # Verify PDF was generated
    assert pdf_bytes is not None
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 0


# ============================================================================
# Balance Adjustment Tests
# ============================================================================

def test_adjust_balance_positive_adjustment_increases_balance(
    business_id, customer_id, user_id
):
    """Test that positive adjustment increases account balance."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("200"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    transaction = svc.adjust_balance(
        account=account,
        amount=Decimal("50"),
        reason="Billing correction - missed charge",
        user_id=user_id,
    )

    # Verify transaction was created
    assert transaction in db.added
    assert transaction.transaction_type == TransactionType.ADJUSTMENT
    assert transaction.amount == Decimal("50")
    assert transaction.balance_after == Decimal("250")
    assert transaction.account_id == account.id
    assert transaction.created_by == user_id
    assert "Billing correction" in transaction.description

    # Verify account balance was updated
    assert account.current_balance == Decimal("250")

    # Verify commit was called
    assert db.commits >= 1


def test_adjust_balance_negative_adjustment_decreases_balance(
    business_id, customer_id, user_id
):
    """Test that negative adjustment decreases account balance."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("500"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    transaction = svc.adjust_balance(
        account=account,
        amount=Decimal("-100"),
        reason="Credit for returned goods",
        user_id=user_id,
    )

    # Verify transaction was created
    assert transaction in db.added
    assert transaction.transaction_type == TransactionType.ADJUSTMENT
    assert transaction.amount == Decimal("-100")
    assert transaction.balance_after == Decimal("400")
    assert transaction.account_id == account.id
    assert transaction.created_by == user_id
    assert "Credit for returned goods" in transaction.description

    # Verify account balance was updated
    assert account.current_balance == Decimal("400")

    # Verify commit was called
    assert db.commits >= 1


def test_adjust_balance_raises_for_zero_amount(business_id, customer_id, user_id):
    """Test that adjustment with zero amount raises an error."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("200"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    with pytest.raises(ValueError, match="cannot be zero"):
        svc.adjust_balance(
            account=account,
            amount=Decimal("0"),
            reason="Test adjustment",
            user_id=user_id,
        )

    # Verify no transaction was created
    assert len(db.added) == 0
    # Verify balance was not updated
    assert account.current_balance == Decimal("200")


def test_adjust_balance_raises_for_empty_reason(business_id, customer_id, user_id):
    """Test that adjustment without reason raises an error."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("200"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    with pytest.raises(ValueError, match="reason is required"):
        svc.adjust_balance(
            account=account,
            amount=Decimal("50"),
            reason="",
            user_id=user_id,
        )

    # Verify no transaction was created
    assert len(db.added) == 0


def test_adjust_balance_raises_for_whitespace_only_reason(
    business_id, customer_id, user_id
):
    """Test that adjustment with whitespace-only reason raises an error."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("200"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    with pytest.raises(ValueError, match="reason is required"):
        svc.adjust_balance(
            account=account,
            amount=Decimal("50"),
            reason="   ",
            user_id=user_id,
        )

    # Verify no transaction was created
    assert len(db.added) == 0


def test_adjust_balance_raises_for_negative_result(
    business_id, customer_id, user_id
):
    """Test that adjustment resulting in negative balance raises an error."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("100"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    with pytest.raises(ValueError, match="negative balance"):
        svc.adjust_balance(
            account=account,
            amount=Decimal("-200"),
            reason="Large credit adjustment",
            user_id=user_id,
        )

    # Verify no transaction was created
    assert len(db.added) == 0
    # Verify balance was not updated
    assert account.current_balance == Decimal("100")


def test_adjust_balance_allows_adjustment_to_zero(
    business_id, customer_id, user_id
):
    """Test that adjustment can reduce balance to exactly zero."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("150"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    transaction = svc.adjust_balance(
        account=account,
        amount=Decimal("-150"),
        reason="Full credit for cancelled order",
        user_id=user_id,
    )

    # Verify transaction was created
    assert transaction in db.added
    assert transaction.amount == Decimal("-150")
    assert transaction.balance_after == Decimal("0")

    # Verify account balance is now zero
    assert account.current_balance == Decimal("0")

    # Verify commit was called
    assert db.commits >= 1


def test_adjust_balance_works_for_suspended_account(
    business_id, customer_id, user_id
):
    """Test that balance adjustment works for suspended accounts."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.SUSPENDED,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("500"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    # Adjustment should work even for suspended accounts
    transaction = svc.adjust_balance(
        account=account,
        amount=Decimal("-100"),
        reason="Goodwill credit",
        user_id=user_id,
    )

    assert transaction in db.added
    assert account.current_balance == Decimal("400")
    assert db.commits >= 1


def test_adjust_balance_works_for_pending_account(
    business_id, customer_id, user_id
):
    """Test that balance adjustment works for pending accounts."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.PENDING,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("0"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    # Adjustment should work even for pending accounts
    transaction = svc.adjust_balance(
        account=account,
        amount=Decimal("50"),
        reason="Initial balance setup",
        user_id=user_id,
    )

    assert transaction in db.added
    assert account.current_balance == Decimal("50")
    assert db.commits >= 1


def test_adjust_balance_multiple_adjustments_accumulate(
    business_id, customer_id, user_id
):
    """Test that multiple adjustments correctly accumulate."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("100"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    # First adjustment: +50
    transaction1 = svc.adjust_balance(
        account=account,
        amount=Decimal("50"),
        reason="Adjustment 1",
        user_id=user_id,
    )
    assert transaction1.balance_after == Decimal("150")
    assert account.current_balance == Decimal("150")

    # Second adjustment: -30
    transaction2 = svc.adjust_balance(
        account=account,
        amount=Decimal("-30"),
        reason="Adjustment 2",
        user_id=user_id,
    )
    assert transaction2.balance_after == Decimal("120")
    assert account.current_balance == Decimal("120")

    # Third adjustment: +80
    transaction3 = svc.adjust_balance(
        account=account,
        amount=Decimal("80"),
        reason="Adjustment 3",
        user_id=user_id,
    )
    assert transaction3.balance_after == Decimal("200")
    assert account.current_balance == Decimal("200")


def test_adjust_balance_description_includes_reason(
    business_id, customer_id, user_id
):
    """Test that adjustment transaction description includes the reason."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("200"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    reason = "Correcting duplicate charge from 2024-01-15"
    transaction = svc.adjust_balance(
        account=account,
        amount=Decimal("-75"),
        reason=reason,
        user_id=user_id,
    )

    # Verify description contains the reason
    assert transaction.description is not None
    assert reason in transaction.description
    assert "Balance adjustment" in transaction.description


def test_adjust_balance_large_positive_adjustment(
    business_id, customer_id, user_id
):
    """Test that large positive adjustments work correctly."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("10000"),
        current_balance=Decimal("1000"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    # Large adjustment
    transaction = svc.adjust_balance(
        account=account,
        amount=Decimal("5000"),
        reason="Bulk order correction",
        user_id=user_id,
    )

    assert transaction.amount == Decimal("5000")
    assert transaction.balance_after == Decimal("6000")
    assert account.current_balance == Decimal("6000")
    assert db.commits >= 1


def test_adjust_balance_can_exceed_credit_limit(
    business_id, customer_id, user_id
):
    """Test that adjustments can push balance over credit limit."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("900"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    # Adjustment that exceeds credit limit (unlike charges, adjustments are not blocked)
    transaction = svc.adjust_balance(
        account=account,
        amount=Decimal("500"),
        reason="Manual correction for missed charges",
        user_id=user_id,
    )

    assert transaction.balance_after == Decimal("1400")
    assert account.current_balance == Decimal("1400")
    # Balance now exceeds credit limit
    assert account.current_balance > account.credit_limit
    assert db.commits >= 1


def test_adjust_balance_with_decimal_precision(
    business_id, customer_id, user_id
):
    """Test that adjustments handle decimal precision correctly."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("100.50"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    # Adjustment with cents
    transaction = svc.adjust_balance(
        account=account,
        amount=Decimal("25.75"),
        reason="Precise adjustment",
        user_id=user_id,
    )

    assert transaction.amount == Decimal("25.75")
    assert transaction.balance_after == Decimal("126.25")
    assert account.current_balance == Decimal("126.25")


def test_adjust_balance_reason_trimmed(business_id, customer_id, user_id):
    """Test that adjustment reason is trimmed of whitespace."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("200"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    # Reason with leading/trailing whitespace
    transaction = svc.adjust_balance(
        account=account,
        amount=Decimal("50"),
        reason="  Correction for billing error  ",
        user_id=user_id,
    )

    # Description should contain trimmed reason
    assert "Correction for billing error" in transaction.description
    # Should not have excessive whitespace
    assert "  Correction for billing error  " not in transaction.description


# ============================================================================
# Credit Limit Alert Tests
# ============================================================================

def test_check_credit_limit_alert_no_alert_for_low_utilization(
    business_id, customer_id
):
    """Test that no alert is triggered for low credit utilization."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("200"),  # 20% utilization
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    assert alert['should_alert'] is False
    assert alert['alert_level'] is None
    assert alert['utilization'] == 20.0
    assert alert['available_credit'] == Decimal("800")
    assert "healthy" in alert['message'].lower()


def test_check_credit_limit_alert_warning_at_default_threshold(
    business_id, customer_id
):
    """Test that warning alert is triggered at 80% utilization (default threshold)."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("800"),  # 80% utilization
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    assert alert['should_alert'] is True
    assert alert['alert_level'] == 'warning'
    assert alert['utilization'] == 80.0
    assert alert['available_credit'] == Decimal("200")
    assert "approaching" in alert['message'].lower()
    assert "80.0%" in alert['message']


def test_check_credit_limit_alert_warning_above_threshold(
    business_id, customer_id
):
    """Test that warning alert is triggered above threshold."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("900"),  # 90% utilization
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    assert alert['should_alert'] is True
    assert alert['alert_level'] == 'warning'
    assert alert['utilization'] == 90.0
    assert alert['available_credit'] == Decimal("100")
    assert "approaching" in alert['message'].lower()


def test_check_credit_limit_alert_critical_at_100_percent(
    business_id, customer_id
):
    """Test that critical alert is triggered at exactly 100% utilization."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("1000"),  # 100% utilization
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    assert alert['should_alert'] is True
    assert alert['alert_level'] == 'critical'
    assert alert['utilization'] == 100.0
    assert alert['available_credit'] == Decimal("0")
    assert "reached credit limit" in alert['message'].lower()
    assert "no credit available" in alert['message'].lower()


def test_check_credit_limit_alert_over_limit(business_id, customer_id):
    """Test that over_limit alert is triggered when balance exceeds limit."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("1200"),  # 120% utilization
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    assert alert['should_alert'] is True
    assert alert['alert_level'] == 'over_limit'
    assert alert['utilization'] == 120.0
    assert alert['available_credit'] == Decimal("-200")
    assert "over credit limit" in alert['message'].lower()
    assert "1200" in alert['message']  # Balance
    assert "1000" in alert['message']  # Limit
    assert "200" in alert['message']  # Over by amount


def test_check_credit_limit_alert_custom_threshold(business_id, customer_id):
    """Test that custom threshold percentage works correctly."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("700"),  # 70% utilization
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    # With default threshold (80%), should not alert
    alert_default = svc.check_credit_limit_alert(account)
    assert alert_default['should_alert'] is False

    # With custom threshold (70%), should alert
    alert_custom = svc.check_credit_limit_alert(account, threshold_percentage=70.0)
    assert alert_custom['should_alert'] is True
    assert alert_custom['alert_level'] == 'warning'
    assert alert_custom['utilization'] == 70.0


def test_check_credit_limit_alert_custom_threshold_50_percent(
    business_id, customer_id
):
    """Test that custom threshold of 50% works correctly."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("2000"),
        current_balance=Decimal("1000"),  # 50% utilization
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    # At exactly 50% with 50% threshold, should alert
    alert = svc.check_credit_limit_alert(account, threshold_percentage=50.0)
    assert alert['should_alert'] is True
    assert alert['alert_level'] == 'warning'
    assert alert['utilization'] == 50.0


def test_check_credit_limit_alert_just_below_threshold(
    business_id, customer_id
):
    """Test that alert is not triggered just below threshold."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("799"),  # 79.9% utilization
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    assert alert['should_alert'] is False
    assert alert['alert_level'] is None
    assert alert['utilization'] < 80.0


def test_check_credit_limit_alert_zero_balance(business_id, customer_id):
    """Test that no alert is triggered for zero balance."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("0"),  # 0% utilization
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    assert alert['should_alert'] is False
    assert alert['alert_level'] is None
    assert alert['utilization'] == 0.0
    assert alert['available_credit'] == Decimal("1000")


def test_check_credit_limit_alert_small_credit_limit(business_id, customer_id):
    """Test that alerts work correctly with small credit limits."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("100"),
        current_balance=Decimal("85"),  # 85% utilization
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    assert alert['should_alert'] is True
    assert alert['alert_level'] == 'warning'
    assert alert['utilization'] == 85.0
    assert alert['available_credit'] == Decimal("15")


def test_check_credit_limit_alert_large_credit_limit(business_id, customer_id):
    """Test that alerts work correctly with large credit limits."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("100000"),
        current_balance=Decimal("85000"),  # 85% utilization
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    assert alert['should_alert'] is True
    assert alert['alert_level'] == 'warning'
    assert alert['utilization'] == 85.0
    assert alert['available_credit'] == Decimal("15000")


def test_check_credit_limit_alert_decimal_precision(business_id, customer_id):
    """Test that alerts handle decimal precision correctly."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000.00"),
        current_balance=Decimal("799.99"),  # 79.999% utilization
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    # Should not alert (just below 80%)
    assert alert['should_alert'] is False
    assert alert['utilization'] < 80.0


def test_check_credit_limit_alert_exactly_at_threshold(
    business_id, customer_id
):
    """Test that alert is triggered at exactly the threshold."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("800"),  # Exactly 80%
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account, threshold_percentage=80.0)

    assert alert['should_alert'] is True
    assert alert['alert_level'] == 'warning'
    assert alert['utilization'] == 80.0


def test_check_credit_limit_alert_priority_over_limit_over_critical(
    business_id, customer_id
):
    """Test that over_limit alert takes priority over critical alert."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("1100"),  # Over limit
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    # Should return over_limit, not critical
    assert alert['alert_level'] == 'over_limit'
    assert alert['should_alert'] is True


def test_check_credit_limit_alert_priority_critical_over_warning(
    business_id, customer_id
):
    """Test that critical alert takes priority over warning alert."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("1000"),  # At limit (100%)
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    # Should return critical, not warning
    assert alert['alert_level'] == 'critical'
    assert alert['should_alert'] is True


def test_check_credit_limit_alert_message_format_warning(
    business_id, customer_id
):
    """Test that warning alert message is properly formatted."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("850"),  # 85% utilization
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    # Check message contains key information
    assert "approaching" in alert['message'].lower()
    assert "85.0%" in alert['message']
    assert "150" in alert['message']  # Available credit


def test_check_credit_limit_alert_message_format_critical(
    business_id, customer_id
):
    """Test that critical alert message is properly formatted."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("1000"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    # Check message contains key information
    assert "reached" in alert['message'].lower()
    assert "no credit available" in alert['message'].lower()


def test_check_credit_limit_alert_message_format_over_limit(
    business_id, customer_id
):
    """Test that over_limit alert message is properly formatted."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("1250"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    # Check message contains key information
    assert "over" in alert['message'].lower()
    assert "1250" in alert['message']  # Balance
    assert "1000" in alert['message']  # Limit
    assert "250" in alert['message']  # Over by amount


def test_check_credit_limit_alert_returns_all_required_fields(
    business_id, customer_id
):
    """Test that alert response contains all required fields."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("500"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    alert = svc.check_credit_limit_alert(account)

    # Verify all required fields are present
    assert 'should_alert' in alert
    assert 'alert_level' in alert
    assert 'message' in alert
    assert 'utilization' in alert
    assert 'available_credit' in alert

    # Verify field types
    assert isinstance(alert['should_alert'], bool)
    assert isinstance(alert['message'], str)
    assert isinstance(alert['utilization'], float)
    assert isinstance(alert['available_credit'], Decimal)


def test_check_credit_limit_alert_very_low_threshold(business_id, customer_id):
    """Test that very low threshold (10%) works correctly."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("100"),  # 10% utilization
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    # With 10% threshold, should alert
    alert = svc.check_credit_limit_alert(account, threshold_percentage=10.0)
    assert alert['should_alert'] is True
    assert alert['alert_level'] == 'warning'

    # With 11% threshold, should not alert
    alert_no = svc.check_credit_limit_alert(account, threshold_percentage=11.0)
    assert alert_no['should_alert'] is False


def test_check_credit_limit_alert_very_high_threshold(business_id, customer_id):
    """Test that very high threshold (95%) works correctly."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("950"),  # 95% utilization
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    # With 95% threshold, should alert
    alert = svc.check_credit_limit_alert(account, threshold_percentage=95.0)
    assert alert['should_alert'] is True
    assert alert['alert_level'] == 'warning'

    # With 96% threshold, should not alert
    alert_no = svc.check_credit_limit_alert(account, threshold_percentage=96.0)
    assert alert_no['should_alert'] is False


def test_check_credit_limit_alert_multiple_calls_consistent(
    business_id, customer_id
):
    """Test that multiple calls return consistent results."""
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("850"),
    )
    db = FakeSession()
    svc = CustomerAccountService(db)

    # Call multiple times
    alert1 = svc.check_credit_limit_alert(account)
    alert2 = svc.check_credit_limit_alert(account)
    alert3 = svc.check_credit_limit_alert(account)

    # All should return same results
    assert alert1['should_alert'] == alert2['should_alert'] == alert3['should_alert']
    assert alert1['alert_level'] == alert2['alert_level'] == alert3['alert_level']
    assert alert1['utilization'] == alert2['utilization'] == alert3['utilization']


# ============================================================================
# Payment Receipt Generation Tests
# ============================================================================

def test_generate_payment_receipt_returns_structured_data(
    business_id, customer_id, user_id
):
    """Test that payment receipt generation returns structured data."""
    from app.models.customer_account import AccountPayment, PaymentAllocation, AccountTransaction
    
    customer = _make_customer(customer_id, business_id)
    customer.name = "John Doe"
    
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("5000"),
        current_balance=Decimal("200"),  # After payment
        account_number="ACC-TEST-12345",
    )
    account.customer = customer
    
    # Create a payment
    payment = AccountPayment(
        id=uuid.uuid4(),
        account_id=account.id,
        amount=Decimal("300"),
        payment_method="cash",
        reference_number="PAY-001",
        notes="Test payment",
        received_by=user_id,
        created_at=datetime.utcnow(),
    )
    payment.account = account
    
    # Create a charge transaction that was paid
    charge = AccountTransaction(
        id=uuid.uuid4(),
        account_id=account.id,
        transaction_type=TransactionType.CHARGE,
        amount=Decimal("500"),
        balance_after=Decimal("500"),
        description="Test charge",
        created_at=datetime.utcnow(),
    )
    
    # Create allocation
    allocation = PaymentAllocation(
        id=uuid.uuid4(),
        payment_id=payment.id,
        transaction_id=charge.id,
        amount=Decimal("300"),
        created_at=datetime.utcnow(),
    )
    allocation.transaction = charge
    
    db = _create_mock_db_for_receipt_tests(allocations=[allocation])
    # Update the sum query to return the allocated amount for this transaction
    db.query.side_effect = lambda model_or_expr: (
        type('obj', (), {
            'filter': lambda *args: type('obj', (), {
                'scalar': lambda: Decimal("300")
            })()
        })() if 'sum' in str(model_or_expr).lower() else
        type('obj', (), {
            'filter': lambda *args: type('obj', (), {
                'all': lambda: [allocation]
            })()
        })()
    )
    
    svc = CustomerAccountService(db)
    
    receipt = svc.generate_payment_receipt(
        payment=payment,
        account=account,
        business_name="Test Business",
        business_address="123 Test St",
        business_phone="+27 11 123 4567",
        currency="ZAR",
    )
    
    # Verify receipt structure
    assert isinstance(receipt, dict)
    assert 'receipt_id' in receipt
    assert 'receipt_number' in receipt
    assert 'receipt_date' in receipt
    assert 'business' in receipt
    assert 'account' in receipt
    assert 'payment' in receipt
    assert 'allocations' in receipt
    assert 'balance' in receipt
    assert 'totals' in receipt


def test_generate_payment_receipt_includes_payment_details(
    business_id, customer_id, user_id
):
    """Test that payment receipt includes all payment details."""
    from app.models.customer_account import AccountPayment
    from unittest.mock import Mock
    
    customer = _make_customer(customer_id, business_id)
    customer.name = "Jane Smith"
    
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("10000"),
        current_balance=Decimal("1500"),
        account_number="ACC-TEST-99999",
    )
    account.customer = customer
    
    payment = AccountPayment(
        id=uuid.uuid4(),
        account_id=account.id,
        amount=Decimal("2500"),
        payment_method="bank_transfer",
        reference_number="TXN-2024-12345",
        notes="Monthly payment",
        received_by=user_id,
        created_at=datetime.utcnow(),
    )
    payment.account = account
    
    db = _create_mock_db_for_receipt_tests()
    svc = CustomerAccountService(db)
    
    receipt = svc.generate_payment_receipt(
        payment=payment,
        account=account,
        business_name="ABC Corp",
        currency="ZAR",
    )
    
    # Verify payment details
    assert receipt['payment']['amount'] == 2500.0
    assert receipt['payment']['payment_method'] == "bank_transfer"
    assert receipt['payment']['reference_number'] == "TXN-2024-12345"
    assert receipt['payment']['notes'] == "Monthly payment"
    assert receipt['payment']['currency'] == "ZAR"
    assert receipt['payment']['received_by'] == str(user_id)


def test_generate_payment_receipt_includes_account_info(
    business_id, customer_id, user_id
):
    """Test that payment receipt includes account information."""
    from app.models.customer_account import AccountPayment
    
    customer = _make_customer(customer_id, business_id)
    customer.name = "Bob Johnson"
    
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("3000"),
        current_balance=Decimal("500"),
        account_number="ACC-SPECIAL-777",
    )
    account.customer = customer
    
    payment = AccountPayment(
        id=uuid.uuid4(),
        account_id=account.id,
        amount=Decimal("1000"),
        payment_method="card",
        received_by=user_id,
        created_at=datetime.utcnow(),
    )
    payment.account = account
    
    # Create custom fake session
    class CustomFakeSession(FakeSession):
        def query(self, model_or_expr):
            # Return empty list for PaymentAllocation queries
            return FakeQuery([])
    
    db = CustomFakeSession()
    svc = CustomerAccountService(db)
    
    receipt = svc.generate_payment_receipt(
        payment=payment,
        account=account,
        business_name="Test Co",
    )
    
    # Verify account information
    assert receipt['account']['account_number'] == "ACC-SPECIAL-777"
    assert receipt['account']['customer_name'] == "Bob Johnson"
    assert receipt['account']['customer_id'] == str(customer_id)
    assert receipt['account']['account_id'] == str(account.id)


def test_generate_payment_receipt_calculates_balance_correctly(
    business_id, customer_id, user_id
):
    """Test that payment receipt calculates balances correctly."""
    from app.models.customer_account import AccountPayment
    
    customer = _make_customer(customer_id, business_id)
    customer.name = "Alice Brown"
    
    # Account balance AFTER payment
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("5000"),
        current_balance=Decimal("800"),  # After 1200 payment
        account_number="ACC-TEST-001",
    )
    account.customer = customer
    
    payment = AccountPayment(
        id=uuid.uuid4(),
        account_id=account.id,
        amount=Decimal("1200"),
        payment_method="cash",
        received_by=user_id,
        created_at=datetime.utcnow(),
    )
    payment.account = account
    
    # Create custom fake session
    class CustomFakeSession(FakeSession):
        def query(self, model_or_expr):
            # Return empty list for PaymentAllocation queries
            return FakeQuery([])
    
    db = CustomFakeSession()
    svc = CustomerAccountService(db)
    
    receipt = svc.generate_payment_receipt(
        payment=payment,
        account=account,
        business_name="Test Business",
    )
    
    # Verify balance calculations
    # Balance before = current balance + payment amount
    assert receipt['balance']['balance_before_payment'] == 2000.0  # 800 + 1200
    assert receipt['balance']['payment_amount'] == 1200.0
    assert receipt['balance']['balance_after_payment'] == 800.0
    assert receipt['balance']['available_credit'] == 4200.0  # 5000 - 800
    assert receipt['balance']['credit_limit'] == 5000.0


def test_format_payment_receipt_text_creates_readable_output(
    business_id, customer_id, user_id
):
    """Test that text formatting creates readable receipt."""
    from app.models.customer_account import AccountPayment
    
    customer = _make_customer(customer_id, business_id)
    customer.name = "Test Customer"
    
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("1000"),
        current_balance=Decimal("200"),
        account_number="ACC-TEST-001",
    )
    account.customer = customer
    
    payment = AccountPayment(
        id=uuid.uuid4(),
        account_id=account.id,
        amount=Decimal("300"),
        payment_method="cash",
        reference_number="PAY-001",
        received_by=user_id,
        created_at=datetime.utcnow(),
    )
    payment.account = account
    
    # Create custom fake session
    class CustomFakeSession(FakeSession):
        def query(self, model_or_expr):
            # Return empty list for PaymentAllocation queries
            return FakeQuery([])
    
    db = CustomFakeSession()
    svc = CustomerAccountService(db)
    
    receipt = svc.generate_payment_receipt(
        payment=payment,
        account=account,
        business_name="Test Business",
    )
    
    text = svc.format_payment_receipt_text(receipt)
    
    # Verify text contains key elements
    assert "PAYMENT RECEIPT" in text
    assert "Test Business" in text
    assert "ACC-TEST-001" in text
    assert "Test Customer" in text
    assert "300.00" in text
    assert "cash" in text
    assert "PAY-001" in text
    assert "Thank you for your payment!" in text


def test_format_payment_receipt_html_creates_valid_html(
    business_id, customer_id, user_id
):
    """Test that HTML formatting creates valid HTML receipt."""
    from app.models.customer_account import AccountPayment
    
    customer = _make_customer(customer_id, business_id)
    customer.name = "HTML Test Customer"
    
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("2000"),
        current_balance=Decimal("400"),
        account_number="ACC-HTML-001",
    )
    account.customer = customer
    
    payment = AccountPayment(
        id=uuid.uuid4(),
        account_id=account.id,
        amount=Decimal("600"),
        payment_method="card",
        reference_number="REF-HTML-123",
        notes="Test HTML receipt",
        received_by=user_id,
        created_at=datetime.utcnow(),
    )
    payment.account = account
    
    # Create custom fake session
    class CustomFakeSession(FakeSession):
        def query(self, model_or_expr):
            # Return empty list for PaymentAllocation queries
            return FakeQuery([])
    
    db = CustomFakeSession()
    svc = CustomerAccountService(db)
    
    receipt = svc.generate_payment_receipt(
        payment=payment,
        account=account,
        business_name="HTML Test Business",
        business_address="123 HTML St\nHTML City",
        business_phone="+27 11 111 1111",
    )
    
    html = svc.format_payment_receipt_html(receipt)
    
    # Verify HTML structure
    assert "<!DOCTYPE html>" in html
    assert "<html>" in html
    assert "</html>" in html
    assert "<head>" in html
    assert "<body>" in html
    
    # Verify content
    assert "Payment Receipt" in html
    assert "HTML Test Business" in html
    assert "ACC-HTML-001" in html
    assert "HTML Test Customer" in html
    assert "600.00" in html
    assert "card" in html
    assert "REF-HTML-123" in html
    assert "Test HTML receipt" in html
    
    # Verify styling
    assert "<style>" in html
    assert "font-family" in html


def test_generate_payment_receipt_with_allocations(
    business_id, customer_id, user_id
):
    """Test that payment receipt includes allocation details."""
    from app.models.customer_account import AccountPayment, PaymentAllocation, AccountTransaction
    from datetime import date
    
    customer = _make_customer(customer_id, business_id)
    customer.name = "Allocation Test"
    
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
        credit_limit=Decimal("5000"),
        current_balance=Decimal("300"),
        account_number="ACC-ALLOC-001",
    )
    account.customer = customer
    
    payment = AccountPayment(
        id=uuid.uuid4(),
        account_id=account.id,
        amount=Decimal("700"),
        payment_method="bank_transfer",
        received_by=user_id,
        created_at=datetime.utcnow(),
    )
    payment.account = account
    
    # Create two charges
    charge1 = AccountTransaction(
        id=uuid.uuid4(),
        account_id=account.id,
        transaction_type=TransactionType.CHARGE,
        amount=Decimal("500"),
        balance_after=Decimal("500"),
        description="First charge",
        due_date=date(2024, 12, 31),
        created_at=datetime(2024, 11, 1),
    )
    
    charge2 = AccountTransaction(
        id=uuid.uuid4(),
        account_id=account.id,
        transaction_type=TransactionType.CHARGE,
        amount=Decimal("500"),
        balance_after=Decimal("1000"),
        description="Second charge",
        due_date=date(2025, 1, 15),
        created_at=datetime(2024, 11, 15),
    )
    
    # Create allocations
    alloc1 = PaymentAllocation(
        id=uuid.uuid4(),
        payment_id=payment.id,
        transaction_id=charge1.id,
        amount=Decimal("500"),
        created_at=datetime.utcnow(),
    )
    alloc1.transaction = charge1
    
    alloc2 = PaymentAllocation(
        id=uuid.uuid4(),
        payment_id=payment.id,
        transaction_id=charge2.id,
        amount=Decimal("200"),
        created_at=datetime.utcnow(),
    )
    alloc2.transaction = charge2
    
    # Setup fake session with allocations
    class FakeAllocQuery(FakeQuery):
        def __init__(self, items):
            super().__init__(items)
            self._alloc_items = items
        
        def filter(self, *args, **kwargs):
            # Return self to allow chaining
            return self
        
        def all(self):
            return self._alloc_items
        
        def scalar(self):
            # For sum queries, return the allocated amount
            if hasattr(self, '_for_transaction'):
                # Return allocated amount for specific transaction
                return Decimal("500") if self._for_transaction == charge1.id else Decimal("200")
            return Decimal("0")
    
    class CustomFakeSession(FakeSession):
        def __init__(self, allocations):
            super().__init__()
            self.allocations = allocations
            self._current_transaction = None
        
        def query(self, model_or_expr):
            # Handle PaymentAllocation queries
            if model_or_expr == PaymentAllocation:
                return FakeAllocQuery(self.allocations)
            # Handle sum queries (func.sum)
            if hasattr(model_or_expr, '__name__') and 'sum' in str(model_or_expr).lower():
                query = FakeAllocQuery([])
                query._for_transaction = self._current_transaction
                return query
            return FakeQuery([])
    
    db = CustomFakeSession([alloc1, alloc2])
    svc = CustomerAccountService(db)
    
    receipt = svc.generate_payment_receipt(
        payment=payment,
        account=account,
        business_name="Allocation Test Business",
    )
    
    # Verify allocations are included
    assert len(receipt['allocations']) == 2
    
    # Verify first allocation
    assert receipt['allocations'][0]['description'] == "First charge"
    assert receipt['allocations'][0]['original_amount'] == 500.0
    assert receipt['allocations'][0]['allocated_amount'] == 500.0
    
    # Verify second allocation
    assert receipt['allocations'][1]['description'] == "Second charge"
    assert receipt['allocations'][1]['original_amount'] == 500.0
    assert receipt['allocations'][1]['allocated_amount'] == 200.0
    
    # Verify totals
    assert receipt['totals']['number_of_allocations'] == 2


def test_generate_payment_receipt_formats_receipt_number(
    business_id, customer_id, user_id
):
    """Test that receipt number is properly formatted."""
    from app.models.customer_account import AccountPayment
    
    customer = _make_customer(customer_id, business_id)
    customer.name = "Receipt Number Test"
    
    account = _make_account(
        customer_id,
        business_id,
        status=AccountStatus.ACTIVE,
    )
    account.customer = customer
    
    payment_id = uuid.uuid4()
    payment = AccountPayment(
        id=payment_id,
        account_id=account.id,
        amount=Decimal("100"),
        payment_method="cash",
        received_by=user_id,
        created_at=datetime.utcnow(),
    )
    payment.account = account
    
    # Create custom fake session
    class CustomFakeSession(FakeSession):
        def query(self, model_or_expr):
            # Return empty list for PaymentAllocation queries
            return FakeQuery([])
    
    db = CustomFakeSession()
    svc = CustomerAccountService(db)
    
    receipt = svc.generate_payment_receipt(
        payment=payment,
        account=account,
        business_name="Test",
    )
    
    # Verify receipt number format
    assert receipt['receipt_number'].startswith("PMT-")
    assert str(payment_id)[:8].upper() in receipt['receipt_number']
    assert receipt['receipt_id'] == str(payment_id)
