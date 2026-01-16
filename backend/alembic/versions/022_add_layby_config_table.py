"""add layby_config table

Revision ID: 022_add_layby_config
Revises: 021_merge_heads
Create Date: 2026-01-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '022_add_layby_config'
down_revision = '021_merge_heads'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create layby_config table for storing layby configuration settings.
    
    This table stores configurable layby policies per business (and optionally per location).
    Validates: Requirements 12.1-12.8
    """
    op.create_table(
        'layby_config',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        
        # Business and location references
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('location_id', postgresql.UUID(as_uuid=True), nullable=True),  # Optional: for location-specific config
        
        # Deposit configuration (Requirement 12.1)
        sa.Column('min_deposit_percentage', sa.Numeric(5, 2), nullable=False, server_default='10.00'),
        
        # Duration configuration (Requirement 12.2)
        sa.Column('max_duration_days', sa.Integer(), nullable=False, server_default='90'),
        
        # Cancellation fee configuration (Requirement 12.3)
        sa.Column('cancellation_fee_percentage', sa.Numeric(5, 2), nullable=False, server_default='10.00'),
        sa.Column('cancellation_fee_minimum', sa.Numeric(10, 2), nullable=False, server_default='10.00'),
        
        # Restocking fee configuration (Requirement 12.4)
        sa.Column('restocking_fee_per_item', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        
        # Extension configuration (Requirement 12.5)
        sa.Column('extension_fee', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('max_extensions', sa.Integer(), nullable=False, server_default='2'),
        
        # Reminder configuration (Requirement 12.6)
        sa.Column('reminder_days_before', sa.Integer(), nullable=False, server_default='3'),
        
        # Collection grace period (Requirement 12.7)
        sa.Column('collection_grace_days', sa.Integer(), nullable=False, server_default='14'),
        
        # Enable/disable layby feature (Requirement 12.8)
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('business_id', 'location_id', name='uq_layby_config_business_location')
    )
    
    # Create indexes for common queries
    op.create_index('ix_layby_config_business_id', 'layby_config', ['business_id'])
    op.create_index('ix_layby_config_location_id', 'layby_config', ['location_id'])
    op.create_index('ix_layby_config_is_enabled', 'layby_config', ['is_enabled'])


def downgrade() -> None:
    """Drop layby_config table and its indexes."""
    op.drop_index('ix_layby_config_is_enabled', table_name='layby_config')
    op.drop_index('ix_layby_config_location_id', table_name='layby_config')
    op.drop_index('ix_layby_config_business_id', table_name='layby_config')
    op.drop_table('layby_config')
