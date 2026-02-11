"""Customer Account service for accounts receivable management."""

from typing import Optional
from datetime import datetime, date, timezone
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
    AccountStatement,
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

    def calculate_aging(
        self,
        account: CustomerAccount,
        as_of_date: Optional[datetime] = None,
    ) -> dict:
        """
        Calculate aging breakdown for an account.
        
        Aging categories (per Requirements 5.3 and 6.1):
        - Current: Not yet due (within payment terms)
        - 30 days: 1-30 days past due
        - 60 days: 31-60 days past due
        - 90+ days: 61+ days past due
        
        Args:
            account: Account to calculate aging for
            as_of_date: Date to calculate aging as of (defaults to now)
            
        Returns:
            dict: Aging breakdown with keys: current, days_30, days_60, days_90_plus, total
        """
        if as_of_date is None:
            as_of_date = datetime.now(timezone.utc)
        elif as_of_date.tzinfo is None:
            as_of_date = as_of_date.replace(tzinfo=timezone.utc)
        
        # Initialize aging buckets
        aging = {
            'current': Decimal('0'),
            'days_30': Decimal('0'),
            'days_60': Decimal('0'),
            'days_90_plus': Decimal('0'),
            'total': Decimal('0'),
        }
        
        # Get all unpaid charge transactions
        unpaid_charges = self.db.query(AccountTransaction).filter(
            AccountTransaction.account_id == account.id,
            AccountTransaction.transaction_type == TransactionType.CHARGE,
        ).all()
        
        # Calculate allocated amounts for each charge
        from app.models.customer_account import PaymentAllocation
        
        for charge in unpaid_charges:
            # Get total allocated to this charge
            allocated = self.db.query(func.sum(PaymentAllocation.amount)).filter(
                PaymentAllocation.transaction_id == charge.id
            ).scalar() or Decimal('0')
            
            # Calculate remaining unpaid amount
            unpaid_amount = Decimal(str(charge.amount)) - Decimal(str(allocated))
            
            if unpaid_amount <= 0:
                continue  # Fully paid
            
            # Determine due date
            if charge.due_date:
                due_date = datetime.combine(charge.due_date, datetime.min.time(), tzinfo=timezone.utc)
            else:
                # Use payment terms from account
                from datetime import timedelta
                created = charge.created_at
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                due_date = created + timedelta(days=account.payment_terms)
            
            # Calculate days overdue
            days_overdue = (as_of_date - due_date).days
            
            # Categorize into aging buckets per Requirements 5.3 and 6.1
            if days_overdue < 0:
                # Not yet due
                aging['current'] += unpaid_amount
            elif days_overdue <= 30:
                # 1-30 days overdue
                aging['days_30'] += unpaid_amount
            elif days_overdue <= 60:
                # 31-60 days overdue
                aging['days_60'] += unpaid_amount
            else:
                # 61+ days overdue (combines 61-90 and 90+)
                aging['days_90_plus'] += unpaid_amount
            
            aging['total'] += unpaid_amount
        
        return aging

    def calculate_balance_from_transactions(
        self,
        account: CustomerAccount,
    ) -> Decimal:
        """
        Calculate account balance from transaction history.
        
        This method recalculates the balance by summing all transactions:
        - Charges increase the balance (customer owes more)
        - Payments decrease the balance (customer pays down debt)
        - Adjustments can increase or decrease the balance
        - Write-offs decrease the balance
        
        This is used for:
        1. Verifying balance accuracy (Property 1)
        2. Reconciliation and auditing
        3. Detecting balance discrepancies
        
        Args:
            account: Account to calculate balance for
            
        Returns:
            Decimal: Calculated balance from transaction history
        """
        # Get all transactions for this account
        transactions = self.db.query(AccountTransaction).filter(
            AccountTransaction.account_id == account.id
        ).all()
        
        # Calculate balance from transactions
        calculated_balance = Decimal('0')
        
        for transaction in transactions:
            if transaction.transaction_type == TransactionType.CHARGE:
                # Charges increase the balance (debt)
                calculated_balance += Decimal(str(transaction.amount))
            elif transaction.transaction_type == TransactionType.PAYMENT:
                # Payments decrease the balance
                calculated_balance -= Decimal(str(transaction.amount))
            elif transaction.transaction_type == TransactionType.ADJUSTMENT:
                # Adjustments can be positive or negative
                calculated_balance += Decimal(str(transaction.amount))
            elif transaction.transaction_type == TransactionType.WRITE_OFF:
                # Write-offs decrease the balance
                calculated_balance -= Decimal(str(transaction.amount))
        
        return calculated_balance

    def verify_balance_accuracy(
        self,
        account: CustomerAccount,
        tolerance: Decimal = Decimal('0.01'),
    ) -> dict:
        """
        Verify that stored balance matches calculated balance from transactions.
        
        This implements Property 1: Balance Accuracy
        "For any account, current_balance SHALL equal sum of charges minus 
        sum of payments and adjustments."
        
        Args:
            account: Account to verify
            tolerance: Maximum acceptable difference (default: 0.01 for rounding)
            
        Returns:
            dict: Verification result with keys:
                - is_accurate: bool
                - stored_balance: Decimal
                - calculated_balance: Decimal
                - difference: Decimal
                - message: str
        """
        stored_balance = Decimal(str(account.current_balance))
        calculated_balance = self.calculate_balance_from_transactions(account)
        difference = abs(stored_balance - calculated_balance)
        
        is_accurate = difference <= tolerance
        
        result = {
            'is_accurate': is_accurate,
            'stored_balance': stored_balance,
            'calculated_balance': calculated_balance,
            'difference': difference,
            'message': '',
        }
        
        if is_accurate:
            result['message'] = f"Balance is accurate (difference: {difference})"
        else:
            result['message'] = (
                f"Balance mismatch detected! "
                f"Stored: {stored_balance}, "
                f"Calculated: {calculated_balance}, "
                f"Difference: {difference}"
            )
        
        return result

    def recalculate_and_fix_balance(
        self,
        account: CustomerAccount,
        user_id: UUID,
        reason: str = "Balance reconciliation",
    ) -> dict:
        """
        Recalculate balance from transactions and fix if discrepancy found.
        
        This method:
        1. Calculates the correct balance from transaction history
        2. Compares with stored balance
        3. If discrepancy found, creates an adjustment transaction to fix it
        4. Updates the stored balance
        
        Args:
            account: Account to recalculate and fix
            user_id: ID of user performing the reconciliation
            reason: Reason for reconciliation
            
        Returns:
            dict: Reconciliation result with keys:
                - was_fixed: bool
                - old_balance: Decimal
                - new_balance: Decimal
                - adjustment_amount: Decimal
                - message: str
        """
        verification = self.verify_balance_accuracy(account)
        
        result = {
            'was_fixed': False,
            'old_balance': verification['stored_balance'],
            'new_balance': verification['calculated_balance'],
            'adjustment_amount': Decimal('0'),
            'message': verification['message'],
        }
        
        if not verification['is_accurate']:
            # Calculate adjustment needed
            adjustment_amount = verification['calculated_balance'] - verification['stored_balance']
            
            # Update the stored balance directly (no transaction needed for reconciliation)
            old_balance = account.current_balance
            account.current_balance = verification['calculated_balance']
            
            # Create an audit note
            audit_note = (
                f"Balance reconciliation: "
                f"Old: {old_balance}, "
                f"New: {verification['calculated_balance']}, "
                f"Adjustment: {adjustment_amount}. "
                f"Reason: {reason}"
            )
            
            if account.notes:
                account.notes = f"{account.notes}\n{audit_note}"
            else:
                account.notes = audit_note
            
            self.db.commit()
            self.db.refresh(account)
            
            result['was_fixed'] = True
            result['adjustment_amount'] = adjustment_amount
            result['message'] = f"Balance fixed: {audit_note}"
        
        return result

    def get_balance(
        self,
        account: CustomerAccount,
        include_aging: bool = False,
        as_of_date: Optional[datetime] = None,
    ) -> AccountBalance:
        """
        Get account balance information with optional aging breakdown.
        
        Args:
            account: Account to get balance for
            include_aging: Whether to include aging breakdown (default: False)
            as_of_date: Date to calculate aging as of (defaults to now)
            
        Returns:
            AccountBalance: Balance information
        """
        balance_data = {
            'account_id': account.id,
            'current_balance': account.current_balance,
            'available_credit': account.available_credit,
            'credit_limit': account.credit_limit,
            'credit_utilization': account.credit_utilization,
            'is_over_limit': account.is_over_limit,
        }
        
        # Add aging breakdown if requested
        if include_aging:
            aging = self.calculate_aging(account, as_of_date)
            balance_data['aging'] = aging
        
        return AccountBalance(**balance_data)

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

    def adjust_balance(
        self,
        account: CustomerAccount,
        amount: Decimal,
        reason: str,
        user_id: UUID,
    ) -> AccountTransaction:
        """
        Create a balance adjustment transaction.
        
        Balance adjustments can be positive (increase balance/debt) or negative (decrease balance/debt).
        Common use cases:
        - Correcting billing errors
        - Applying credits or discounts
        - Writing off small balances
        - Manual corrections
        
        Args:
            account: Account to adjust
            amount: Adjustment amount (positive increases balance, negative decreases)
            reason: Reason for adjustment (required)
            user_id: ID of user creating the adjustment
            
        Returns:
            AccountTransaction: Created adjustment transaction
            
        Raises:
            ValueError: If amount is zero or reason is empty
        """
        # Validate adjustment amount
        if amount == 0:
            raise ValueError("Adjustment amount cannot be zero")
        
        # Validate reason
        if not reason or not reason.strip():
            raise ValueError("Adjustment reason is required")
        
        # Calculate new balance
        new_balance = Decimal(str(account.current_balance)) + amount
        
        # Prevent negative balances (customer can't owe negative amount)
        if new_balance < 0:
            raise ValueError(
                f"Adjustment would result in negative balance. "
                f"Current: {account.current_balance}, Adjustment: {amount}, "
                f"Result: {new_balance}. Use payment processing instead."
            )
        
        # Create adjustment transaction
        transaction = AccountTransaction(
            account_id=account.id,
            transaction_type=TransactionType.ADJUSTMENT,
            amount=amount,
            balance_after=new_balance,
            description=f"Balance adjustment: {reason.strip()}",
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

    def check_credit_limit_alert(
        self,
        account: CustomerAccount,
        threshold_percentage: float = 80.0,
    ) -> dict:
        """
        Check if account is approaching or exceeding credit limit.
        
        Returns alert information if:
        - Credit utilization >= threshold_percentage (default 80%)
        - Account is over limit
        
        Args:
            account: Account to check
            threshold_percentage: Alert threshold as percentage (default: 80%)
            
        Returns:
            dict: Alert information with keys:
                - should_alert: bool
                - alert_level: str ('warning', 'critical', 'over_limit', None)
                - message: str
                - utilization: float
                - available_credit: Decimal
        """
        utilization = account.credit_utilization
        available = account.available_credit
        
        alert_info = {
            'should_alert': False,
            'alert_level': None,
            'message': '',
            'utilization': utilization,
            'available_credit': available,
        }
        
        # Check if over limit
        if account.is_over_limit:
            alert_info['should_alert'] = True
            alert_info['alert_level'] = 'over_limit'
            alert_info['message'] = (
                f"Account is over credit limit. "
                f"Balance: {account.current_balance}, "
                f"Limit: {account.credit_limit}, "
                f"Over by: {abs(available)}"
            )
            return alert_info
        
        # Check if at limit (100% utilization)
        if utilization >= 100:
            alert_info['should_alert'] = True
            alert_info['alert_level'] = 'critical'
            alert_info['message'] = (
                "Account has reached credit limit. "
                "No credit available."
            )
            return alert_info
        
        # Check if approaching limit (>= threshold)
        if utilization >= threshold_percentage:
            alert_info['should_alert'] = True
            alert_info['alert_level'] = 'warning'
            alert_info['message'] = (
                f"Account is approaching credit limit. "
                f"Utilization: {utilization:.1f}%, "
                f"Available: {available}"
            )
            return alert_info
        
        # No alert needed
        alert_info['message'] = f"Credit utilization is healthy at {utilization:.1f}%"
        return alert_info

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

    def allocate_payment(
        self,
        payment: AccountPayment,
    ) -> list:
        """
        Allocate a payment to unpaid transactions using FIFO (First In, First Out).
        
        This implements Property 3: Payment Allocation Order
        "For any payment, allocation SHALL apply to oldest unpaid transactions first."
        
        FIFO allocation logic:
        1. Get all unpaid charge transactions ordered by created_at (oldest first)
        2. For each charge, calculate remaining unpaid amount
        3. Allocate payment to charges in order until payment is fully allocated
        4. Create PaymentAllocation records for each allocation
        5. Create payment transaction to reduce account balance
        6. Update account balance
        
        Args:
            payment: The payment to allocate
            
        Returns:
            list: List of PaymentAllocation objects created
            
        Raises:
            ValueError: If payment is already fully allocated or account is closed
        """
        from app.models.customer_account import PaymentAllocation
        
        # Get the account
        account = payment.account
        
        # Validate account status
        if account.status == AccountStatus.CLOSED:
            raise ValueError("Cannot allocate payment for a closed account")
        
        # Check if payment is already fully allocated
        if payment.unallocated_amount <= 0:
            raise ValueError("Payment is already fully allocated")
        
        # Get all unpaid charge transactions ordered by created_at (FIFO)
        unpaid_charges = self.db.query(AccountTransaction).filter(
            AccountTransaction.account_id == account.id,
            AccountTransaction.transaction_type == TransactionType.CHARGE,
        ).order_by(AccountTransaction.created_at.asc()).all()
        
        # Calculate remaining unpaid amount for each charge
        charges_with_unpaid = []
        for charge in unpaid_charges:
            # Get total already allocated to this charge
            allocated = self.db.query(func.sum(PaymentAllocation.amount)).filter(
                PaymentAllocation.transaction_id == charge.id
            ).scalar() or Decimal('0')
            
            # Calculate remaining unpaid amount
            unpaid_amount = Decimal(str(charge.amount)) - Decimal(str(allocated))
            
            if unpaid_amount > 0:
                charges_with_unpaid.append({
                    'charge': charge,
                    'unpaid_amount': unpaid_amount,
                })
        
        # Allocate payment to charges using FIFO
        allocations = []
        remaining_payment = payment.unallocated_amount
        
        for charge_info in charges_with_unpaid:
            if remaining_payment <= 0:
                break
            
            charge = charge_info['charge']
            unpaid_amount = charge_info['unpaid_amount']
            
            # Determine allocation amount (lesser of remaining payment or unpaid amount)
            allocation_amount = min(remaining_payment, unpaid_amount)
            
            # Create allocation record
            allocation = PaymentAllocation(
                payment_id=payment.id,
                transaction_id=charge.id,
                amount=allocation_amount,
            )
            
            self.db.add(allocation)
            allocations.append(allocation)
            
            # Reduce remaining payment
            remaining_payment -= allocation_amount
        
        # Create payment transaction to record the payment in transaction history
        new_balance = Decimal(str(account.current_balance)) - Decimal(str(payment.amount))
        
        # Prevent negative balances
        if new_balance < 0:
            new_balance = Decimal('0')
        
        payment_transaction = AccountTransaction(
            account_id=account.id,
            transaction_type=TransactionType.PAYMENT,
            reference_type='payment',
            reference_id=payment.id,
            amount=payment.amount,
            balance_after=new_balance,
            description=f"Payment via {payment.payment_method}" + (
                f" - Ref: {payment.reference_number}" if payment.reference_number else ""
            ),
            created_by=payment.received_by,
        )
        
        # Update account balance
        account.current_balance = new_balance
        
        # Add payment transaction to session
        self.db.add(payment_transaction)
        
        # Commit all changes
        self.db.commit()
        
        # Refresh objects
        for allocation in allocations:
            self.db.refresh(allocation)
        self.db.refresh(payment)
        self.db.refresh(account)
        
        return allocations

    def process_payment(
        self,
        account: CustomerAccount,
        payment_data: PaymentCreate,
        user_id: UUID,
    ) -> tuple:
        """
        Process a complete payment: record payment and allocate to transactions.
        
        This is a convenience method that combines:
        1. Recording the payment (record_payment)
        2. Allocating the payment to transactions (allocate_payment)
        
        Args:
            account: Account receiving the payment
            payment_data: Payment details
            user_id: ID of user processing the payment
            
        Returns:
            tuple: (AccountPayment, list of PaymentAllocations)
            
        Raises:
            ValueError: If payment validation fails
        """
        # Record the payment
        payment = self.record_payment(account, payment_data, user_id)
        
        # Allocate the payment using FIFO
        allocations = self.allocate_payment(payment)
        
        return payment, allocations

    def generate_charge_slip(
        self,
        transaction: AccountTransaction,
        account: CustomerAccount,
        business_name: str,
        business_address: Optional[str] = None,
        business_phone: Optional[str] = None,
        currency: str = "ZAR",
    ) -> bytes:
        """
        Generate a charge slip (receipt) for a charge transaction.
        
        A charge slip is a receipt that documents a sale charged to a customer account.
        It includes:
        - Business details
        - Customer account information
        - Transaction details (amount, date, reference)
        - Current account balance
        - Payment terms
        
        Args:
            transaction: The charge transaction
            account: The customer account
            business_name: Name of the business
            business_address: Optional business address
            business_phone: Optional business phone
            currency: Currency code (default: ZAR)
            
        Returns:
            bytes: PDF charge slip
            
        Raises:
            ValueError: If transaction is not a charge type
        """
        from app.core.pdf import PDFBuilder, format_currency, format_date
        
        # Validate transaction type
        if transaction.transaction_type != TransactionType.CHARGE:
            raise ValueError("Can only generate charge slips for charge transactions")
        
        # Build the charge slip PDF
        pdf = PDFBuilder(title=f"Charge Slip {transaction.id}")
        
        # Header
        pdf.add_header(business_name, "Charge Slip / Account Receipt")
        
        # Charge slip title - right aligned
        pdf._add_text("CHARGE SLIP", pdf.right_margin - 100, 18, bold=True)
        pdf.y_position -= 20
        
        # Transaction reference
        ref_text = f"Ref: {transaction.reference_type}-{transaction.reference_id}" if transaction.reference_type else f"Ref: {str(transaction.id)[:8]}"
        pdf._add_text(ref_text, pdf.right_margin - 100, 10)
        pdf.y_position -= 15
        
        # Date
        pdf._set_color(0.4, 0.4, 0.4)
        created_at_str = format_date(transaction.created_at)
        pdf._add_text(f"Date: {created_at_str}", pdf.right_margin - 100, 10)
        pdf._reset_color()
        pdf.y_position -= 30
        
        # Two column layout: Business Info | Account Info
        start_y = pdf.y_position
        
        # Left column - Business Information
        pdf._set_color(0.2, 0.4, 0.8)
        pdf._add_text("BUSINESS:", pdf.left_margin, 10, bold=True)
        pdf._reset_color()
        pdf.y_position -= 15
        
        pdf._add_text(business_name, pdf.left_margin, 10, bold=True)
        pdf.y_position -= 12
        
        if business_address:
            for line in business_address.split("\n")[:3]:
                pdf._add_text(line, pdf.left_margin, 9)
                pdf.y_position -= 11
        
        if business_phone:
            pdf._add_text(f"Tel: {business_phone}", pdf.left_margin, 9)
            pdf.y_position -= 11
        
        left_end_y = pdf.y_position
        
        # Right column - Account Information
        pdf.y_position = start_y
        
        pdf._set_color(0.2, 0.4, 0.8)
        pdf._add_text("ACCOUNT:", 320, 10, bold=True)
        pdf._reset_color()
        pdf.y_position -= 15
        
        # Get customer name from relationship
        customer_name = str(account.customer.name) if account.customer else "Unknown Customer"
        pdf._add_text(customer_name, 320, 10, bold=True)
        pdf.y_position -= 12
        
        pdf._add_text(f"Account #: {str(account.account_number)}", 320, 9)
        pdf.y_position -= 11
        
        pdf._add_text(f"Payment Terms: Net {int(account.payment_terms)} days", 320, 9)
        pdf.y_position -= 11
        
        # Use the lower of the two columns
        pdf.y_position = min(left_end_y, pdf.y_position) - 20
        
        # Transaction Details Section
        pdf._set_color(0.95, 0.95, 0.95)
        pdf._add_rect(pdf.left_margin, pdf.y_position - 5, pdf.right_margin - pdf.left_margin, 80, fill=True, stroke=False)
        pdf._reset_color()
        
        pdf._set_color(0.2, 0.2, 0.2)
        pdf._add_text("TRANSACTION DETAILS", pdf.left_margin + 5, 11, bold=True)
        pdf._reset_color()
        pdf.y_position -= 20
        
        # Description
        if transaction.description:
            pdf._add_text("Description:", pdf.left_margin + 10, 10, bold=True)
            pdf._add_text(transaction.description[:60], pdf.left_margin + 100, 10)
            pdf.y_position -= 15
        
        # Amount charged
        pdf._add_text("Amount Charged:", pdf.left_margin + 10, 10, bold=True)
        pdf._set_color(0.8, 0.2, 0.2)
        amount_str = format_currency(Decimal(str(transaction.amount)), currency)
        pdf._add_text(amount_str, pdf.left_margin + 100, 12, bold=True)
        pdf._reset_color()
        pdf.y_position -= 15
        
        # Due date if specified
        if transaction.due_date:
            pdf._add_text("Payment Due:", pdf.left_margin + 10, 10, bold=True)
            due_date_str = format_date(transaction.due_date)
            pdf._add_text(due_date_str, pdf.left_margin + 100, 10)
            pdf.y_position -= 15
        
        pdf.y_position -= 10
        
        # Account Balance Section
        pdf._set_color(0.2, 0.4, 0.8)
        pdf._add_line(pdf.left_margin, pdf.y_position, pdf.right_margin, pdf.y_position, 2)
        pdf._reset_color()
        pdf.y_position -= 20
        
        pdf._set_color(0.2, 0.2, 0.2)
        pdf._add_text("ACCOUNT BALANCE", pdf.left_margin, 11, bold=True)
        pdf._reset_color()
        pdf.y_position -= 20
        
        # Previous balance
        previous_balance = Decimal(str(transaction.balance_after)) - Decimal(str(transaction.amount))
        prev_balance_str = format_currency(previous_balance, currency)
        pdf._add_text("Previous Balance:", pdf.left_margin + 10, 10)
        pdf._add_text(prev_balance_str, 400, 10)
        pdf.y_position -= 15
        
        # This charge
        charge_str = format_currency(Decimal(str(transaction.amount)), currency)
        pdf._add_text("This Charge:", pdf.left_margin + 10, 10)
        pdf._set_color(0.8, 0.2, 0.2)
        pdf._add_text(f"+{charge_str}", 400, 10)
        pdf._reset_color()
        pdf.y_position -= 15
        
        # Separator line
        pdf._set_color(0.7, 0.7, 0.7)
        pdf._add_line(pdf.left_margin + 10, pdf.y_position + 5, pdf.right_margin - 10, pdf.y_position + 5, 1)
        pdf._reset_color()
        pdf.y_position -= 10
        
        # New balance
        new_balance_str = format_currency(Decimal(str(transaction.balance_after)), currency)
        pdf._add_text("New Balance:", pdf.left_margin + 10, 12, bold=True)
        balance_color = (0.8, 0.2, 0.2) if float(transaction.balance_after) > 0 else (0.2, 0.7, 0.3)
        pdf._set_color(*balance_color)
        pdf._add_text(new_balance_str, 400, 12, bold=True)
        pdf._reset_color()
        pdf.y_position -= 20
        
        # Available credit
        available_credit_str = format_currency(Decimal(str(account.available_credit)), currency)
        pdf._add_text("Available Credit:", pdf.left_margin + 10, 10)
        pdf._add_text(available_credit_str, 400, 10)
        pdf.y_position -= 15
        
        # Credit limit
        credit_limit_str = format_currency(Decimal(str(account.credit_limit)), currency)
        pdf._add_text("Credit Limit:", pdf.left_margin + 10, 10)
        pdf._add_text(credit_limit_str, 400, 10)
        pdf.y_position -= 30
        
        # Important notice section
        pdf._set_color(0.95, 0.95, 0.95)
        pdf._add_rect(pdf.left_margin, pdf.y_position - 5, pdf.right_margin - pdf.left_margin, 40, fill=True, stroke=False)
        pdf._reset_color()
        
        pdf._set_color(0.3, 0.3, 0.3)
        pdf._add_text("IMPORTANT:", pdf.left_margin + 5, 10, bold=True)
        pdf._reset_color()
        pdf.y_position -= 15
        
        pdf._set_color(0.4, 0.4, 0.4)
        payment_terms_int = int(account.payment_terms)
        pdf._add_text(f"Payment is due within {payment_terms_int} days from the transaction date.", pdf.left_margin + 5, 9)
        pdf.y_position -= 12
        pdf._add_text("Please reference your account number when making payment.", pdf.left_margin + 5, 9)
        pdf._reset_color()
        pdf.y_position -= 20
        
        # Footer
        pdf.add_footer("This is a computer-generated charge slip. Thank you for your business!")
        
        return pdf.build()

    def generate_payment_receipt(
        self,
        payment: AccountPayment,
        account: CustomerAccount,
        business_name: str,
        business_address: Optional[str] = None,
        business_phone: Optional[str] = None,
        currency: str = "ZAR",
    ) -> dict:
        """
        Generate a payment receipt with payment details, allocations, and balance.
        
        A payment receipt documents a payment received against a customer account.
        It includes:
        - Payment details (amount, method, reference number, date)
        - Account information (account number, customer name)
        - Allocation details (which charges were paid)
        - Remaining balance after payment
        
        This implements Requirement 4.5: "THE System SHALL generate payment receipts"
        
        Args:
            payment: The payment record
            account: The customer account
            business_name: Name of the business
            business_address: Optional business address
            business_phone: Optional business phone
            currency: Currency code (default: ZAR)
            
        Returns:
            dict: Structured receipt data with keys:
                - receipt_id: UUID of the payment
                - receipt_number: Formatted receipt number
                - receipt_date: Payment date
                - business: Business information
                - account: Account information
                - payment: Payment details
                - allocations: List of allocation details
                - balance: Balance information
                - totals: Summary totals
        """
        from app.models.customer_account import PaymentAllocation
        
        # Get customer name from relationship
        customer_name = str(account.customer.name) if account.customer else "Unknown Customer"
        
        # Calculate balance before payment
        balance_before = Decimal(str(account.current_balance)) + Decimal(str(payment.amount))
        
        # Get all allocations for this payment
        allocations = self.db.query(PaymentAllocation).filter(
            PaymentAllocation.payment_id == payment.id
        ).all()
        
        # Build allocation details
        allocation_details = []
        for allocation in allocations:
            transaction = allocation.transaction
            
            # Calculate remaining balance on this transaction after allocation
            total_allocated = self.db.query(func.sum(PaymentAllocation.amount)).filter(
                PaymentAllocation.transaction_id == transaction.id
            ).scalar() or Decimal('0')
            
            remaining = Decimal(str(transaction.amount)) - Decimal(str(total_allocated))
            
            allocation_details.append({
                'transaction_id': str(transaction.id),
                'transaction_date': transaction.created_at.isoformat(),
                'transaction_type': transaction.transaction_type.value,
                'description': transaction.description or f"{transaction.transaction_type.value.title()} Transaction",
                'original_amount': float(transaction.amount),
                'allocated_amount': float(allocation.amount),
                'remaining_balance': float(remaining),
                'due_date': transaction.due_date.isoformat() if transaction.due_date else None,
            })
        
        # Build structured receipt data
        receipt = {
            'receipt_id': str(payment.id),
            'receipt_number': f"PMT-{str(payment.id)[:8].upper()}",
            'receipt_date': payment.created_at.isoformat(),
            
            # Business information
            'business': {
                'name': business_name,
                'address': business_address,
                'phone': business_phone,
            },
            
            # Account information
            'account': {
                'account_id': str(account.id),
                'account_number': account.account_number,
                'customer_name': customer_name,
                'customer_id': str(account.customer_id),
            },
            
            # Payment details
            'payment': {
                'amount': float(payment.amount),
                'payment_method': payment.payment_method,
                'reference_number': payment.reference_number,
                'notes': payment.notes,
                'received_by': str(payment.received_by) if payment.received_by else None,
                'currency': currency,
            },
            
            # Allocation details
            'allocations': allocation_details,
            
            # Balance information
            'balance': {
                'balance_before_payment': float(balance_before),
                'payment_amount': float(payment.amount),
                'balance_after_payment': float(account.current_balance),
                'available_credit': float(account.available_credit),
                'credit_limit': float(account.credit_limit),
            },
            
            # Summary totals
            'totals': {
                'total_allocated': float(payment.allocated_amount),
                'total_unallocated': float(payment.unallocated_amount),
                'number_of_allocations': len(allocation_details),
            },
        }
        
        return receipt

    def format_payment_receipt_text(
        self,
        receipt: dict,
    ) -> str:
        """
        Format a payment receipt as plain text for printing or display.
        
        Args:
            receipt: Receipt data from generate_payment_receipt()
            
        Returns:
            str: Formatted text receipt
        """
        lines = []
        currency = receipt['payment']['currency']
        
        # Header
        lines.append("=" * 60)
        lines.append(receipt['business']['name'].center(60))
        lines.append("PAYMENT RECEIPT".center(60))
        lines.append("=" * 60)
        lines.append("")
        
        # Business info
        if receipt['business']['address']:
            for line in receipt['business']['address'].split('\n'):
                lines.append(line.center(60))
        if receipt['business']['phone']:
            lines.append(f"Tel: {receipt['business']['phone']}".center(60))
        lines.append("")
        
        # Receipt details
        lines.append(f"Receipt #: {receipt['receipt_number']}")
        lines.append(f"Date: {receipt['receipt_date'][:10]}")
        lines.append("")
        
        # Account details
        lines.append("-" * 60)
        lines.append("ACCOUNT INFORMATION")
        lines.append("-" * 60)
        lines.append(f"Customer: {receipt['account']['customer_name']}")
        lines.append(f"Account #: {receipt['account']['account_number']}")
        lines.append("")
        
        # Payment details
        lines.append("-" * 60)
        lines.append("PAYMENT DETAILS")
        lines.append("-" * 60)
        lines.append(f"Amount Paid: {currency} {receipt['payment']['amount']:.2f}")
        lines.append(f"Payment Method: {receipt['payment']['payment_method']}")
        if receipt['payment']['reference_number']:
            lines.append(f"Reference: {receipt['payment']['reference_number']}")
        if receipt['payment']['notes']:
            lines.append(f"Notes: {receipt['payment']['notes']}")
        lines.append("")
        
        # Allocations
        if receipt['allocations']:
            lines.append("-" * 60)
            lines.append("PAYMENT ALLOCATION")
            lines.append("-" * 60)
            for i, alloc in enumerate(receipt['allocations'], 1):
                lines.append(f"{i}. {alloc['description']}")
                lines.append(f"   Date: {alloc['transaction_date'][:10]}")
                lines.append(f"   Original Amount: {currency} {alloc['original_amount']:.2f}")
                lines.append(f"   Allocated: {currency} {alloc['allocated_amount']:.2f}")
                lines.append(f"   Remaining: {currency} {alloc['remaining_balance']:.2f}")
                lines.append("")
        
        # Balance summary
        lines.append("=" * 60)
        lines.append("BALANCE SUMMARY")
        lines.append("=" * 60)
        lines.append(f"Balance Before Payment: {currency} {receipt['balance']['balance_before_payment']:.2f}")
        lines.append(f"Payment Amount:         {currency} {receipt['balance']['payment_amount']:.2f}")
        lines.append(f"Balance After Payment:  {currency} {receipt['balance']['balance_after_payment']:.2f}")
        lines.append("")
        lines.append(f"Available Credit:       {currency} {receipt['balance']['available_credit']:.2f}")
        lines.append(f"Credit Limit:           {currency} {receipt['balance']['credit_limit']:.2f}")
        lines.append("")
        
        # Footer
        lines.append("=" * 60)
        lines.append("Thank you for your payment!".center(60))
        lines.append("=" * 60)
        
        return "\n".join(lines)

    def format_payment_receipt_html(
        self,
        receipt: dict,
    ) -> str:
        """
        Format a payment receipt as HTML for web display or email.
        
        Args:
            receipt: Receipt data from generate_payment_receipt()
            
        Returns:
            str: Formatted HTML receipt
        """
        currency = receipt['payment']['currency']
        
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Receipt - {receipt['receipt_number']}</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }}
        .header {{
            text-align: center;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .header h1 {{
            color: #2563eb;
            margin: 0;
            font-size: 28px;
        }}
        .header h2 {{
            color: #666;
            margin: 10px 0 0 0;
            font-size: 20px;
            font-weight: normal;
        }}
        .section {{
            margin-bottom: 30px;
        }}
        .section-title {{
            background-color: #f3f4f6;
            padding: 10px;
            font-weight: bold;
            color: #2563eb;
            border-left: 4px solid #2563eb;
            margin-bottom: 15px;
        }}
        .info-grid {{
            display: grid;
            grid-template-columns: 200px 1fr;
            gap: 10px;
            margin-bottom: 10px;
        }}
        .info-label {{
            font-weight: bold;
            color: #666;
        }}
        .info-value {{
            color: #333;
        }}
        .allocation-item {{
            background-color: #f9fafb;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 5px;
            border-left: 3px solid #10b981;
        }}
        .allocation-item h4 {{
            margin: 0 0 10px 0;
            color: #333;
        }}
        .balance-summary {{
            background-color: #eff6ff;
            padding: 20px;
            border-radius: 5px;
            border: 2px solid #2563eb;
        }}
        .balance-row {{
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #ddd;
        }}
        .balance-row:last-child {{
            border-bottom: none;
        }}
        .balance-label {{
            font-weight: bold;
        }}
        .balance-value {{
            font-weight: bold;
            color: #2563eb;
        }}
        .balance-total {{
            font-size: 18px;
            color: #059669;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 2px solid #2563eb;
        }}
        .footer {{
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            color: #666;
            font-size: 14px;
        }}
        .amount {{
            font-weight: bold;
            color: #059669;
        }}
        @media print {{
            body {{
                padding: 0;
            }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{receipt['business']['name']}</h1>
        <h2>Payment Receipt</h2>
"""
        
        if receipt['business']['address']:
            html += f"        <p>{receipt['business']['address'].replace(chr(10), '<br>')}</p>\n"
        if receipt['business']['phone']:
            html += f"        <p>Tel: {receipt['business']['phone']}</p>\n"
        
        html += f"""
    </div>

    <div class="section">
        <div class="info-grid">
            <div class="info-label">Receipt Number:</div>
            <div class="info-value">{receipt['receipt_number']}</div>
            <div class="info-label">Receipt Date:</div>
            <div class="info-value">{receipt['receipt_date'][:10]}</div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Account Information</div>
        <div class="info-grid">
            <div class="info-label">Customer Name:</div>
            <div class="info-value">{receipt['account']['customer_name']}</div>
            <div class="info-label">Account Number:</div>
            <div class="info-value">{receipt['account']['account_number']}</div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Payment Details</div>
        <div class="info-grid">
            <div class="info-label">Amount Paid:</div>
            <div class="info-value amount">{currency} {receipt['payment']['amount']:.2f}</div>
            <div class="info-label">Payment Method:</div>
            <div class="info-value">{receipt['payment']['payment_method']}</div>
"""
        
        if receipt['payment']['reference_number']:
            html += f"""
            <div class="info-label">Reference Number:</div>
            <div class="info-value">{receipt['payment']['reference_number']}</div>
"""
        
        if receipt['payment']['notes']:
            html += f"""
            <div class="info-label">Notes:</div>
            <div class="info-value">{receipt['payment']['notes']}</div>
"""
        
        html += """
        </div>
    </div>
"""
        
        # Allocations
        if receipt['allocations']:
            html += """
    <div class="section">
        <div class="section-title">Payment Allocation</div>
"""
            for i, alloc in enumerate(receipt['allocations'], 1):
                html += f"""
        <div class="allocation-item">
            <h4>{i}. {alloc['description']}</h4>
            <div class="info-grid">
                <div class="info-label">Transaction Date:</div>
                <div class="info-value">{alloc['transaction_date'][:10]}</div>
                <div class="info-label">Original Amount:</div>
                <div class="info-value">{currency} {alloc['original_amount']:.2f}</div>
                <div class="info-label">Allocated:</div>
                <div class="info-value amount">{currency} {alloc['allocated_amount']:.2f}</div>
                <div class="info-label">Remaining:</div>
                <div class="info-value">{currency} {alloc['remaining_balance']:.2f}</div>
"""
                if alloc['due_date']:
                    html += f"""
                <div class="info-label">Due Date:</div>
                <div class="info-value">{alloc['due_date'][:10]}</div>
"""
                html += """
            </div>
        </div>
"""
            html += """
    </div>
"""
        
        # Balance summary
        html += f"""
    <div class="section">
        <div class="section-title">Balance Summary</div>
        <div class="balance-summary">
            <div class="balance-row">
                <span class="balance-label">Balance Before Payment:</span>
                <span class="balance-value">{currency} {receipt['balance']['balance_before_payment']:.2f}</span>
            </div>
            <div class="balance-row">
                <span class="balance-label">Payment Amount:</span>
                <span class="balance-value">- {currency} {receipt['balance']['payment_amount']:.2f}</span>
            </div>
            <div class="balance-row balance-total">
                <span class="balance-label">Balance After Payment:</span>
                <span class="balance-value">{currency} {receipt['balance']['balance_after_payment']:.2f}</span>
            </div>
            <div class="balance-row" style="margin-top: 15px;">
                <span class="balance-label">Available Credit:</span>
                <span class="balance-value">{currency} {receipt['balance']['available_credit']:.2f}</span>
            </div>
            <div class="balance-row">
                <span class="balance-label">Credit Limit:</span>
                <span class="balance-value">{currency} {receipt['balance']['credit_limit']:.2f}</span>
            </div>
        </div>
    </div>

    <div class="footer">
        <p><strong>Thank you for your payment!</strong></p>
        <p>This is a computer-generated receipt. Please keep for your records.</p>
        <p>Generated on {receipt['receipt_date'][:19]}</p>
    </div>
</body>
</html>
"""
        
        return html


    def generate_statement(
        self,
        account: CustomerAccount,
        period_end: date,
        period_start: Optional[date] = None,
    ) -> 'AccountStatement':
        """
        Generate an account statement for a specified period.
        
        This implements Requirement 5: Statement Generation
        - Requirement 5.1: "THE System SHALL generate monthly statements automatically"
        - Requirement 5.2: "THE System SHALL show opening balance, transactions, closing balance"
        - Requirement 5.3: "THE System SHALL include aging breakdown (current, 30, 60, 90+ days)"
        
        This also validates Property 4: Statement Accuracy
        "For any statement, closing_balance SHALL equal opening_balance plus charges minus payments."
        
        The statement includes:
        - Opening balance (balance at period_start)
        - All transactions in the period (charges, payments, adjustments)
        - Total charges and total payments for the period
        - Closing balance (balance at period_end)
        - Aging breakdown (current, 30, 60, 90+ days)
        
        Args:
            account: The customer account to generate statement for
            period_end: End date of the statement period
            period_start: Start date of the statement period (defaults to last statement or account opening)
            
        Returns:
            AccountStatement: Generated statement record
            
        Raises:
            ValueError: If period dates are invalid or account is not found
        """
        from app.models.customer_account import AccountStatement
        from datetime import timedelta
        
        # Validate period_end
        if not period_end:
            raise ValueError("period_end is required")
        
        # Determine period_start if not provided
        if period_start is None:
            # Try to get the last statement
            last_statement = self.db.query(AccountStatement).filter(
                AccountStatement.account_id == account.id
            ).order_by(AccountStatement.period_end.desc()).first()
            
            if last_statement:
                # Start from the day after the last statement ended
                period_start = last_statement.period_end + timedelta(days=1)
            else:
                # No previous statement, start from account opening or 30 days before period_end
                if account.opened_at:
                    period_start = account.opened_at.date()
                else:
                    # Default to 30 days before period_end
                    period_start = period_end - timedelta(days=30)
        
        # Validate period dates
        if period_start > period_end:
            raise ValueError(f"period_start ({period_start}) cannot be after period_end ({period_end})")
        
        # Convert dates to datetime for comparison with transaction timestamps
        period_start_dt = datetime.combine(period_start, datetime.min.time(), tzinfo=timezone.utc)
        period_end_dt = datetime.combine(period_end, datetime.max.time(), tzinfo=timezone.utc)
        
        # Calculate opening balance (balance at the start of the period)
        # Get all transactions before period_start
        transactions_before = self.db.query(AccountTransaction).filter(
            AccountTransaction.account_id == account.id,
            AccountTransaction.created_at < period_start_dt
        ).all()
        
        opening_balance = Decimal('0')
        for txn in transactions_before:
            if txn.transaction_type == TransactionType.CHARGE:
                opening_balance += Decimal(str(txn.amount))
            elif txn.transaction_type == TransactionType.PAYMENT:
                opening_balance -= Decimal(str(txn.amount))
            elif txn.transaction_type == TransactionType.ADJUSTMENT:
                opening_balance += Decimal(str(txn.amount))
            elif txn.transaction_type == TransactionType.WRITE_OFF:
                opening_balance -= Decimal(str(txn.amount))
        
        # Get all transactions in the period
        transactions_in_period = self.db.query(AccountTransaction).filter(
            AccountTransaction.account_id == account.id,
            AccountTransaction.created_at >= period_start_dt,
            AccountTransaction.created_at <= period_end_dt
        ).order_by(AccountTransaction.created_at.asc()).all()
        
        # Calculate total charges and total payments for the period
        total_charges = Decimal('0')
        total_payments = Decimal('0')
        
        for txn in transactions_in_period:
            if txn.transaction_type == TransactionType.CHARGE:
                total_charges += Decimal(str(txn.amount))
            elif txn.transaction_type == TransactionType.PAYMENT:
                total_payments += Decimal(str(txn.amount))
            elif txn.transaction_type == TransactionType.ADJUSTMENT:
                # Adjustments can be positive or negative
                if Decimal(str(txn.amount)) > 0:
                    total_charges += Decimal(str(txn.amount))
                else:
                    total_payments += abs(Decimal(str(txn.amount)))
            elif txn.transaction_type == TransactionType.WRITE_OFF:
                total_payments += Decimal(str(txn.amount))
        
        # Calculate closing balance
        # Property 4: closing_balance = opening_balance + charges - payments
        closing_balance = opening_balance + total_charges - total_payments
        
        # Verify Property 4: Statement Accuracy
        # The closing balance should match the account's current balance if period_end is today
        if period_end == datetime.now(timezone.utc).date():
            current_balance = Decimal(str(account.current_balance))
            balance_difference = abs(closing_balance - current_balance)
            
            # Allow small rounding differences (0.01)
            if balance_difference > Decimal('0.01'):
                # Log warning but don't fail - this could indicate a data issue
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(
                    f"Statement closing balance ({closing_balance}) differs from "
                    f"account current balance ({current_balance}) by {balance_difference}. "
                    f"Account: {account.id}, Period: {period_start} to {period_end}"
                )
        
        # Calculate aging breakdown as of period_end
        aging = self.calculate_aging(account, as_of_date=period_end_dt)
        
        # Reconcile aging buckets with closing_balance to satisfy DB check constraint
        # (closing_balance = current + days_30 + days_60 + days_90_plus)
        # Adjustments/write-offs affect closing_balance but aren't tied to specific
        # charge due dates, so absorb the difference into the 'current' bucket.
        aging_sum = (
            aging.get('current', Decimal('0')) +
            aging.get('days_30', Decimal('0')) +
            aging.get('days_60', Decimal('0')) +
            aging.get('days_90_plus', Decimal('0'))
        )
        if aging_sum != closing_balance:
            aging['current'] += (closing_balance - aging_sum)
        
        # Create the statement record
        statement = AccountStatement(
            account_id=account.id,
            statement_date=period_end,
            period_start=period_start,
            period_end=period_end,
            opening_balance=opening_balance,
            total_charges=total_charges,
            total_payments=total_payments,
            closing_balance=closing_balance,
            current_amount=aging.get('current', Decimal('0')),
            days_30_amount=aging.get('days_30', Decimal('0')),
            days_60_amount=aging.get('days_60', Decimal('0')),
            days_90_plus_amount=aging.get('days_90_plus', Decimal('0')),
        )
        
        # Save the statement
        self.db.add(statement)
        self.db.commit()
        self.db.refresh(statement)
        
        return statement

    def get_statement_transactions(
        self,
        statement: 'AccountStatement',
    ) -> list:
        """
        Get all transactions for a statement period.
        
        This is a helper method to retrieve the detailed transaction list
        for a statement, which can be used for displaying the statement
        or generating a PDF.
        
        Args:
            statement: The statement to get transactions for
            
        Returns:
            list: List of AccountTransaction objects in the statement period
        """
        
        # Convert dates to datetime for comparison
        period_start_dt = datetime.combine(statement.period_start, datetime.min.time())
        period_end_dt = datetime.combine(statement.period_end, datetime.max.time())
        
        # Get all transactions in the period
        transactions = self.db.query(AccountTransaction).filter(
            AccountTransaction.account_id == statement.account_id,
            AccountTransaction.created_at >= period_start_dt,
            AccountTransaction.created_at <= period_end_dt
        ).order_by(AccountTransaction.created_at.asc()).all()
        
        return transactions

    def verify_statement_accuracy(
        self,
        statement: 'AccountStatement',
        tolerance: Decimal = Decimal('0.01'),
    ) -> dict:
        """
        Verify that a statement satisfies Property 4: Statement Accuracy.
        
        Property 4: "For any statement, closing_balance SHALL equal 
        opening_balance plus charges minus payments."
        
        This method checks:
        1. closing_balance = opening_balance + total_charges - total_payments
        2. The aging breakdown sums to the closing balance (within tolerance)
        
        Args:
            statement: The statement to verify
            tolerance: Maximum acceptable difference (default: 0.01 for rounding)
            
        Returns:
            dict: Verification result with keys:
                - is_accurate: bool
                - property_4_satisfied: bool
                - calculated_closing: Decimal
                - statement_closing: Decimal
                - difference: Decimal
                - aging_total: Decimal
                - aging_matches: bool
                - message: str
        """
        
        # Calculate expected closing balance using Property 4
        calculated_closing = (
            Decimal(str(statement.opening_balance)) +
            Decimal(str(statement.total_charges)) -
            Decimal(str(statement.total_payments))
        )
        
        statement_closing = Decimal(str(statement.closing_balance))
        difference = abs(calculated_closing - statement_closing)
        
        # Check if Property 4 is satisfied
        property_4_satisfied = difference <= tolerance
        
        # Calculate total from aging breakdown
        aging_total = (
            Decimal(str(statement.current_amount)) +
            Decimal(str(statement.days_30_amount)) +
            Decimal(str(statement.days_60_amount)) +
            Decimal(str(statement.days_90_plus_amount))
        )
        
        # Check if aging breakdown matches closing balance
        aging_difference = abs(aging_total - statement_closing)
        aging_matches = aging_difference <= tolerance
        
        # Overall accuracy check
        is_accurate = property_4_satisfied and aging_matches
        
        result = {
            'is_accurate': is_accurate,
            'property_4_satisfied': property_4_satisfied,
            'calculated_closing': calculated_closing,
            'statement_closing': statement_closing,
            'difference': difference,
            'aging_total': aging_total,
            'aging_matches': aging_matches,
            'message': '',
        }
        
        if is_accurate:
            result['message'] = "Statement is accurate and satisfies Property 4"
        else:
            issues = []
            if not property_4_satisfied:
                issues.append(
                    f"Property 4 violation: closing_balance ({statement_closing}) != "
                    f"opening_balance + charges - payments ({calculated_closing}), "
                    f"difference: {difference}"
                )
            if not aging_matches:
                issues.append(
                    f"Aging breakdown ({aging_total}) does not match "
                    f"closing_balance ({statement_closing}), "
                    f"difference: {aging_difference}"
                )
            result['message'] = "; ".join(issues)
        
        return result

    def generate_monthly_statements(
        self,
        business_id: UUID,
        month: int,
        year: int,
    ) -> list:
        """
        Generate monthly statements for all active accounts in a business.
        
        This implements Requirement 5.1: "THE System SHALL generate monthly 
        statements automatically"
        
        This method can be called by a scheduled job to automatically generate
        statements at the end of each month.
        
        Args:
            business_id: UUID of the business
            month: Month number (1-12)
            year: Year (e.g., 2024)
            
        Returns:
            list: List of generated AccountStatement objects
            
        Raises:
            ValueError: If month or year is invalid
        """
        from calendar import monthrange
        
        # Validate month and year
        if not (1 <= month <= 12):
            raise ValueError(f"Invalid month: {month}. Must be between 1 and 12")
        
        if year < 2000 or year > 2100:
            raise ValueError(f"Invalid year: {year}")
        
        # Calculate period dates
        period_start = date(year, month, 1)
        last_day = monthrange(year, month)[1]
        period_end = date(year, month, last_day)
        
        # Get all active accounts for this business
        active_accounts = self.db.query(CustomerAccount).filter(
            CustomerAccount.business_id == business_id,
            CustomerAccount.status == AccountStatus.ACTIVE
        ).all()
        
        # Generate statements for each account
        statements = []
        for account in active_accounts:
            try:
                statement = self.generate_statement(
                    account=account,
                    period_end=period_end,
                    period_start=period_start,
                )
                statements.append(statement)
            except Exception as e:
                # Log error but continue with other accounts
                import logging
                logger = logging.getLogger(__name__)
                logger.error(
                    f"Failed to generate statement for account {account.id}: {str(e)}"
                )
                continue
        
        return statements
