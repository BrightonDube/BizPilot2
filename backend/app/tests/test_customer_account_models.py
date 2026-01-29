"""Unit tests for customer account models."""

from decimal import Decimal
from datetime import date
from uuid import uuid4

from app.models.customer_account import (
    CustomerAccount,
    AccountStatus,
    AccountTransaction,
    TransactionType,
    AccountPayment,
    PaymentAllocation,
    AccountStatement,
    CollectionActivity,
    ActivityType,
    AccountWriteOff,
)


class TestCustomerAccount:
    """Test CustomerAccount model."""

    def test_customer_account_creation(self):
        """Test creating a customer account."""
        account = CustomerAccount(
            customer_id=uuid4(),
            business_id=uuid4(),
            account_number="ACC-001",
            status=AccountStatus.ACTIVE,
            credit_limit=Decimal("10000.00"),
            current_balance=Decimal("2500.00"),
            payment_terms=30,
        )
        
        assert account.account_number == "ACC-001"
        assert account.status == AccountStatus.ACTIVE
        assert account.credit_limit == Decimal("10000.00")
        assert account.current_balance == Decimal("2500.00")
        assert account.payment_terms == 30

    def test_available_credit_calculation(self):
        """Test available credit calculation."""
        account = CustomerAccount(
            customer_id=uuid4(),
            business_id=uuid4(),
            account_number="ACC-002",
            credit_limit=Decimal("10000.00"),
            current_balance=Decimal("3000.00"),
        )
        
        assert account.available_credit == Decimal("7000.00")

    def test_is_over_limit(self):
        """Test over limit detection."""
        account = CustomerAccount(
            customer_id=uuid4(),
            business_id=uuid4(),
            account_number="ACC-003",
            credit_limit=Decimal("5000.00"),
            current_balance=Decimal("6000.00"),
        )
        
        assert account.is_over_limit is True

    def test_credit_utilization(self):
        """Test credit utilization calculation."""
        account = CustomerAccount(
            customer_id=uuid4(),
            business_id=uuid4(),
            account_number="ACC-004",
            credit_limit=Decimal("10000.00"),
            current_balance=Decimal("2500.00"),
        )
        
        assert account.credit_utilization == 25.0

    def test_credit_utilization_zero_limit(self):
        """Test credit utilization with zero limit."""
        account = CustomerAccount(
            customer_id=uuid4(),
            business_id=uuid4(),
            account_number="ACC-005",
            credit_limit=Decimal("0.00"),
            current_balance=Decimal("0.00"),
        )
        
        assert account.credit_utilization == 0.0

    def test_account_status_properties(self):
        """Test account status properties."""
        active_account = CustomerAccount(
            customer_id=uuid4(),
            business_id=uuid4(),
            account_number="ACC-006",
            status=AccountStatus.ACTIVE,
        )
        
        assert active_account.is_active is True
        assert active_account.is_suspended is False
        assert active_account.is_closed is False

        suspended_account = CustomerAccount(
            customer_id=uuid4(),
            business_id=uuid4(),
            account_number="ACC-007",
            status=AccountStatus.SUSPENDED,
        )
        
        assert suspended_account.is_active is False
        assert suspended_account.is_suspended is True
        assert suspended_account.is_closed is False


class TestAccountTransaction:
    """Test AccountTransaction model."""

    def test_transaction_creation(self):
        """Test creating an account transaction."""
        transaction = AccountTransaction(
            account_id=uuid4(),
            transaction_type=TransactionType.CHARGE,
            amount=Decimal("500.00"),
            balance_after=Decimal("3000.00"),
            description="Invoice #123",
        )
        
        assert transaction.transaction_type == TransactionType.CHARGE
        assert transaction.amount == Decimal("500.00")
        assert transaction.balance_after == Decimal("3000.00")

    def test_is_charge_property(self):
        """Test is_charge property."""
        charge = AccountTransaction(
            account_id=uuid4(),
            transaction_type=TransactionType.CHARGE,
            amount=Decimal("100.00"),
            balance_after=Decimal("100.00"),
        )
        
        assert charge.is_charge is True
        assert charge.is_payment is False

    def test_is_payment_property(self):
        """Test is_payment property."""
        payment = AccountTransaction(
            account_id=uuid4(),
            transaction_type=TransactionType.PAYMENT,
            amount=Decimal("-100.00"),
            balance_after=Decimal("0.00"),
        )
        
        assert payment.is_payment is True
        assert payment.is_charge is False


class TestAccountPayment:
    """Test AccountPayment model."""

    def test_payment_creation(self):
        """Test creating an account payment."""
        payment = AccountPayment(
            account_id=uuid4(),
            amount=Decimal("1000.00"),
            payment_method="bank_transfer",
            reference_number="TXN-12345",
        )
        
        assert payment.amount == Decimal("1000.00")
        assert payment.payment_method == "bank_transfer"
        assert payment.reference_number == "TXN-12345"

    def test_allocated_amount_no_allocations(self):
        """Test allocated amount with no allocations."""
        payment = AccountPayment(
            account_id=uuid4(),
            amount=Decimal("1000.00"),
            payment_method="cash",
        )
        
        assert payment.allocated_amount == Decimal("0")

    def test_unallocated_amount(self):
        """Test unallocated amount calculation."""
        payment = AccountPayment(
            account_id=uuid4(),
            amount=Decimal("1000.00"),
            payment_method="cash",
        )
        
        # No allocations yet
        assert payment.unallocated_amount == Decimal("1000.00")


class TestAccountStatement:
    """Test AccountStatement model."""

    def test_statement_creation(self):
        """Test creating an account statement."""
        statement = AccountStatement(
            account_id=uuid4(),
            statement_date=date(2024, 1, 31),
            period_start=date(2024, 1, 1),
            period_end=date(2024, 1, 31),
            opening_balance=Decimal("1000.00"),
            total_charges=Decimal("2000.00"),
            total_payments=Decimal("1500.00"),
            closing_balance=Decimal("1500.00"),
            current_amount=Decimal("500.00"),
            days_30_amount=Decimal("500.00"),
            days_60_amount=Decimal("300.00"),
            days_90_plus_amount=Decimal("200.00"),
        )
        
        assert statement.opening_balance == Decimal("1000.00")
        assert statement.closing_balance == Decimal("1500.00")

    def test_is_sent_property(self):
        """Test is_sent property."""
        unsent_statement = AccountStatement(
            account_id=uuid4(),
            statement_date=date(2024, 1, 31),
            period_start=date(2024, 1, 1),
            period_end=date(2024, 1, 31),
            opening_balance=Decimal("0"),
            total_charges=Decimal("0"),
            total_payments=Decimal("0"),
            closing_balance=Decimal("0"),
        )
        
        assert unsent_statement.is_sent is False

    def test_total_aging(self):
        """Test total aging calculation."""
        statement = AccountStatement(
            account_id=uuid4(),
            statement_date=date(2024, 1, 31),
            period_start=date(2024, 1, 1),
            period_end=date(2024, 1, 31),
            opening_balance=Decimal("0"),
            total_charges=Decimal("0"),
            total_payments=Decimal("0"),
            closing_balance=Decimal("0"),
            current_amount=Decimal("500.00"),
            days_30_amount=Decimal("300.00"),
            days_60_amount=Decimal("150.00"),
            days_90_plus_amount=Decimal("50.00"),
        )
        
        assert statement.total_aging == Decimal("1000.00")


class TestCollectionActivity:
    """Test CollectionActivity model."""

    def test_activity_creation(self):
        """Test creating a collection activity."""
        activity = CollectionActivity(
            account_id=uuid4(),
            activity_type=ActivityType.PHONE_CALL,
            notes="Called customer, no answer",
            outcome="no_answer",
        )
        
        assert activity.activity_type == ActivityType.PHONE_CALL
        assert activity.outcome == "no_answer"

    def test_has_promise_property(self):
        """Test has_promise property."""
        activity_with_promise = CollectionActivity(
            account_id=uuid4(),
            activity_type=ActivityType.PROMISE,
            promise_date=date(2024, 2, 15),
            promise_amount=Decimal("500.00"),
        )
        
        assert activity_with_promise.has_promise is True

        activity_without_promise = CollectionActivity(
            account_id=uuid4(),
            activity_type=ActivityType.PHONE_CALL,
        )
        
        assert activity_without_promise.has_promise is False


class TestAccountWriteOff:
    """Test AccountWriteOff model."""

    def test_write_off_creation(self):
        """Test creating an account write-off."""
        write_off = AccountWriteOff(
            account_id=uuid4(),
            amount=Decimal("1000.00"),
            reason="Customer bankruptcy",
        )
        
        assert write_off.amount == Decimal("1000.00")
        assert write_off.reason == "Customer bankruptcy"


class TestPaymentAllocation:
    """Test PaymentAllocation model."""

    def test_allocation_creation(self):
        """Test creating a payment allocation."""
        allocation = PaymentAllocation(
            payment_id=uuid4(),
            transaction_id=uuid4(),
            amount=Decimal("250.00"),
        )
        
        assert allocation.amount == Decimal("250.00")
