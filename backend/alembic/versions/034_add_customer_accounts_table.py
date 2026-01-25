"""add customer_accounts table

Revision ID: 034_add_customer_accounts
Revises: 033_add_device_registry
Create Date: 2026-01-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '034_add_customer_accounts'
down_revision = '033_add_device_registry'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create customer_accounts table for managing customer credit accounts.
    
    This table enables businesses to offer credit accounts to trusted customers,
    track balances, manage credit limits, and process account-based transactions.
    Essential for B2B operations and hospitality venues with house accounts.
    
    Validates: Requirements 1.1-1.6
    - 1.1: Enable account functionality per customer
    - 1.2: Set credit limit per customer
    - 1.3: Set payment terms (Net 7, 30, 60, etc.)
    - 1.4: Support account approval workflow
    - 1.5: Track account opening date and status
    - 1.6: Support account suspension and closure
    """
    op.create_table(
        'customer_accounts',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        
        # Foreign keys (Requirement 1.1)
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Account identification
        sa.Column('account_number', sa.String(50), nullable=False),
        
        # Account status (Requirement 1.4, 1.5, 1.6)
        # Status values: 'pending', 'active', 'suspended', 'closed'
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        
        # Credit management (Requirement 1.2, 1.3)
        sa.Column('credit_limit', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('current_balance', sa.Numeric(12, 2), nullable=False, server_default='0'),
        
        # Available credit (computed column)
        # This is a generated column that automatically calculates available credit
        sa.Column(
            'available_credit',
            sa.Numeric(12, 2),
            sa.Computed('credit_limit - current_balance', persisted=True),
            nullable=True
        ),
        
        # Payment terms in days (Requirement 1.3)
        # Common values: 7 (Net 7), 30 (Net 30), 60 (Net 60)
        sa.Column('payment_terms', sa.Integer(), nullable=False, server_default='30'),
        
        # Security - PIN for account verification (Requirement 2.4)
        sa.Column('account_pin', sa.String(100), nullable=True),
        
        # Status timestamps (Requirement 1.5, 1.6)
        sa.Column('opened_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('suspended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        
        # Additional information
        sa.Column('notes', sa.Text(), nullable=True),
        
        # Audit timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        
        # Unique constraint: one account per customer per business
        sa.UniqueConstraint('customer_id', 'business_id', name='uq_customer_accounts_customer_business')
    )
    
    # Create indexes for common queries
    # Index for looking up accounts by customer
    op.create_index('idx_customer_accounts_customer_id', 'customer_accounts', ['customer_id'])
    
    # Index for looking up accounts by business
    op.create_index('idx_customer_accounts_business_id', 'customer_accounts', ['business_id'])
    
    # Index for filtering by status (e.g., finding all active accounts)
    op.create_index('idx_customer_accounts_status', 'customer_accounts', ['status'])
    
    # Composite index for business + status queries (common in dashboards)
    op.create_index('idx_customer_accounts_business_status', 'customer_accounts', ['business_id', 'status'])


def downgrade() -> None:
    """Drop customer_accounts table and its indexes."""
    # Drop indexes
    op.drop_index('idx_customer_accounts_business_status', table_name='customer_accounts')
    op.drop_index('idx_customer_accounts_status', table_name='customer_accounts')
    op.drop_index('idx_customer_accounts_business_id', table_name='customer_accounts')
    op.drop_index('idx_customer_accounts_customer_id', table_name='customer_accounts')
    
    # Drop table
    op.drop_table('customer_accounts')
