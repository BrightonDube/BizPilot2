"""add account_transactions table

Revision ID: 035_add_account_transactions
Revises: 034_add_customer_accounts
Create Date: 2026-01-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '035_add_account_transactions'
down_revision = '034_add_customer_accounts'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create account_transactions table for tracking all account activity.
    
    This table records all transactions on customer accounts including charges,
    payments, adjustments, and write-offs. Each transaction maintains a running
    balance and links to the originating reference (order, invoice, etc.).
    
    Validates: Requirements 2, 3, 4
    - Requirement 2: Credit Sales - Track charges to accounts
    - Requirement 3: Balance Management - Track balance history
    - Requirement 4: Payment Processing - Record payments
    """
    op.create_table(
        'account_transactions',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        
        # Foreign key to customer account (Requirement 2.1, 3.1, 4.1)
        sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Transaction type (Requirement 2.1, 3.4, 4.1)
        # Values: 'charge', 'payment', 'adjustment', 'write_off'
        sa.Column('transaction_type', sa.String(20), nullable=False),
        
        # Reference to originating document (Requirement 2.1)
        # reference_type: 'order', 'invoice', 'payment', 'adjustment', 'write_off'
        # reference_id: UUID of the referenced document
        sa.Column('reference_type', sa.String(20), nullable=True),
        sa.Column('reference_id', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Transaction amount (Requirement 2.1, 3.1, 4.1)
        # Positive for charges, negative for payments/credits
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        
        # Running balance after this transaction (Requirement 3.2, 3.4)
        # This enables balance history tracking and reconciliation
        sa.Column('balance_after', sa.Numeric(12, 2), nullable=False),
        
        # Transaction description (Requirement 2.5, 4.5)
        sa.Column('description', sa.Text(), nullable=True),
        
        # Due date for charges (Requirement 2.1, 5.3, 6.1)
        # Used for aging calculations and collections
        sa.Column('due_date', sa.Date(), nullable=True),
        
        # Audit trail (Requirement 2.6, 4.6)
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['account_id'], ['customer_accounts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        
        # Check constraint: amount cannot be zero
        sa.CheckConstraint('amount != 0', name='ck_account_transactions_amount_not_zero')
    )
    
    # Create indexes for common queries
    
    # Index for looking up all transactions for an account (most common query)
    # Used for: transaction history, statement generation, balance calculations
    op.create_index(
        'idx_account_transactions_account_id',
        'account_transactions',
        ['account_id']
    )
    
    # Index for due date queries (Requirement 6.1, 6.3)
    # Used for: aging reports, overdue account detection, collections
    op.create_index(
        'idx_account_transactions_due_date',
        'account_transactions',
        ['due_date']
    )
    
    # Composite index for account + transaction type queries
    # Used for: filtering charges vs payments, balance calculations by type
    op.create_index(
        'idx_account_transactions_account_type',
        'account_transactions',
        ['account_id', 'transaction_type']
    )
    
    # Composite index for account + due date (Requirement 6.1)
    # Used for: aging calculations, overdue transaction detection per account
    op.create_index(
        'idx_account_transactions_account_due',
        'account_transactions',
        ['account_id', 'due_date']
    )
    
    # Index for reference lookups (Requirement 2.1)
    # Used for: finding transactions related to specific orders/invoices
    op.create_index(
        'idx_account_transactions_reference',
        'account_transactions',
        ['reference_type', 'reference_id']
    )
    
    # Index for created_at for chronological queries
    # Used for: statement generation, transaction history by date range
    op.create_index(
        'idx_account_transactions_created_at',
        'account_transactions',
        ['created_at']
    )


def downgrade() -> None:
    """Drop account_transactions table and its indexes."""
    # Drop indexes
    op.drop_index('idx_account_transactions_created_at', table_name='account_transactions')
    op.drop_index('idx_account_transactions_reference', table_name='account_transactions')
    op.drop_index('idx_account_transactions_account_due', table_name='account_transactions')
    op.drop_index('idx_account_transactions_account_type', table_name='account_transactions')
    op.drop_index('idx_account_transactions_due_date', table_name='account_transactions')
    op.drop_index('idx_account_transactions_account_id', table_name='account_transactions')
    
    # Drop table
    op.drop_table('account_transactions')
