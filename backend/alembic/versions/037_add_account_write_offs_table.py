"""add account_write_offs table

Revision ID: 037_add_account_write_offs
Revises: 036_add_account_payments
Create Date: 2026-01-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '037_add_account_write_offs'
down_revision = '036_add_account_payments'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create account_write_offs table.
    
    This table handles write-off workflow for uncollectable bad debt:
    - Records when account balances are written off
    - Tracks approval workflow for write-offs
    - Maintains audit trail of write-off decisions
    
    Validates: Requirement 7 - Collections Management
    - Requirement 7.6: Support write-off workflow for bad debt
    
    Validates: Requirement 8 - Reporting
    - Requirement 8.4: Report bad debt and write-offs
    """
    
    # Create account_write_offs table
    op.create_table(
        'account_write_offs',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        
        # Foreign key to customer account (Requirement 7.6)
        # Links to the account being written off
        sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Write-off amount (Requirement 7.6, 8.4)
        # Amount of debt being written off as uncollectable
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        
        # Write-off reason (Requirement 7.6)
        # Required justification for write-off decision
        # Examples: "Customer bankrupt", "Uncontactable", "Legal costs exceed debt"
        sa.Column('reason', sa.Text(), nullable=False),
        
        # Approval workflow (Requirement 7.6)
        # Track who approved the write-off (manager/finance approval required)
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Audit trail (Requirement 8.4)
        # Timestamp for write-off reporting and tracking
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['account_id'], ['customer_accounts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ondelete='SET NULL'),
        
        # Check constraint: write-off amount must be positive
        sa.CheckConstraint('amount > 0', name='ck_account_write_offs_amount_positive')
    )
    
    # Create indexes for account_write_offs
    
    # Index for looking up all write-offs for an account (Requirement 7.6)
    # Used for: account history, write-off tracking, audit trails
    op.create_index(
        'idx_account_write_offs_account_id',
        'account_write_offs',
        ['account_id']
    )
    
    # Index for chronological write-off queries (Requirement 8.4)
    # Used for: bad debt reporting, period analysis, trend tracking
    op.create_index(
        'idx_account_write_offs_created_at',
        'account_write_offs',
        ['created_at']
    )
    
    # Composite index for account + date queries (Requirement 7.6, 8.4)
    # Used for: account write-off history by date range
    op.create_index(
        'idx_account_write_offs_account_date',
        'account_write_offs',
        ['account_id', 'created_at']
    )
    
    # Index for approval tracking (Requirement 7.6)
    # Used for: approval audit trails, manager activity reports
    op.create_index(
        'idx_account_write_offs_approved_by',
        'account_write_offs',
        ['approved_by']
    )


def downgrade() -> None:
    """Drop account_write_offs table and its indexes."""
    
    # Drop indexes
    op.drop_index('idx_account_write_offs_approved_by', table_name='account_write_offs')
    op.drop_index('idx_account_write_offs_account_date', table_name='account_write_offs')
    op.drop_index('idx_account_write_offs_created_at', table_name='account_write_offs')
    op.drop_index('idx_account_write_offs_account_id', table_name='account_write_offs')
    
    # Drop table
    op.drop_table('account_write_offs')
