"""Unit tests for statement generation functionality."""

import pytest
from decimal import Decimal
from datetime import datetime, date, timedelta
from uuid import uuid4

from app.services.customer_account_service import CustomerAccountService
from app.models.customer_account import (
    CustomerAccount,
    AccountStatus,
    AccountTransaction,
    TransactionType,
    AccountStatement,
)
from app.models.customer import Customer
from app.models.business import Business
from app.models.user import User
from app.schemas.customer_account import PaymentCreate


class TestStatementGeneration:
    """Test suite for statement generation functionality."""

    @pytest.fixture
    def service(self, db_session):
        """Create a CustomerAccountService instance."""
        return CustomerAccountService(db_session)

    @pytest.fixture
    def business(self, db_session):
        """Create a test business."""
        from app.models.organization import Organization
        from app.models.user import User, UserStatus, SubscriptionStatus
        from app.core.security import get_password_hash
        import uuid
        
        # Create user first (required for organization owner) with unique email
        unique_email = f"test-{uuid.uuid4().hex[:8]}@example.com"
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
        
        # Create organization with unique slug
        unique_slug = f"test-org-{uuid.uuid4().hex[:8]}"
        org = Organization(
            name="Test Organization",
            slug=unique_slug,
            owner_id=user.id,
        )
        db_session.add(org)
        db_session.flush()
        
        # Create business with unique slug
        business_slug = f"test-business-{uuid.uuid4().hex[:8]}"
        business = Business(
            name="Test Business",
            slug=business_slug,
            organization_id=org.id,
            email="test@business.com",
            phone="1234567890",
        )
        db_session.add(business)
        db_session.commit()
        db_session.refresh(business)
        return business

    @pytest.fixture
    def user(self, db_session, business):
        """Create a test user."""
        from app.models.user import UserStatus, SubscriptionStatus
        from app.core.security import get_password_hash
        
        unique_id = uuid4().hex[:8]
        user = User(
            email=f"testuser-{unique_id}@example.com",
            hashed_password=get_password_hash("testpassword"),
            first_name="Test",
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
    def customer(self, db_session, business):
        """Create a test customer."""
        from app.models.customer import CustomerType
        
        unique_id = uuid4().hex[:8]
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
    def account(self, db_session, service, business, customer):
        """Create a test customer account."""
        from app.schemas.customer_account import AccountCreate
        
        account_data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('10000.00'),
            payment_terms=30,
        )
        
        account = service.create_account(business.id, account_data)
        
        # Activate the account
        account = service.activate_account(account)
        
        return account

    def test_generate_statement_basic(self, service, account, user):
        """Test basic statement generation with charges and payments."""
        # Create some charges
        charge1 = service.charge_to_account(
            account=account,
            amount=Decimal('1000.00'),
            user_id=user.id,
            description="Charge 1",
        )
        
        charge2 = service.charge_to_account(
            account=account,
            amount=Decimal('500.00'),
            user_id=user.id,
            description="Charge 2",
        )
        
        # Create a payment
        payment_data = PaymentCreate(
            amount=Decimal('600.00'),
            payment_method="cash",
        )
        payment, allocations = service.process_payment(account, payment_data, user.id)
        
        # Generate statement
        period_end = date.today()
        period_start = period_end - timedelta(days=30)
        
        statement = service.generate_statement(
            account=account,
            period_end=period_end,
            period_start=period_start,
        )
        
        # Verify statement
        assert statement is not None
        assert statement.account_id == account.id
        assert statement.period_start == period_start
        assert statement.period_end == period_end
        assert statement.opening_balance == Decimal('0')
        assert statement.total_charges == Decimal('1500.00')
        assert statement.total_payments == Decimal('600.00')
        assert statement.closing_balance == Decimal('900.00')
        
        # Verify Property 4: closing_balance = opening_balance + charges - payments
        expected_closing = statement.opening_balance + statement.total_charges - statement.total_payments
        assert statement.closing_balance == expected_closing

    def test_generate_statement_property_4_validation(self, service, account, user):
        """Test that statement generation validates Property 4: Statement Accuracy."""
        # Create charges
        service.charge_to_account(account, Decimal('1000.00'), user.id, description="Charge 1")
        service.charge_to_account(account, Decimal('2000.00'), user.id, description="Charge 2")
        
        # Create payment
        payment_data = PaymentCreate(amount=Decimal('1500.00'), payment_method="card")
        service.process_payment(account, payment_data, user.id)
        
        # Generate statement
        statement = service.generate_statement(
            account=account,
            period_end=date.today(),
        )
        
        # Verify Property 4 using the verification method
        verification = service.verify_statement_accuracy(statement)
        
        assert verification['is_accurate'] is True
        assert verification['property_4_satisfied'] is True
        assert verification['difference'] <= Decimal('0.01')
        assert "accurate" in verification['message'].lower()

    def test_generate_statement_with_opening_balance(self, service, account, user):
        """Test statement generation with existing opening balance."""
        # Create charges in the past (before statement period)
        past_date = datetime.utcnow() - timedelta(days=60)
        
        # Manually create a transaction in the past
        past_transaction = AccountTransaction(
            account_id=account.id,
            transaction_type=TransactionType.CHARGE,
            amount=Decimal('500.00'),
            balance_after=Decimal('500.00'),
            description="Past charge",
            created_by=user.id,
            created_at=past_date,
        )
        service.db.add(past_transaction)
        account.current_balance = Decimal('500.00')
        service.db.commit()
        
        # Create charges in current period
        service.charge_to_account(account, Decimal('1000.00'), user.id, description="Current charge")
        
        # Generate statement for current month
        period_end = date.today()
        period_start = period_end - timedelta(days=30)
        
        statement = service.generate_statement(
            account=account,
            period_end=period_end,
            period_start=period_start,
        )
        
        # Verify opening balance includes past transaction
        assert statement.opening_balance == Decimal('500.00')
        assert statement.total_charges == Decimal('1000.00')
        assert statement.closing_balance == Decimal('1500.00')

    def test_generate_statement_with_aging_breakdown(self, service, account, user):
        """Test that statement includes aging breakdown."""
        # Create charges with different due dates
        today = date.today()
        
        # Current charge (not overdue)
        service.charge_to_account(
            account=account,
            amount=Decimal('100.00'),
            user_id=user.id,
            description="Current",
            due_date=today + timedelta(days=10),
        )
        
        # 30 days overdue
        service.charge_to_account(
            account=account,
            amount=Decimal('200.00'),
            user_id=user.id,
            description="30 days",
            due_date=today - timedelta(days=35),
        )
        
        # 60 days overdue
        service.charge_to_account(
            account=account,
            amount=Decimal('300.00'),
            user_id=user.id,
            description="60 days",
            due_date=today - timedelta(days=65),
        )
        
        # 90+ days overdue
        service.charge_to_account(
            account=account,
            amount=Decimal('400.00'),
            user_id=user.id,
            description="90+ days",
            due_date=today - timedelta(days=95),
        )
        
        # Generate statement
        statement = service.generate_statement(
            account=account,
            period_end=today,
        )
        
        # Verify aging breakdown is populated
        assert statement.current_amount >= Decimal('0')
        assert statement.days_30_amount >= Decimal('0')
        assert statement.days_60_amount >= Decimal('0')
        assert statement.days_90_plus_amount >= Decimal('0')
        
        # Verify aging total matches closing balance
        aging_total = (
            statement.current_amount +
            statement.days_30_amount +
            statement.days_60_amount +
            statement.days_90_plus_amount
        )
        assert abs(aging_total - statement.closing_balance) <= Decimal('0.01')

    def test_generate_statement_empty_period(self, service, account):
        """Test statement generation for a period with no transactions."""
        # Generate statement without any transactions
        period_end = date.today()
        period_start = period_end - timedelta(days=30)
        
        statement = service.generate_statement(
            account=account,
            period_end=period_end,
            period_start=period_start,
        )
        
        # Verify empty statement
        assert statement.opening_balance == Decimal('0')
        assert statement.total_charges == Decimal('0')
        assert statement.total_payments == Decimal('0')
        assert statement.closing_balance == Decimal('0')

    def test_generate_statement_with_adjustments(self, service, account, user):
        """Test statement generation with balance adjustments."""
        # Create charge
        service.charge_to_account(account, Decimal('1000.00'), user.id, description="Charge")
        
        # Create positive adjustment (increases balance)
        service.adjust_balance(account, Decimal('50.00'), "Late fee", user.id)
        
        # Create negative adjustment (decreases balance)
        service.adjust_balance(account, Decimal('-25.00'), "Discount", user.id)
        
        # Generate statement
        statement = service.generate_statement(
            account=account,
            period_end=date.today(),
        )
        
        # Adjustments should be included in charges/payments
        # Positive adjustments add to charges, negative add to payments
        assert statement.total_charges == Decimal('1050.00')  # 1000 + 50
        assert statement.total_payments == Decimal('25.00')  # abs(-25)
        assert statement.closing_balance == Decimal('1025.00')

    def test_generate_statement_invalid_period(self, service, account):
        """Test that invalid period dates raise ValueError."""
        period_start = date.today()
        period_end = period_start - timedelta(days=30)  # End before start
        
        with pytest.raises(ValueError, match="cannot be after"):
            service.generate_statement(
                account=account,
                period_end=period_end,
                period_start=period_start,
            )

    def test_generate_statement_auto_period_start(self, service, account, user):
        """Test that period_start is automatically determined if not provided."""
        # Create a charge
        service.charge_to_account(account, Decimal('1000.00'), user.id, description="Charge")
        
        # Generate statement without specifying period_start
        statement = service.generate_statement(
            account=account,
            period_end=date.today(),
        )
        
        # Verify statement was created with auto-determined period_start
        assert statement is not None
        assert statement.period_start is not None
        assert statement.period_start < statement.period_end

    def test_generate_statement_consecutive_periods(self, service, account, user):
        """Test generating consecutive statements."""
        # Create charges
        service.charge_to_account(account, Decimal('1000.00'), user.id, description="Charge 1")
        
        # Generate first statement
        period1_end = date.today() - timedelta(days=30)
        period1_start = period1_end - timedelta(days=30)
        
        statement1 = service.generate_statement(
            account=account,
            period_end=period1_end,
            period_start=period1_start,
        )
        
        # Create more charges
        service.charge_to_account(account, Decimal('500.00'), user.id, description="Charge 2")
        
        # Generate second statement (should start from day after first statement ended)
        period2_end = date.today()
        
        statement2 = service.generate_statement(
            account=account,
            period_end=period2_end,
        )
        
        # Verify second statement starts after first statement ends
        assert statement2.period_start == statement1.period_end + timedelta(days=1)
        
        # Verify opening balance of second statement equals closing balance of first
        assert statement2.opening_balance == statement1.closing_balance

    def test_get_statement_transactions(self, service, account, user):
        """Test retrieving transactions for a statement."""
        # Create transactions
        charge1 = service.charge_to_account(account, Decimal('1000.00'), user.id, description="Charge 1")
        charge2 = service.charge_to_account(account, Decimal('500.00'), user.id, description="Charge 2")
        
        payment_data = PaymentCreate(amount=Decimal('600.00'), payment_method="cash")
        payment, allocations = service.process_payment(account, payment_data, user.id)
        
        # Generate statement
        statement = service.generate_statement(
            account=account,
            period_end=date.today(),
        )
        
        # Get statement transactions
        transactions = service.get_statement_transactions(statement)
        
        # Verify transactions are returned
        assert len(transactions) >= 3  # 2 charges + 1 payment
        
        # Verify transactions are in chronological order
        for i in range(len(transactions) - 1):
            assert transactions[i].created_at <= transactions[i + 1].created_at

    def test_verify_statement_accuracy(self, service, account, user):
        """Test statement accuracy verification."""
        # Create transactions
        service.charge_to_account(account, Decimal('1000.00'), user.id, description="Charge")
        
        payment_data = PaymentCreate(amount=Decimal('400.00'), payment_method="cash")
        service.process_payment(account, payment_data, user.id)
        
        # Generate statement
        statement = service.generate_statement(
            account=account,
            period_end=date.today(),
        )
        
        # Verify accuracy
        verification = service.verify_statement_accuracy(statement)
        
        assert verification['is_accurate'] is True
        assert verification['property_4_satisfied'] is True
        assert verification['aging_matches'] is True
        assert verification['difference'] <= Decimal('0.01')

    def test_generate_monthly_statements(self, service, business, customer, user):
        """Test generating monthly statements for all active accounts."""
        from app.schemas.customer_account import AccountCreate
        from app.models.customer import CustomerType
        
        # Create multiple accounts
        accounts = []
        for i in range(3):
            customer_i = Customer(
                business_id=business.id,
                customer_type=CustomerType.INDIVIDUAL,
                first_name=f"Customer{i}",
                last_name=f"Test{i}",
                email=f"customer{i}@example.com",
                phone=f"123456789{i}",
            )
            service.db.add(customer_i)
            service.db.commit()
            
            account_data = AccountCreate(
                customer_id=customer_i.id,
                credit_limit=Decimal('5000.00'),
                payment_terms=30,
            )
            account = service.create_account(business.id, account_data)
            account = service.activate_account(account)
            
            # Create a charge for each account
            service.charge_to_account(account, Decimal('1000.00'), user.id, description=f"Charge {i}")
            
            accounts.append(account)
        
        # Generate monthly statements for all accounts
        today = date.today()
        statements = service.generate_monthly_statements(
            business_id=business.id,
            month=today.month,
            year=today.year,
        )
        
        # Verify statements were generated for all active accounts
        assert len(statements) == 3
        
        # Verify each statement
        for statement in statements:
            assert statement.account_id in [acc.id for acc in accounts]
            assert statement.total_charges == Decimal('1000.00')
            assert statement.closing_balance == Decimal('1000.00')

    def test_generate_monthly_statements_invalid_month(self, service, business):
        """Test that invalid month raises ValueError."""
        with pytest.raises(ValueError, match="Invalid month"):
            service.generate_monthly_statements(
                business_id=business.id,
                month=13,  # Invalid month
                year=2024,
            )

    def test_generate_monthly_statements_invalid_year(self, service, business):
        """Test that invalid year raises ValueError."""
        with pytest.raises(ValueError, match="Invalid year"):
            service.generate_monthly_statements(
                business_id=business.id,
                month=1,
                year=1999,  # Invalid year
            )

    def test_statement_with_write_offs(self, service, account, user):
        """Test statement generation with write-offs."""
        # Create charge
        service.charge_to_account(account, Decimal('1000.00'), user.id, description="Charge")
        
        # Create write-off transaction
        write_off_transaction = AccountTransaction(
            account_id=account.id,
            transaction_type=TransactionType.WRITE_OFF,
            amount=Decimal('200.00'),
            balance_after=Decimal('800.00'),
            description="Bad debt write-off",
            created_by=user.id,
        )
        service.db.add(write_off_transaction)
        account.current_balance = Decimal('800.00')
        service.db.commit()
        
        # Generate statement
        statement = service.generate_statement(
            account=account,
            period_end=date.today(),
        )
        
        # Write-offs should be counted as payments
        assert statement.total_charges == Decimal('1000.00')
        assert statement.total_payments == Decimal('200.00')
        assert statement.closing_balance == Decimal('800.00')

    def test_statement_accuracy_with_multiple_transactions(self, service, account, user):
        """Test Property 4 with complex transaction history."""
        # Create multiple charges
        for i in range(5):
            service.charge_to_account(
                account,
                Decimal(f'{(i + 1) * 100}.00'),
                user.id,
                description=f"Charge {i + 1}",
            )
        
        # Create multiple payments
        for i in range(3):
            payment_data = PaymentCreate(
                amount=Decimal(f'{(i + 1) * 150}.00'),
                payment_method="cash",
            )
            service.process_payment(account, payment_data, user.id)
        
        # Create adjustments
        service.adjust_balance(account, Decimal('50.00'), "Late fee", user.id)
        service.adjust_balance(account, Decimal('-25.00'), "Discount", user.id)
        
        # Generate statement
        statement = service.generate_statement(
            account=account,
            period_end=date.today(),
        )
        
        # Verify Property 4
        expected_closing = (
            statement.opening_balance +
            statement.total_charges -
            statement.total_payments
        )
        assert statement.closing_balance == expected_closing
        
        # Verify using verification method
        verification = service.verify_statement_accuracy(statement)
        assert verification['is_accurate'] is True
        assert verification['property_4_satisfied'] is True
