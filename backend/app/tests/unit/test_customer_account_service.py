"""Unit tests for CustomerAccountService."""

import pytest
from decimal import Decimal
from uuid import uuid4

from app.services.customer_account_service import CustomerAccountService
from app.models.customer_account import CustomerAccount, AccountStatus
from app.models.customer import Customer, CustomerType
from app.models.business import Business
from app.schemas.customer_account import AccountCreate, AccountUpdate
from app.core.security import verify_password


class TestCustomerAccountService:
    """Test suite for CustomerAccountService."""

    @pytest.fixture
    def business(self, db_session):
        """Create a test business."""
        import uuid
        from app.models.organization import Organization
        from app.models.user import User, UserStatus, SubscriptionStatus
        from app.core.security import get_password_hash
        
        # Use unique identifier to avoid collisions
        unique_id = uuid.uuid4().hex[:8]
        
        # Create user first (required for organization owner)
        user = User(
            email=f"test-{unique_id}@example.com",
            hashed_password=get_password_hash("testpassword"),
            first_name="Test",
            last_name="User",
            is_email_verified=True,
            status=UserStatus.ACTIVE,
            subscription_status=SubscriptionStatus.ACTIVE,
        )
        db_session.add(user)
        db_session.flush()
        
        # Create organization
        org = Organization(
            name=f"Test Organization {unique_id}",
            slug=f"test-org-{unique_id}",
            owner_id=user.id,
        )
        db_session.add(org)
        db_session.flush()
        
        # Create business
        business = Business(
            name=f"Test Business {unique_id}",
            slug=f"test-business-{unique_id}",
            organization_id=org.id,
            email=f"test-{unique_id}@business.com",
            phone="1234567890",
        )
        db_session.add(business)
        db_session.commit()
        db_session.refresh(business)
        return business

    @pytest.fixture
    def customer(self, db_session, business):
        """Create a test customer."""
        import uuid
        unique_id = uuid.uuid4().hex[:8]
        customer = Customer(
            business_id=business.id,
            customer_type=CustomerType.INDIVIDUAL,
            first_name="John",
            last_name="Doe",
            email=f"john.doe-{unique_id}@example.com",
            phone="1234567890",
        )
        db_session.add(customer)
        db_session.commit()
        db_session.refresh(customer)
        return customer

    @pytest.fixture
    def service(self, db_session):
        """Create CustomerAccountService instance."""
        return CustomerAccountService(db_session)

    def test_generate_account_number_format(self, service, business):
        """Test that account number is generated in correct format."""
        account_number = service._generate_account_number(business.id)
        
        # Should be in format: ACC-{prefix}-{number}
        assert account_number.startswith("ACC-")
        parts = account_number.split("-")
        assert len(parts) == 3
        assert parts[0] == "ACC"
        assert len(parts[1]) == 8  # Business prefix (8 chars)
        assert len(parts[2]) == 5  # Sequential number (5 digits)
        assert parts[2].isdigit()

    def test_generate_account_number_uniqueness(self, service, business, customer, db_session):
        """Test that account numbers are unique and sequential."""
        # Create first account
        account1_number = service._generate_account_number(business.id)
        account1 = CustomerAccount(
            customer_id=customer.id,
            business_id=business.id,
            account_number=account1_number,
            credit_limit=Decimal('1000'),
        )
        db_session.add(account1)
        db_session.commit()
        
        # Create second customer
        import uuid
        unique_id = uuid.uuid4().hex[:8]
        customer2 = Customer(
            business_id=business.id,
            customer_type=CustomerType.INDIVIDUAL,
            first_name="Jane",
            last_name="Smith",
            email=f"jane.smith-{unique_id}@example.com",
            phone="0987654321",
        )
        db_session.add(customer2)
        db_session.commit()
        
        # Generate second account number
        account2_number = service._generate_account_number(business.id)
        
        # Should be different
        assert account1_number != account2_number
        
        # Sequential numbers should increment
        num1 = int(account1_number.split("-")[2])
        num2 = int(account2_number.split("-")[2])
        assert num2 == num1 + 1

    def test_create_account_success(self, service, business, customer):
        """Test successful account creation."""
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
            notes="Test account",
        )
        
        account = service.create_account(business.id, data)
        
        assert account.id is not None
        assert account.customer_id == customer.id
        assert account.business_id == business.id
        assert account.account_number.startswith("ACC-")
        assert account.status == AccountStatus.PENDING
        assert account.credit_limit == Decimal('5000')
        assert account.current_balance == Decimal('0')
        assert account.payment_terms == 30
        assert account.notes == "Test account"
        assert account.account_pin is None

    def test_create_account_with_pin(self, service, business, customer):
        """Test account creation with PIN."""
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
            account_pin="1234",
        )
        
        account = service.create_account(business.id, data)
        
        assert account.account_pin is not None
        assert account.account_pin != "1234"  # Should be hashed
        assert verify_password("1234", account.account_pin)

    def test_create_account_customer_not_found(self, service, business):
        """Test account creation fails when customer doesn't exist."""
        data = AccountCreate(
            customer_id=uuid4(),  # Non-existent customer
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        
        with pytest.raises(ValueError, match="Customer .* not found"):
            service.create_account(business.id, data)

    def test_create_account_duplicate_customer(self, service, business, customer, db_session):
        """Test account creation fails when customer already has an account."""
        # Create first account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        service.create_account(business.id, data)
        
        # Try to create second account for same customer
        with pytest.raises(ValueError, match="already has an account"):
            service.create_account(business.id, data)

    def test_get_account(self, service, business, customer):
        """Test getting an account by ID."""
        # Create account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        created_account = service.create_account(business.id, data)
        
        # Get account
        account = service.get_account(created_account.id, business.id)
        
        assert account is not None
        assert account.id == created_account.id
        assert account.customer_id == customer.id

    def test_get_account_by_customer(self, service, business, customer):
        """Test getting an account by customer ID."""
        # Create account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        created_account = service.create_account(business.id, data)
        
        # Get account by customer
        account = service.get_account_by_customer(customer.id, business.id)
        
        assert account is not None
        assert account.id == created_account.id
        assert account.customer_id == customer.id

    def test_get_account_by_number(self, service, business, customer):
        """Test getting an account by account number."""
        # Create account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        created_account = service.create_account(business.id, data)
        
        # Get account by number
        account = service.get_account_by_number(created_account.account_number, business.id)
        
        assert account is not None
        assert account.id == created_account.id
        assert account.account_number == created_account.account_number

    def test_update_account(self, service, business, customer):
        """Test updating an account."""
        # Create account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        
        # Update account
        update_data = AccountUpdate(
            credit_limit=Decimal('10000'),
            payment_terms=60,
            notes="Updated notes",
        )
        updated_account = service.update_account(account, update_data)
        
        assert updated_account.credit_limit == Decimal('10000')
        assert updated_account.payment_terms == 60
        assert updated_account.notes == "Updated notes"

    def test_update_account_pin(self, service, business, customer):
        """Test updating account PIN."""
        # Create account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        
        # Update PIN
        update_data = AccountUpdate(account_pin="5678")
        updated_account = service.update_account(account, update_data)
        
        assert updated_account.account_pin is not None
        assert verify_password("5678", updated_account.account_pin)

    def test_activate_account(self, service, business, customer):
        """Test activating an account."""
        # Create account (starts as PENDING)
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        
        # Activate account
        activated_account = service.activate_account(account)
        
        assert activated_account.status == AccountStatus.ACTIVE
        assert activated_account.opened_at is not None
        assert activated_account.suspended_at is None

    def test_activate_account_already_active(self, service, business, customer):
        """Test activating an already active account fails."""
        # Create and activate account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        service.activate_account(account)
        
        # Try to activate again
        with pytest.raises(ValueError, match="already active"):
            service.activate_account(account)

    def test_suspend_account(self, service, business, customer):
        """Test suspending an account."""
        # Create and activate account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        service.activate_account(account)
        
        # Suspend account
        suspended_account = service.suspend_account(account, "Payment overdue")
        
        assert suspended_account.status == AccountStatus.SUSPENDED
        assert suspended_account.suspended_at is not None
        assert "SUSPENDED" in suspended_account.notes
        assert "Payment overdue" in suspended_account.notes

    def test_suspend_account_not_active(self, service, business, customer):
        """Test suspending a non-active account fails."""
        # Create account (PENDING status)
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        
        # Try to suspend
        with pytest.raises(ValueError, match="Only active accounts"):
            service.suspend_account(account)

    def test_close_account(self, service, business, customer):
        """Test closing an account with zero balance."""
        # Create and activate account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        service.activate_account(account)
        
        # Close account
        closed_account = service.close_account(account, "Customer request")
        
        assert closed_account.status == AccountStatus.CLOSED
        assert closed_account.closed_at is not None
        assert "CLOSED" in closed_account.notes
        assert "Customer request" in closed_account.notes

    def test_close_account_with_balance(self, service, business, customer, db_session):
        """Test closing an account with outstanding balance fails."""
        # Create and activate account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        service.activate_account(account)
        
        # Set balance
        account.current_balance = Decimal('100')
        db_session.commit()
        
        # Try to close
        with pytest.raises(ValueError, match="outstanding balance"):
            service.close_account(account)

    def test_get_balance(self, service, business, customer, db_session):
        """Test getting account balance information."""
        # Create account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        
        # Set balance
        account.current_balance = Decimal('2000')
        db_session.commit()
        db_session.refresh(account)
        
        # Get balance
        balance = service.get_balance(account)
        
        assert balance.account_id == account.id
        assert balance.current_balance == Decimal('2000')
        assert balance.available_credit == Decimal('3000')
        assert balance.credit_limit == Decimal('5000')
        assert balance.credit_utilization == 40.0
        assert balance.is_over_limit is False

    def test_validate_credit_success(self, service, business, customer):
        """Test successful credit validation."""
        # Create and activate account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        service.activate_account(account)
        
        # Validate credit
        validation = service.validate_credit(account, Decimal('1000'))
        
        assert validation.is_valid is True
        assert validation.available_credit == Decimal('5000')
        assert validation.requested_amount == Decimal('1000')
        assert "successful" in validation.message.lower()

    def test_validate_credit_exceeds_limit(self, service, business, customer):
        """Test credit validation fails when exceeding limit."""
        # Create and activate account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        service.activate_account(account)
        
        # Validate credit exceeding limit
        validation = service.validate_credit(account, Decimal('6000'))
        
        assert validation.is_valid is False
        assert validation.available_credit == Decimal('5000')
        assert validation.requested_amount == Decimal('6000')
        assert "Insufficient credit" in validation.message

    def test_validate_credit_account_not_active(self, service, business, customer):
        """Test credit validation fails when account is not active."""
        # Create account (PENDING status)
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        
        # Validate credit
        validation = service.validate_credit(account, Decimal('1000'))
        
        assert validation.is_valid is False
        assert "pending" in validation.message.lower()

    def test_validate_credit_negative_amount(self, service, business, customer):
        """Test credit validation fails with negative amount."""
        # Create and activate account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        service.activate_account(account)
        
        # Validate negative amount
        validation = service.validate_credit(account, Decimal('-100'))
        
        assert validation.is_valid is False
        assert "must be positive" in validation.message

    def test_available_credit_calculation(self, service, business, customer, db_session):
        """Test available credit is calculated correctly."""
        # Create account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        
        # Set balance
        account.current_balance = Decimal('3500')
        db_session.commit()
        db_session.refresh(account)
        
        # Check available credit
        assert account.available_credit == Decimal('1500')
        assert account.credit_utilization == 70.0
        assert account.is_over_limit is False

    def test_over_limit_detection(self, service, business, customer, db_session):
        """Test over limit detection."""
        # Create account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        
        # Set balance over limit
        account.current_balance = Decimal('5500')
        db_session.commit()
        db_session.refresh(account)
        
        # Check over limit
        assert account.is_over_limit is True
        assert account.available_credit == Decimal('-500')


class TestPaymentRecording:
    """Test suite for payment recording functionality."""

    @pytest.fixture
    def business(self, db_session):
        """Create a test business."""
        from app.models.organization import Organization
        from app.models.user import User, UserStatus, SubscriptionStatus
        from app.core.security import get_password_hash
        from uuid import uuid4
        
        # Create user first with unique email
        unique_email = f"test-payment-{uuid4()}@example.com"
        user = User(
            email=unique_email,
            hashed_password=get_password_hash("testpassword"),
            first_name="Test",
            last_name="User",
            is_email_verified=True,
            status=UserStatus.ACTIVE,
            subscription_status=SubscriptionStatus.ACTIVE,
        )
        db_session.add(user)
        db_session.flush()
        
        # Create organization
        org = Organization(
            name="Test Organization",
            slug=f"test-org-{uuid4()}",
            owner_id=user.id,
        )
        db_session.add(org)
        db_session.flush()
        
        # Create business
        business = Business(
            name="Test Business",
            slug=f"test-business-{uuid4()}",
            organization_id=org.id,
            email="test@business.com",
            phone="1234567890",
        )
        db_session.add(business)
        db_session.commit()
        db_session.refresh(business)
        return business

    @pytest.fixture
    def customer(self, db_session, business):
        """Create a test customer."""
        from uuid import uuid4
        
        customer = Customer(
            business_id=business.id,
            customer_type=CustomerType.INDIVIDUAL,
            first_name="John",
            last_name="Doe",
            email=f"john.doe-{uuid4()}@example.com",
            phone="1234567890",
        )
        db_session.add(customer)
        db_session.commit()
        db_session.refresh(customer)
        return customer

    @pytest.fixture
    def user(self, db_session):
        """Create a test user."""
        from app.models.user import User, UserStatus, SubscriptionStatus
        from app.core.security import get_password_hash
        from uuid import uuid4
        
        user = User(
            email=f"cashier-{uuid4()}@example.com",
            hashed_password=get_password_hash("testpassword"),
            first_name="Cashier",
            last_name="User",
            is_email_verified=True,
            status=UserStatus.ACTIVE,
            subscription_status=SubscriptionStatus.ACTIVE,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def active_account(self, db_session, business, customer):
        """Create an active customer account with balance."""
        from app.services.customer_account_service import CustomerAccountService
        from app.schemas.customer_account import AccountCreate
        
        service = CustomerAccountService(db_session)
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        service.activate_account(account)
        
        # Set a balance
        account.current_balance = Decimal('1500')
        db_session.commit()
        db_session.refresh(account)
        
        return account

    @pytest.fixture
    def service(self, db_session):
        """Create CustomerAccountService instance."""
        return CustomerAccountService(db_session)

    def test_record_payment_success(self, service, active_account, user):
        """Test successful payment recording."""
        from app.schemas.customer_account import PaymentCreate
        
        payment_data = PaymentCreate(
            amount=Decimal('500'),
            payment_method="cash",
            reference_number="PAY-001",
            notes="Payment for invoice #123",
        )
        
        payment = service.record_payment(active_account, payment_data, user.id)
        
        assert payment.id is not None
        assert payment.account_id == active_account.id
        assert payment.amount == Decimal('500')
        assert payment.payment_method == "cash"
        assert payment.reference_number == "PAY-001"
        assert payment.notes == "Payment for invoice #123"
        assert payment.received_by == user.id
        assert payment.created_at is not None

    def test_record_payment_multiple_methods(self, service, active_account, user):
        """Test recording payments with different payment methods."""
        from app.schemas.customer_account import PaymentCreate
        
        methods = ["cash", "card", "bank_transfer", "check", "mobile_money"]
        
        for method in methods:
            payment_data = PaymentCreate(
                amount=Decimal('100'),
                payment_method=method,
            )
            
            payment = service.record_payment(active_account, payment_data, user.id)
            
            assert payment.payment_method == method
            assert payment.amount == Decimal('100')

    def test_record_payment_with_reference(self, service, active_account, user):
        """Test recording payment with reference number."""
        from app.schemas.customer_account import PaymentCreate
        
        payment_data = PaymentCreate(
            amount=Decimal('750'),
            payment_method="bank_transfer",
            reference_number="TXN-2024-001",
        )
        
        payment = service.record_payment(active_account, payment_data, user.id)
        
        assert payment.reference_number == "TXN-2024-001"

    def test_record_payment_with_notes(self, service, active_account, user):
        """Test recording payment with notes."""
        from app.schemas.customer_account import PaymentCreate
        
        payment_data = PaymentCreate(
            amount=Decimal('250'),
            payment_method="cash",
            notes="Partial payment - customer will pay balance next week",
        )
        
        payment = service.record_payment(active_account, payment_data, user.id)
        
        assert payment.notes == "Partial payment - customer will pay balance next week"

    def test_record_payment_zero_amount_fails(self, service, active_account, user):
        """Test that recording payment with zero amount fails at schema validation."""
        from app.schemas.customer_account import PaymentCreate
        from pydantic import ValidationError
        
        # Pydantic schema validates amount > 0
        with pytest.raises(ValidationError):
            PaymentCreate(
                amount=Decimal('0'),
                payment_method="cash",
            )

    def test_record_payment_negative_amount_fails(self, service, active_account, user):
        """Test that recording payment with negative amount fails at schema validation."""
        from app.schemas.customer_account import PaymentCreate
        from pydantic import ValidationError
        
        # Pydantic schema validates amount > 0
        with pytest.raises(ValidationError):
            PaymentCreate(
                amount=Decimal('-100'),
                payment_method="cash",
            )

    def test_record_payment_empty_method_fails(self, service, active_account, user):
        """Test that recording payment with empty payment method fails at schema validation."""
        from app.schemas.customer_account import PaymentCreate
        from pydantic import ValidationError
        
        # Pydantic schema validates payment_method is not empty
        with pytest.raises(ValidationError):
            PaymentCreate(
                amount=Decimal('100'),
                payment_method="",
            )

    def test_record_payment_whitespace_method_fails(self, service, active_account, user):
        """Test that recording payment with whitespace-only payment method fails."""
        from app.schemas.customer_account import PaymentCreate
        
        payment_data = PaymentCreate(
            amount=Decimal('100'),
            payment_method="   ",
        )
        
        with pytest.raises(ValueError, match="Payment method is required"):
            service.record_payment(active_account, payment_data, user.id)

    def test_record_payment_closed_account_fails(self, service, business, customer, user, db_session):
        """Test that recording payment for closed account fails."""
        from app.schemas.customer_account import AccountCreate, PaymentCreate
        
        # Create and close account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        service.activate_account(account)
        service.close_account(account)
        
        # Try to record payment
        payment_data = PaymentCreate(
            amount=Decimal('100'),
            payment_method="cash",
        )
        
        with pytest.raises(ValueError, match="closed account"):
            service.record_payment(account, payment_data, user.id)

    def test_record_payment_suspended_account_allowed(self, service, business, customer, user, db_session):
        """Test that recording payment for suspended account is allowed."""
        from app.schemas.customer_account import AccountCreate, PaymentCreate
        
        # Create and suspend account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        service.activate_account(account)
        
        # Set balance and suspend
        account.current_balance = Decimal('1000')
        db_session.commit()
        service.suspend_account(account, "Overdue payment")
        
        # Record payment should succeed
        payment_data = PaymentCreate(
            amount=Decimal('500'),
            payment_method="cash",
        )
        
        payment = service.record_payment(account, payment_data, user.id)
        
        assert payment.amount == Decimal('500')

    def test_record_payment_pending_account_allowed(self, service, business, customer, user):
        """Test that recording payment for pending account is allowed."""
        from app.schemas.customer_account import AccountCreate, PaymentCreate
        
        # Create account (pending status)
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        
        # Record payment should succeed
        payment_data = PaymentCreate(
            amount=Decimal('100'),
            payment_method="cash",
        )
        
        payment = service.record_payment(account, payment_data, user.id)
        
        assert payment.amount == Decimal('100')

    def test_record_payment_large_amount(self, service, active_account, user):
        """Test recording payment with large amount."""
        from app.schemas.customer_account import PaymentCreate
        
        payment_data = PaymentCreate(
            amount=Decimal('999999.99'),
            payment_method="bank_transfer",
        )
        
        payment = service.record_payment(active_account, payment_data, user.id)
        
        assert payment.amount == Decimal('999999.99')

    def test_record_payment_decimal_precision(self, service, active_account, user):
        """Test recording payment maintains decimal precision."""
        from app.schemas.customer_account import PaymentCreate
        
        payment_data = PaymentCreate(
            amount=Decimal('123.45'),
            payment_method="cash",
        )
        
        payment = service.record_payment(active_account, payment_data, user.id)
        
        assert payment.amount == Decimal('123.45')
        assert str(payment.amount) == "123.45"

    def test_record_multiple_payments(self, service, active_account, user):
        """Test recording multiple payments for same account."""
        from app.schemas.customer_account import PaymentCreate
        
        # Record first payment
        payment1_data = PaymentCreate(
            amount=Decimal('300'),
            payment_method="cash",
        )
        payment1 = service.record_payment(active_account, payment1_data, user.id)
        
        # Record second payment
        payment2_data = PaymentCreate(
            amount=Decimal('200'),
            payment_method="card",
        )
        payment2 = service.record_payment(active_account, payment2_data, user.id)
        
        # Both should succeed
        assert payment1.id != payment2.id
        assert payment1.amount == Decimal('300')
        assert payment2.amount == Decimal('200')

    def test_record_payment_does_not_update_balance(self, service, active_account, user, db_session):
        """Test that recording payment does NOT update account balance (allocation does that)."""
        from app.schemas.customer_account import PaymentCreate
        
        initial_balance = active_account.current_balance
        
        payment_data = PaymentCreate(
            amount=Decimal('500'),
            payment_method="cash",
        )
        
        service.record_payment(active_account, payment_data, user.id)
        
        # Refresh account
        db_session.refresh(active_account)
        
        # Balance should NOT change (allocation handles that)
        assert active_account.current_balance == initial_balance

    def test_payment_unallocated_amount_initial(self, service, active_account, user, db_session):
        """Test that newly recorded payment has full amount unallocated."""
        from app.schemas.customer_account import PaymentCreate
        
        payment_data = PaymentCreate(
            amount=Decimal('500'),
            payment_method="cash",
        )
        
        payment = service.record_payment(active_account, payment_data, user.id)
        
        # Refresh to get relationships
        db_session.refresh(payment)
        
        # Should have no allocations yet
        assert payment.allocated_amount == Decimal('0')
        assert payment.unallocated_amount == Decimal('500')



class TestPaymentAllocation:
    """Test suite for payment allocation (FIFO) functionality."""

    @pytest.fixture
    def business(self, db_session):
        """Create a test business."""
        import uuid
        from app.models.organization import Organization
        from app.models.user import User, UserStatus, SubscriptionStatus
        from app.core.security import get_password_hash
        
        # Use unique identifier to avoid collisions
        unique_id = uuid.uuid4().hex[:8]
        
        # Create user first
        user = User(
            email=f"test-alloc-{unique_id}@example.com",
            hashed_password=get_password_hash("testpassword"),
            first_name="Test",
            last_name="User",
            is_email_verified=True,
            status=UserStatus.ACTIVE,
            subscription_status=SubscriptionStatus.ACTIVE,
        )
        db_session.add(user)
        db_session.flush()
        
        # Create organization
        org = Organization(
            name=f"Test Organization {unique_id}",
            slug=f"test-org-alloc-{unique_id}",
            owner_id=user.id,
        )
        db_session.add(org)
        db_session.flush()
        
        # Create business
        from app.models.business import Business
        business = Business(
            name=f"Test Business {unique_id}",
            slug=f"test-business-alloc-{unique_id}",
            organization_id=org.id,
            currency="USD",
        )
        db_session.add(business)
        db_session.commit()
        return business