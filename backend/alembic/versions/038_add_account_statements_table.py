"""add account_statements table

Revision ID: 038_add_account_statements
Revises: 037_add_account_write_offs, 037_add_collection_activities
Create Date: 2026-01-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '038_add_account_statements'
down_revision = ('037_add_account_write_offs', '037_add_collection_activities')
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create account_statements table for customer account statement generation.
    
    This table stores generated statements for customer accounts, including
    period summaries, aging breakdowns, and delivery tracking. Statements provide
    customers with a clear view of their account activity and outstanding balances.
    
    Validates: Requirement 5 - Statement Generation
    - Requirement 5.1: Generate monthly statements automatically
    - Requirement 5.2: Show opening balance, transactions, closing balance
    - Requirement 5.3: Include aging breakdown (current, 30, 60, 90+ days)
    - Requirement 5.4: Support statement delivery via email
    - Requirement 5.5: Support PDF statement download
    - Requirement 5.6: Allow custom statement date ranges
    """
    
    # Create account_statements table
    op.create_table(
        'account_statements',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        
        # Foreign key to customer account (Requirement 5.1)
        sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Statement period (Requirement 5.1, 5.6)
        # statement_date: The date the statement was generated
        # period_start/period_end: The date range covered by the statement
        sa.Column('statement_date', sa.Date(), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        
        # Balance summary (Requirement 5.2)
        # opening_balance: Balance at start of period
        # total_charges: Sum of all charges during period
        # total_payments: Sum of all payments during period
        # closing_balance: Balance at end of period (opening + charges - payments)
        sa.Column('opening_balance', sa.Numeric(12, 2), nullable=False),
        sa.Column('total_charges', sa.Numeric(12, 2), nullable=False),
        sa.Column('total_payments', sa.Numeric(12, 2), nullable=False),
        sa.Column('closing_balance', sa.Numeric(12, 2), nullable=False),
        
        # Aging breakdown (Requirement 5.3)
        # Categorizes outstanding balance by how long overdue:
        # - current_amount: Not yet due (within payment terms)
        # - days_30_amount: 1-30 days overdue
        # - days_60_amount: 31-60 days overdue
        # - days_90_plus_amount: 61+ days overdue
        sa.Column('current_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('days_30_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('days_60_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('days_90_plus_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        
        # Delivery tracking (Requirement 5.4)
        # sent_at: Timestamp when statement was emailed to customer
        # NULL if statement has not been sent yet
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        
        # Audit timestamp
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['account_id'], ['customer_accounts.id'], ondelete='CASCADE'),
        
        # Check constraint: period_end must be after period_start
        sa.CheckConstraint('period_end >= period_start', name='ck_account_statements_period_valid'),
        
        # Check constraint: statement_date should be on or after period_end
        sa.CheckConstraint('statement_date >= period_end', name='ck_account_statements_date_valid'),
        
        # Check constraint: closing_balance calculation integrity
        # closing_balance = opening_balance + total_charges - total_payments
        sa.CheckConstraint(
            'closing_balance = opening_balance + total_charges - total_payments',
            name='ck_account_statements_balance_integrity'
        ),
        
        # Check constraint: aging amounts sum to closing balance
        # This ensures the aging breakdown is accurate
        sa.CheckConstraint(
            'closing_balance = current_amount + days_30_amount + days_60_amount + days_90_plus_amount',
            name='ck_account_statements_aging_sum'
        )
    )
    
    # Create indexes for account_statements
    
    # Index for looking up statements by account (Requirement 5.1, 5.5)
    # Used for: statement history, finding latest statement, account statement list
    op.create_index(
        'idx_account_statements_account_id',
        'account_statements',
        ['account_id']
    )
    
    # Index for chronological statement queries (Requirement 5.1)
    # Used for: finding statements by date, monthly statement generation
    op.create_index(
        'idx_account_statements_statement_date',
        'account_statements',
        ['statement_date']
    )
    
    # Composite index for account + date queries (Requirement 5.1, 5.6)
    # Used for: finding statements for an account within a date range
    # Optimizes queries like "get all statements for account X in 2024"
    op.create_index(
        'idx_account_statements_account_date',
        'account_statements',
        ['account_id', 'statement_date']
    )
    
    # Index for period queries (Requirement 5.6)
    # Used for: finding statements covering a specific period
    op.create_index(
        'idx_account_statements_period',
        'account_statements',
        ['period_start', 'period_end']
    )
    
    # Index for tracking sent statements (Requirement 5.4)
    # Used for: finding unsent statements, delivery tracking, resend functionality
    op.create_index(
        'idx_account_statements_sent_at',
        'account_statements',
        ['sent_at']
    )
    
    # Composite index for unsent statements by account (Requirement 5.4)
    # Used for: finding unsent statements for a specific account
    # Partial index: only indexes rows where sent_at IS NULL
    op.create_index(
        'idx_account_statements_account_unsent',
        'account_statements',
        ['account_id'],
        postgresql_where=sa.text('sent_at IS NULL')
    )


def downgrade() -> None:
    """Drop account_statements table and its indexes."""
    
    # Drop indexes
    op.drop_index('idx_account_statements_account_unsent', table_name='account_statements')
    op.drop_index('idx_account_statements_sent_at', table_name='account_statements')
    op.drop_index('idx_account_statements_period', table_name='account_statements')
    op.drop_index('idx_account_statements_account_date', table_name='account_statements')
    op.drop_index('idx_account_statements_statement_date', table_name='account_statements')
    op.drop_index('idx_account_statements_account_id', table_name='account_statements')
    
    # Drop table
    op.drop_table('account_statements')
