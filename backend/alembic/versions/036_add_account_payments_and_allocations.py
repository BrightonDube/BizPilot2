"""add account_payments and payment_allocations tables

Revision ID: 036_add_account_payments
Revises: 035_add_account_transactions
Create Date: 2026-01-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '036_add_account_payments'
down_revision = '035_add_account_transactions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create account_payments and payment_allocations tables.
    
    These tables handle payment processing for customer accounts:
    - account_payments: Records payments received from customers
    - payment_allocations: Tracks how payments are allocated to specific transactions
    
    Validates: Requirement 4 - Payment Processing
    - Requirement 4.1: Accept payments against account balance
    - Requirement 4.2: Support partial payments
    - Requirement 4.3: Support multiple payment methods
    - Requirement 4.4: Allocate payments to oldest invoices first (FIFO)
    - Requirement 4.5: Generate payment receipts
    - Requirement 4.6: Update balance immediately on payment
    """
    
    # Create account_payments table
    op.create_table(
        'account_payments',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        
        # Foreign key to customer account (Requirement 4.1)
        sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Payment amount (Requirement 4.1, 4.2)
        # Supports partial payments - can be less than total balance
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        
        # Payment method (Requirement 4.3)
        # Values: 'cash', 'card', 'eft', 'cheque', 'mobile_money', etc.
        sa.Column('payment_method', sa.String(50), nullable=False),
        
        # Payment reference (Requirement 4.5)
        # Transaction reference, cheque number, EFT reference, etc.
        sa.Column('reference_number', sa.String(100), nullable=True),
        
        # Additional notes (Requirement 4.5)
        sa.Column('notes', sa.Text(), nullable=True),
        
        # Audit trail (Requirement 4.6)
        # Track who received the payment
        sa.Column('received_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['account_id'], ['customer_accounts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['received_by'], ['users.id'], ondelete='SET NULL'),
        
        # Check constraint: amount must be positive
        sa.CheckConstraint('amount > 0', name='ck_account_payments_amount_positive')
    )
    
    # Create payment_allocations table
    op.create_table(
        'payment_allocations',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        
        # Foreign key to payment (Requirement 4.4)
        sa.Column('payment_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Foreign key to transaction being paid (Requirement 4.4)
        # Links to account_transactions table (charges that need payment)
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Allocation amount (Requirement 4.2, 4.4)
        # Amount of this payment allocated to this specific transaction
        # Sum of allocations for a payment must equal payment amount
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        
        # Timestamp for allocation order tracking (Requirement 4.4)
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['payment_id'], ['account_payments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['transaction_id'], ['account_transactions.id'], ondelete='CASCADE'),
        
        # Check constraint: allocation amount must be positive
        sa.CheckConstraint('amount > 0', name='ck_payment_allocations_amount_positive')
    )
    
    # Create indexes for account_payments
    
    # Index for looking up all payments for an account (Requirement 4.1)
    # Used for: payment history, statement generation, balance calculations
    op.create_index(
        'idx_account_payments_account_id',
        'account_payments',
        ['account_id']
    )
    
    # Index for payment method reporting (Requirement 4.3)
    # Used for: payment method analysis, reconciliation reports
    op.create_index(
        'idx_account_payments_method',
        'account_payments',
        ['payment_method']
    )
    
    # Index for chronological payment queries (Requirement 4.5)
    # Used for: payment history, date range reports, receipt generation
    op.create_index(
        'idx_account_payments_created_at',
        'account_payments',
        ['created_at']
    )
    
    # Composite index for account + date queries (Requirement 4.1, 4.5)
    # Used for: account payment history by date range
    op.create_index(
        'idx_account_payments_account_date',
        'account_payments',
        ['account_id', 'created_at']
    )
    
    # Index for user activity tracking (Requirement 4.6)
    # Used for: audit trails, user performance reports
    op.create_index(
        'idx_account_payments_received_by',
        'account_payments',
        ['received_by']
    )
    
    # Create indexes for payment_allocations
    
    # Index for looking up allocations by payment (Requirement 4.4)
    # Used for: payment breakdown, allocation verification
    op.create_index(
        'idx_payment_allocations_payment_id',
        'payment_allocations',
        ['payment_id']
    )
    
    # Index for looking up allocations by transaction (Requirement 4.4)
    # Used for: transaction payment status, outstanding balance calculations
    op.create_index(
        'idx_payment_allocations_transaction_id',
        'payment_allocations',
        ['transaction_id']
    )
    
    # Composite index for payment + transaction lookups (Requirement 4.4)
    # Used for: preventing duplicate allocations, allocation verification
    op.create_index(
        'idx_payment_allocations_payment_transaction',
        'payment_allocations',
        ['payment_id', 'transaction_id']
    )


def downgrade() -> None:
    """Drop account_payments and payment_allocations tables and their indexes."""
    
    # Drop payment_allocations indexes
    op.drop_index('idx_payment_allocations_payment_transaction', table_name='payment_allocations')
    op.drop_index('idx_payment_allocations_transaction_id', table_name='payment_allocations')
    op.drop_index('idx_payment_allocations_payment_id', table_name='payment_allocations')
    
    # Drop account_payments indexes
    op.drop_index('idx_account_payments_received_by', table_name='account_payments')
    op.drop_index('idx_account_payments_account_date', table_name='account_payments')
    op.drop_index('idx_account_payments_created_at', table_name='account_payments')
    op.drop_index('idx_account_payments_method', table_name='account_payments')
    op.drop_index('idx_account_payments_account_id', table_name='account_payments')
    
    # Drop tables (payment_allocations first due to foreign key)
    op.drop_table('payment_allocations')
    op.drop_table('account_payments')
