"""Unit tests for payment allocation (FIFO) functionality."""

import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import uuid4

from app.services.customer_account_service import CustomerAccountService
from app.models.customer_account import (
    CustomerAccount,
    AccountStatus,
    AccountTransaction,
    TransactionType,
    AccountPayment,
    PaymentAllocation,
)
from app.models.customer import Customer, CustomerType
from app.models.business import Business
from app.schemas.customer_account import AccountCreate, PaymentCreate


class TestPaymentAllocation:
    """Test suite for payment allocation (FIFO) functionality."""

    @pytest.fixture
    def business(self, db_session):
        """Create a test business."""
        from app.models.organization import Organization
        from app.models.user import User, UserStatus, SubscriptionStatus
        from app.core.security import get_password_hash
        
        # Create user first with unique email
        unique_email = f"test-alloc-{uuid4()}@example.com"
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
        """Create an active customer account."""
        service = CustomerAccountService(db_session)
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('10000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        service.activate_account(account)
        return account

    @pytest.fixture
    def service(self, db_session):
        """Create CustomerAccountService instance."""
        return CustomerAccountService(db_session)

    def test_allocate_payment_single_charge_full_payment(
        self, service, active_account, user, db_session
    ):
        """Test allocating payment that fully pays a single charge."""
        # Create a charge
        charge = service.charge_to_account(
            active_account,
            Decimal('500'),
            user.id,
            description="Test charge 1",
        )
        
        # Record payment
        payment_data = PaymentCreate(
            amount=Decimal('500'),
            payment_method="cash",
        )
        payment = service.record_payment(active_account, payment_data, user.id)
        
        # Allocate payment
        allocations = service.allocate_payment(payment)
        
        # Verify allocation
        assert len(allocations) == 1
        assert allocations[0].payment_id == payment.id
        assert allocations[0].transaction_id == charge.id
        assert allocations[0].amount == Decimal('500')
        
        # Verify payment is fully allocated
        db_session.refresh(payment)
        assert payment.allocated_amount == Decimal('500')
        assert payment.unallocated_amount == Decimal('0')
        
        # Verify account balance is updated
        db_session.refresh(active_account)
        assert active_account.current_balance == Decimal('0')

    def test_allocate_payment_single_charge_partial_payment(
        self, service, active_account, user, db_session
    ):
        """Test allocating payment that partially pays a single charge."""
        # Create a charge
        charge = service.charge_to_account(
            active_account,
            Decimal('1000'),
            user.id,
            description="Test charge 1",
        )
        
        # Record partial payment
        payment_data = PaymentCreate(
            amount=Decimal('400'),
            payment_method="cash",
        )
        payment = service.record_payment(active_account, payment_data, user.id)
        
        # Allocate payment
        allocations = service.allocate_payment(payment)
        
        # Verify allocation
        assert len(allocations) == 1
        assert allocations[0].amount == Decimal('400')
        
        # Verify payment is fully allocated
        db_session.refresh(payment)
        assert payment.allocated_amount == Decimal('400')
        assert payment.unallocated_amount == Decimal('0')
        
        # Verify account balance is updated
        db_session.refresh(active_account)
        assert active_account.current_balance == Decimal('600')

    def test_allocate_payment_multiple_charges_fifo(
        self, service, active_account, user, db_session
    ):
        """Test FIFO allocation across multiple charges."""
        # Create three charges at different times
        charge1 = service.charge_to_account(
            active_account,
            Decimal('300'),
            user.id,
            description="Oldest charge",
        )
        db_session.flush()
        
        # Add small delay to ensure different timestamps
        import time
        time.sleep(0.01)
        
        charge2 = service.charge_to_account(
            active_account,
            Decimal('400'),
            user.id,
            description="Middle charge",
        )
        db_session.flush()
        
        time.sleep(0.01)
        
        charge3 = service.charge_to_account(
            active_account,
            Decimal('500'),
            user.id,
            description="Newest charge",
        )
        
        # Record payment that covers first two charges
        payment_data = PaymentCreate(
            amount=Decimal('700'),
            payment_method="cash",
        )
        payment = service.record_payment(active_account, payment_data, user.id)
        
        # Allocate payment
        allocations = service.allocate_payment(payment)
        
        # Verify FIFO allocation
        assert len(allocations) == 2
        
        # First allocation should be to oldest charge (charge1)
        assert allocations[0].transaction_id == charge1.id
        assert allocations[0].amount == Decimal('300')
        
        # Second allocation should be to middle charge (charge2)
        assert allocations[1].transaction_id == charge2.id
        assert allocations[1].amount == Decimal('400')
        
        # Verify payment is fully allocated
        db_session.refresh(payment)
        assert payment.allocated_amount == Decimal('700')
        assert payment.unallocated_amount == Decimal('0')
        
        # Verify account balance
        db_session.refresh(active_account)
        assert active_account.current_balance == Decimal('500')  # Only charge3 remains

    def test_allocate_payment_multiple_charges_partial_last(
        self, service, active_account, user, db_session
    ):
        """Test FIFO allocation with partial payment on last charge."""
        # Create three charges
        charge1 = service.charge_to_account(
            active_account,
            Decimal('200'),
            user.id,
            description="Charge 1",
        )
        
        charge2 = service.charge_to_account(
            active_account,
            Decimal('300'),
            user.id,
            description="Charge 2",
        )
        
        charge3 = service.charge_to_account(
            active_account,
            Decimal('400'),
            user.id,
            description="Charge 3",
        )
        
        # Payment that covers first two and partially third
        payment_data = PaymentCreate(
            amount=Decimal('650'),
            payment_method="cash",
        )
        payment = service.record_payment(active_account, payment_data, user.id)
        
        # Allocate payment
        allocations = service.allocate_payment(payment)
        
        # Verify allocations
        assert len(allocations) == 3
        assert allocations[0].transaction_id == charge1.id
        assert allocations[0].amount == Decimal('200')
        assert allocations[1].transaction_id == charge2.id
        assert allocations[1].amount == Decimal('300')
        assert allocations[2].transaction_id == charge3.id
        assert allocations[2].amount == Decimal('150')  # Partial
        
        # Verify account balance
        db_session.refresh(active_account)
        assert active_account.current_balance == Decimal('250')  # 400 - 150

    def test_allocate_payment_overpayment(
        self, service, active_account, user, db_session
    ):
        """Test allocating payment larger than total charges."""
        # Create a charge
        charge = service.charge_to_account(
            active_account,
            Decimal('500'),
            user.id,
            description="Test charge",
        )
        
        # Record overpayment
        payment_data = PaymentCreate(
            amount=Decimal('800'),
            payment_method="cash",
        )
        payment = service.record_payment(active_account, payment_data, user.id)
        
        # Allocate payment
        allocations = service.allocate_payment(payment)
        
        # Verify allocation only covers the charge
        assert len(allocations) == 1
        assert allocations[0].amount == Decimal('500')
        
        # Verify payment has unallocated amount
        db_session.refresh(payment)
        assert payment.allocated_amount == Decimal('500')
        assert payment.unallocated_amount == Decimal('300')
        
        # Verify account balance is zero (can't go negative)
        db_session.refresh(active_account)
        assert active_account.current_balance == Decimal('0')

    def test_allocate_payment_no_charges(
        self, service, active_account, user, db_session
    ):
        """Test allocating payment when there are no charges."""
        # Record payment without any charges
        payment_data = PaymentCreate(
            amount=Decimal('500'),
            payment_method="cash",
        )
        payment = service.record_payment(active_account, payment_data, user.id)
        
        # Allocate payment
        allocations = service.allocate_payment(payment)
        
        # Verify no allocations created
        assert len(allocations) == 0
        
        # Verify payment remains unallocated
        db_session.refresh(payment)
        assert payment.allocated_amount == Decimal('0')
        assert payment.unallocated_amount == Decimal('500')
        
        # Verify account balance is updated to zero
        db_session.refresh(active_account)
        assert active_account.current_balance == Decimal('0')

    def test_allocate_payment_already_allocated_fails(
        self, service, active_account, user, db_session
    ):
        """Test that allocating an already-allocated payment fails."""
        # Create a charge
        charge = service.charge_to_account(
            active_account,
            Decimal('500'),
            user.id,
            description="Test charge",
        )
        
        # Record and allocate payment
        payment_data = PaymentCreate(
            amount=Decimal('500'),
            payment_method="cash",
        )
        payment = service.record_payment(active_account, payment_data, user.id)
        service.allocate_payment(payment)
        
        # Try to allocate again
        db_session.refresh(payment)
        with pytest.raises(ValueError, match="already fully allocated"):
            service.allocate_payment(payment)

    def test_allocate_payment_closed_account_fails(
        self, service, business, customer, user, db_session
    ):
        """Test that allocating payment for closed account fails."""
        # Create and close account
        data = AccountCreate(
            customer_id=customer.id,
            credit_limit=Decimal('5000'),
            payment_terms=30,
        )
        account = service.create_account(business.id, data)
        service.activate_account(account)
        service.close_account(account)
        
        # Try to allocate payment
        payment_data = PaymentCreate(
            amount=Decimal('100'),
            payment_method="cash",
        )
        payment = service.record_payment(account, payment_data, user.id)
        
        with pytest.raises(ValueError, match="closed account"):
            service.allocate_payment(payment)

    def test_allocate_payment_creates_transaction(
        self, service, active_account, user, db_session
    ):
        """Test that allocation creates a payment transaction."""
        # Create a charge
        charge = service.charge_to_account(
            active_account,
            Decimal('500'),
            user.id,
            description="Test charge",
        )
        
        # Record payment
        payment_data = PaymentCreate(
            amount=Decimal('500'),
            payment_method="cash",
            reference_number="PAY-001",
        )
        payment = service.record_payment(active_account, payment_data, user.id)
        
        # Get transaction count before allocation
        initial_txn_count = db_session.query(AccountTransaction).filter(
            AccountTransaction.account_id == active_account.id
        ).count()
        
        # Allocate payment
        service.allocate_payment(payment)
        
        # Verify payment transaction was created
        final_txn_count = db_session.query(AccountTransaction).filter(
            AccountTransaction.account_id == active_account.id
        ).count()
        assert final_txn_count == initial_txn_count + 1
        
        # Verify transaction details
        payment_txn = db_session.query(AccountTransaction).filter(
            AccountTransaction.account_id == active_account.id,
            AccountTransaction.transaction_type == TransactionType.PAYMENT,
        ).first()
        
        assert payment_txn is not None
        assert payment_txn.amount == Decimal('500')
        assert payment_txn.reference_type == 'payment'
        assert payment_txn.reference_id == payment.id
        assert "cash" in payment_txn.description.lower()
        assert "PAY-001" in payment_txn.description

    def test_allocate_payment_with_previous_partial_payment(
        self, service, active_account, user, db_session
    ):
        """Test FIFO allocation when charges have previous partial payments."""
        # Create two charges
        charge1 = service.charge_to_account(
            active_account,
            Decimal('1000'),
            user.id,
            description="Charge 1",
        )
        
        charge2 = service.charge_to_account(
            active_account,
            Decimal('800'),
            user.id,
            description="Charge 2",
        )
        
        # Make partial payment on first charge
        payment1_data = PaymentCreate(
            amount=Decimal('600'),
            payment_method="cash",
        )
        payment1 = service.record_payment(active_account, payment1_data, user.id)
        service.allocate_payment(payment1)
        
        # Make second payment
        payment2_data = PaymentCreate(
            amount=Decimal('700'),
            payment_method="cash",
        )
        payment2 = service.record_payment(active_account, payment2_data, user.id)
        
        # Allocate second payment
        allocations = service.allocate_payment(payment2)
        
        # Should allocate to remaining balance of charge1 first, then charge2
        assert len(allocations) == 2
        assert allocations[0].transaction_id == charge1.id
        assert allocations[0].amount == Decimal('400')  # Remaining from charge1
        assert allocations[1].transaction_id == charge2.id
        assert allocations[1].amount == Decimal('300')  # Partial of charge2
        
        # Verify account balance
        db_session.refresh(active_account)
        assert active_account.current_balance == Decimal('500')  # 800 - 300

    def test_allocate_payment_decimal_precision(
        self, service, active_account, user, db_session
    ):
        """Test that allocation maintains decimal precision."""
        # Create charges with precise amounts
        charge1 = service.charge_to_account(
            active_account,
            Decimal('123.45'),
            user.id,
            description="Charge 1",
        )
        
        charge2 = service.charge_to_account(
            active_account,
            Decimal('67.89'),
            user.id,
            description="Charge 2",
        )
        
        # Payment with precise amount
        payment_data = PaymentCreate(
            amount=Decimal('150.50'),
            payment_method="cash",
        )
        payment = service.record_payment(active_account, payment_data, user.id)
        
        # Allocate payment
        allocations = service.allocate_payment(payment)
        
        # Verify precise allocations
        assert allocations[0].amount == Decimal('123.45')
        assert allocations[1].amount == Decimal('27.05')  # 150.50 - 123.45
        
        # Verify account balance precision
        db_session.refresh(active_account)
        expected_balance = Decimal('67.89') - Decimal('27.05')
        assert active_account.current_balance == expected_balance

    def test_process_payment_convenience_method(
        self, service, active_account, user, db_session
    ):
        """Test the process_payment convenience method."""
        # Create a charge
        charge = service.charge_to_account(
            active_account,
            Decimal('500'),
            user.id,
            description="Test charge",
        )
        
        # Process payment (record + allocate in one call)
        payment_data = PaymentCreate(
            amount=Decimal('500'),
            payment_method="cash",
        )
        payment, allocations = service.process_payment(
            active_account,
            payment_data,
            user.id,
        )
        
        # Verify payment was recorded
        assert payment.id is not None
        assert payment.amount == Decimal('500')
        
        # Verify allocations were created
        assert len(allocations) == 1
        assert allocations[0].transaction_id == charge.id
        
        # Verify account balance is updated
        db_session.refresh(active_account)
        assert active_account.current_balance == Decimal('0')

    def test_allocate_payment_fifo_order_property(
        self, service, active_account, user, db_session
    ):
        """
        Property test: Verify FIFO allocation order.
        
        **Validates: Property 3 - Payment Allocation Order**
        For any payment, allocation SHALL apply to oldest unpaid transactions first.
        """
        # Create 5 charges at different times
        charges = []
        for i in range(5):
            charge = service.charge_to_account(
                active_account,
                Decimal(str(100 * (i + 1))),  # 100, 200, 300, 400, 500
                user.id,
                description=f"Charge {i+1}",
            )
            charges.append(charge)
            db_session.flush()
            import time
            time.sleep(0.01)  # Ensure different timestamps
        
        # Make payment that covers first 3 charges
        payment_data = PaymentCreate(
            amount=Decimal('600'),  # Covers 100 + 200 + 300
            payment_method="cash",
        )
        payment = service.record_payment(active_account, payment_data, user.id)
        
        # Allocate payment
        allocations = service.allocate_payment(payment)
        
        # Verify allocations are in FIFO order
        assert len(allocations) == 3
        for i, allocation in enumerate(allocations):
            assert allocation.transaction_id == charges[i].id
            expected_amount = Decimal(str(100 * (i + 1)))
            assert allocation.amount == expected_amount
        
        # Verify oldest charges are fully paid
        for i in range(3):
            allocated_to_charge = db_session.query(
                db_session.query(PaymentAllocation.amount).filter(
                    PaymentAllocation.transaction_id == charges[i].id
                ).label('total')
            ).scalar() or Decimal('0')
            assert allocated_to_charge == Decimal(str(100 * (i + 1)))
