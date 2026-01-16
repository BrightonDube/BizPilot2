"""add laybys table

Revision ID: 023_add_laybys
Revises: 022_add_layby_config
Create Date: 2026-01-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '023_add_laybys'
down_revision = '022_add_layby_config'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create laybys table for storing layby records.
    
    This table stores layby (lay-away) purchase arrangements where customers
    pay a deposit and make scheduled payments over time before collecting goods.
    
    Validates: Requirements 1.1-1.8
    """
    op.create_table(
        'laybys',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        
        # Reference number - unique identifier for the layby (Requirement 1.5)
        sa.Column('reference_number', sa.String(50), nullable=False, unique=True),
        
        # Business and location references
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('location_id', postgresql.UUID(as_uuid=True), nullable=True),  # Optional: for location-specific tracking
        
        # Customer reference (Requirement 1.1)
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Status tracking
        # Status: draft, active, ready_for_collection, completed, cancelled, overdue
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        
        # Financial fields (Requirements 1.3, 1.4)
        sa.Column('subtotal', sa.Numeric(10, 2), nullable=False),
        sa.Column('tax_amount', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('total_amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('deposit_amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('amount_paid', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('balance_due', sa.Numeric(10, 2), nullable=False),
        
        # Payment schedule fields
        sa.Column('payment_frequency', sa.String(20), nullable=False),  # weekly, bi_weekly, monthly
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('next_payment_date', sa.Date(), nullable=True),
        sa.Column('next_payment_amount', sa.Numeric(10, 2), nullable=True),
        
        # Extension tracking
        sa.Column('extension_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('original_end_date', sa.Date(), nullable=True),
        
        # Metadata
        sa.Column('notes', sa.Text(), nullable=True),
        
        # Creation tracking (Requirement 1.6)
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Collection tracking
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('collected_by', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Cancellation tracking
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        
        # Sync fields for offline support
        sa.Column('synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_dirty', sa.Boolean(), nullable=False, server_default='false'),
        
        # Constraints
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['collected_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['cancelled_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for common queries
    op.create_index('ix_laybys_business_id', 'laybys', ['business_id'])
    op.create_index('ix_laybys_location_id', 'laybys', ['location_id'])
    op.create_index('ix_laybys_customer_id', 'laybys', ['customer_id'])
    op.create_index('ix_laybys_status', 'laybys', ['status'])
    op.create_index('ix_laybys_reference_number', 'laybys', ['reference_number'])
    op.create_index('ix_laybys_next_payment_date', 'laybys', ['next_payment_date'])
    
    # Composite index for business + status queries (common for listing active laybys)
    op.create_index('ix_laybys_business_status', 'laybys', ['business_id', 'status'])
    
    # Composite index for business + customer queries (common for customer layby history)
    op.create_index('ix_laybys_business_customer', 'laybys', ['business_id', 'customer_id'])


def downgrade() -> None:
    """Drop laybys table and its indexes."""
    # Drop composite indexes
    op.drop_index('ix_laybys_business_customer', table_name='laybys')
    op.drop_index('ix_laybys_business_status', table_name='laybys')
    
    # Drop single-column indexes
    op.drop_index('ix_laybys_next_payment_date', table_name='laybys')
    op.drop_index('ix_laybys_reference_number', table_name='laybys')
    op.drop_index('ix_laybys_status', table_name='laybys')
    op.drop_index('ix_laybys_customer_id', table_name='laybys')
    op.drop_index('ix_laybys_location_id', table_name='laybys')
    op.drop_index('ix_laybys_business_id', table_name='laybys')
    
    # Drop table
    op.drop_table('laybys')
