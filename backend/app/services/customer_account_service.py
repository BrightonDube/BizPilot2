"""Customer Account service for accounts receivable management."""

from typing import Optional
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID

from app.models.customer_account import (
    CustomerAccount,
    AccountStatus,
    AccountTransaction,
    TransactionType,
    AccountPayment,
)
from app.models.customer import Customer
from app.schemas.customer_account import (
    AccountCreate,
    AccountUpdate,
    AccountBalance,
    CreditValidation,
    PaymentCreate,
)
from app.core.security import get_password_hash


class CustomerAccountService:
    """Service for customer account operations."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_account_number(self, business_id: UUID) -> str:
        """
        Generate a unique account number for a customer account.
        
        Format: ACC-{business_prefix}-{sequential_number}
        Example: ACC-BIZ-00001
        
        Args:
            business_id: UUID of the business
            
        Returns:
            str: Generated account number
        """
        # Get the count of existing accounts for this business
        account_count = self.db.query(func.count(CustomerAccount.id)).filter(
            CustomerAccount.business_id == business_id
        ).scalar() or 0
        
        # Generate sequential number (padded to 5 digits)
        sequential_number = str(account_count + 1).zfill(5)
        
        # Get business prefix (first 3 chars of business_id, uppercase)
        business_prefix = str(business_id)[:8].upper()
        
        # Construct account number
        account_number = f"ACC-{business_prefix}-{sequential_number}"
        
        # Ensure uniqueness (in case of race conditions)
        while self._account_number_exists(account_number):
            account_count += 1
            sequential_number = str(account_count + 1).zfill(5)
            account_number = f"ACC-{business_prefix}-{sequential_number}"
        
        return account_number

    def _account_number_exists(self, account_number: str) -> bool:
        """Check if an account number already exists."""
        return self.db.query(CustomerAccount).filter(
            CustomerAccount.account_number == account_number
        ).first() is not None

    def create_account(
        self,
        business_id: UUID,
        data: AccountCreate,
    ) -> CustomerAccount:
        """
        Create a new customer account with automatic account number generation.
        
        Args:
            business_id: UUID of the business
            data: Account creation data
            
        Returns:
            CustomerAccount: Created account
            
        Raises:
            ValueError: If customer doesn't exist or already has an account
        """
        # Verify customer exists and belongs to this business
        customer = self.db.query(Customer).filter(
            Customer.id == data.customer_id,
            Customer.business_id == business_id,
            Customer.deleted_at.is_(None),
        ).first()
        
        if not customer:
            raise ValueError(f"Customer {data.customer_id} not found or doesn't belong to this business")
        
        # Check if customer already has an account
        existing_account = self.db.query(CustomerAccount).filter(
            CustomerAccount.customer_id == data.customer_id,
            CustomerAccount.business_id == business_id,
        ).first()
        
        if existing_account:
            raise ValueError(f"Customer {data.customer_id} already has an account")
        
        # Generate unique account number
        account_number = self._generate_account_number(business_id)
        
        # Hash PIN if provided
        hashed_pin = None
        if data.account_pin:
            hashed_pin = get_password_hash(data.account_pin)
        
        # Create account
        account = CustomerAccount(
            customer_id=data.customer_id,
            business_id=business_id,
            account_number=account_number,
            status=AccountStatus.PENDING,
            credit_limit=data.credit_limit,
            current_balance=Decimal('0'),
            payment_terms=data.payment_terms,
            account_pin=hashed_pin,
            notes=data.notes,
        )
        
        self.db.add(account)
        self.db.commit()
        self.db.refresh(account)
        
        return account

    def get_account(
        self,
        account_id: UUID,
        business_id: UUID,
    ) -> Optional[CustomerAccount]:
        """
        Get a customer account by ID.
        
        Args:
            account_id: UUID of the account
            business_id: UUID of the business
            
        Returns:
            Optional[CustomerAccount]: Account if found, None otherwise
        """
        return self.db.query(CustomerAccount).filter(
            CustomerAccount.id == account_id,
            CustomerAccount.business_id == business_id,
        ).first()

    def get_account_by_customer(
        self,
        customer_id: UUID,
        business_id: UUID,
    ) -> Optional[CustomerAccount]:
        """
        Get a customer account by customer ID.
        
        Args:
            customer_id: UUID of the customer
            business_id: UUID of the business
            
        Returns:
            Optional[CustomerAccount]: Account if found, None otherwise
        """
        return self.db.query(CustomerAccount).filter(
            CustomerAccount.customer_id == customer_id,
            CustomerAccount.business_id == business_id,
        ).first()

    def get_account_by_number(
        self,
        account_number: str,
        business_id: UUID,
    ) -> Optional[CustomerAccount]:
        """
        Get a customer account by account number.
        
        Args:
            account_number: Account number
            business_id: UUID of the business
            
        Returns:
            Optional[CustomerAccount]: Account if found, None otherwise
        """
        return self.db.query(CustomerAccount).filter(
            CustomerAccount.account_number == account_number,
            CustomerAccount.business_id == business_id,
        ).first()

    def update_account(
        self,
        account: CustomerAccount,
        data: AccountUpdate,
    ) -> CustomerAccount:
        """
        Update a customer account.
        
        Args:
            account: Account to update
            data: Update data
            
        Returns:
            CustomerAccount: Updated account
        """
        update_data = data.model_dump(exclude_unset=True)
        
        # Hash PIN if being updated
        if 'account_pin' in update_data and update_data['account_pin']:
            update_data['account_pin'] = get_password_hash(update_data['account_pin'])
        
        for field, value in update_data.items():
            setattr(account, field, value)
        
        self.db.commit()
        self.db.refresh(account)
        return account

    def activate_account(
        self,
        account: CustomerAccount,
    ) -> CustomerAccount:
        """
        Activate a customer account.
        
        Args:
            account: Account to activate
            
        Returns:
            CustomerAccount: Activated account
            
        Raises:
            ValueError: If account is already active or closed
        """
        if account.status == AccountStatus.ACTIVE:
            raise ValueError("Account is already active")
        
        if account.status == AccountStatus.CLOSED:
            raise ValueError("Cannot activate a closed account")
        
        account.status = AccountStatus.ACTIVE
        account.opened_at = datetime.utcnow()
        account.suspended_at = None
        
        self.db.commit()
        self.db.refresh(account)
        return account

    def suspend_account(
        self,
        account: CustomerAccount,
        reason: Optional[str] = None,
    ) -> CustomerAccount:
        """
        Suspend a customer account.
        
        Args:
            account: Account to suspend
            reason: Optional reason for suspension
            
        Returns:
            CustomerAccount: Suspended account
            
        Raises:
            ValueError: If account is not active
        """
        if account.status != AccountStatus.ACTIVE:
            raise ValueError("Only active accounts can be suspended")
        
        account.status = AccountStatus.SUSPENDED
        account.suspended_at = datetime.utcnow()
        
        if reason:
            account.notes = f"{account.notes or ''}\n[SUSPENDED] {reason}".strip()
        
        self.db.commit()
        self.db.refresh(account)
        return account

    def close_account(
        self,
        account: CustomerAccount,
        reason: Optional[str] = None,
    ) -> CustomerAccount:
        """
        Close a customer account.
        
        Args:
            account: Account to close
            reason: Optional reason for closure
            
        Returns:
            CustomerAccount: Closed account
            
        Raises:
            ValueError: If account has outstanding balance
        """
        if account.current_balance > 0:
            raise ValueError(
                f"Cannot close account with outstanding balance of {account.current_balance}"
            )
        
        account.status = AccountStatus.CLOSED
        account.closed_at = datetime.utcnow()
        
        if reason:
            account.notes = f"{account.notes or ''}\n[CLOSED] {reason}".strip()
        
        self.db.commit()
        self.db.refresh(account)
        return account

    def get_balance(
        self,
        account: CustomerAccount,
    ) -> AccountBalance:
        """
        Get account balance information.
        
        Args:
            account: Account to get balance for
            
        Returns:
            AccountBalance: Balance information
        """
        return AccountBalance(
            account_id=account.id,
            current_balance=account.current_balance,
            available_credit=account.available_credit,
            credit_limit=account.credit_limit,
            credit_utilization=account.credit_utilization,
            is_over_limit=account.is_over_limit,
        )

    def validate_credit(
        self,
        account: CustomerAccount,
        amount: Decimal,
    ) -> CreditValidation:
        """
        Validate if a charge amount is within available credit.
        
        Args:
            account: Account to validate
            amount: Amount to charge
            
        Returns:
            CreditValidation: Validation result
        """
        # Check if account is active
        if not account.is_active:
            return CreditValidation(
                is_valid=False,
                available_credit=account.available_credit,
                requested_amount=amount,
                message=f"Account is {account.status.value}. Only active accounts can be charged.",
            )
        
        # Check if amount is positive
        if amount <= 0:
            return CreditValidation(
                is_valid=False,
                available_credit=account.available_credit,
                requested_amount=amount,
                message="Charge amount must be positive",
            )
        
        # Check if within credit limit
        available = account.available_credit
        if amount > available:
            return CreditValidation(
                is_valid=False,
                available_credit=available,
                requested_amount=amount,
                message=f"Insufficient credit. Available: {available}, Requested: {amount}",
            )
        
        return CreditValidation(
            is_valid=True,
            available_credit=available,
            requested_amount=amount,
            message="Credit validation successful",
        )

    def charge_to_account(
        self,
        account: CustomerAccount,
        amount: Decimal,
        user_id: UUID,
        reference_type: Optional[str] = None,
        reference_id: Optional[UUID] = None,
        description: Optional[str] = None,
        due_date: Optional[datetime] = None,
    ) -> AccountTransaction:
        """
        Charge an amount to a customer account.
        
        This method:
        1. Validates credit availability
        2. Creates a charge transaction
        3. Updates the account balance
        
        Args:
            account: Account to charge
            amount: Amount to charge
            user_id: ID of user creating the charge
            reference_type: Optional reference type (e.g., 'order', 'invoice')
            reference_id: Optional reference ID
            description: Optional charge description
            due_date: Optional payment due date
            
        Returns:
            AccountTransaction: Created charge transaction
            
        Raises:
            ValueError: If credit validation fails
        """
        # Validate credit
        validation = self.validate_credit(account, amount)
        if not validation.is_valid:
            raise ValueError(validation.message)
        
        # Calculate new balance
        new_balance = Decimal(str(account.current_balance)) + amount
        
        # Create charge transaction
        transaction = AccountTransaction(
            account_id=account.id,
            transaction_type=TransactionType.CHARGE,
            reference_type=reference_type,
            reference_id=reference_id,
            amount=amount,
            balance_after=new_balance,
            description=description,
            due_date=due_date,
            created_by=user_id,
        )
        
        # Update account balance
        account.current_balance = new_balance
        
        # Add transaction to session
        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        self.db.refresh(account)
        
        return transaction

    def record_payment(
        self,
        account: CustomerAccount,
        payment_data: PaymentCreate,
        user_id: UUID,
    ) -> AccountPayment:
        """
        Record a payment against a customer account.
        
        This method:
        1. Validates the payment amount
        2. Creates a payment record
        3. Prepares for allocation to transactions (handled separately)
        
        Note: This method does NOT update the account balance or create
        payment allocations. Those are handled by the allocate_payment method
        to ensure proper FIFO allocation logic.
        
        Args:
            account: Account receiving the payment
            payment_data: Payment details (amount, method, reference, notes)
            user_id: ID of user recording the payment
            
        Returns:
            AccountPayment: Created payment record
            
        Raises:
            ValueError: If payment amount is invalid or account is closed
        """
        # Validate account status
        if account.status == AccountStatus.CLOSED:
            raise ValueError("Cannot record payment for a closed account")
        
        # Validate payment amount
        if payment_data.amount <= 0:
            raise ValueError("Payment amount must be positive")
        
        # Validate payment method
        if not payment_data.payment_method or not payment_data.payment_method.strip():
            raise ValueError("Payment method is required")
        
        # Create payment record
        payment = AccountPayment(
            account_id=account.id,
            amount=payment_data.amount,
            payment_method=payment_data.payment_method.strip(),
            reference_number=payment_data.reference_number,
            notes=payment_data.notes,
            received_by=user_id,
        )
        
        # Add payment to session
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)
        
        return payment
