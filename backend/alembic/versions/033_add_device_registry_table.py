"""add device_registry table

Revision ID: 033_add_device_registry
Revises: 032_add_feature_overrides
Create Date: 2026-01-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '033_add_device_registry'
down_revision = '032_add_feature_overrides'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create device_registry table for tracking registered devices per business.
    
    This table manages device registration and enforces device limits based on
    subscription tiers. Devices are automatically marked inactive if they haven't
    synced in 30+ days, freeing up slots for new devices.
    
    Validates: Requirements 4.1, 4.2, 4.5, 4.6
    - 4.1: Track registered devices per business
    - 4.2: Enforce device limits based on tier
    - 4.5: Auto-cleanup inactive devices (last_sync > 30 days)
    - 4.6: Store device metadata for admin management
    """
    op.create_table(
        'device_registry',
        # Primary key
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        
        # Foreign key to businesses table (Requirement 4.1)
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Device identifier (UUID from device) (Requirement 4.6)
        sa.Column('device_id', sa.String(255), nullable=False),
        
        # Human-readable device name (Requirement 4.6)
        sa.Column('device_name', sa.String(255), nullable=False),
        
        # Foreign key to users table - which user registered this device
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Last sync timestamp for inactive device cleanup (Requirement 4.5)
        sa.Column('last_sync_time', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Active status flag (Requirement 4.5)
        # Set to false when device is unlinked or hasn't synced in 30+ days
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        
        # Timestamp
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.UniqueConstraint('business_id', 'device_id', name='uq_device_registry_business_device')
    )
    
    # Create index for looking up devices by business_id (most common query)
    op.create_index('idx_device_registry_business_id', 'device_registry', ['business_id'])
    
    # Create index for finding inactive devices (background cleanup job)
    op.create_index('idx_device_registry_last_sync', 'device_registry', ['last_sync_time'])
    
    # Create index for filtering active devices (device limit checks)
    op.create_index('idx_device_registry_active', 'device_registry', ['is_active'])


def downgrade() -> None:
    """Drop device_registry table and its indexes."""
    # Drop indexes
    op.drop_index('idx_device_registry_active', table_name='device_registry')
    op.drop_index('idx_device_registry_last_sync', table_name='device_registry')
    op.drop_index('idx_device_registry_business_id', table_name='device_registry')
    
    # Drop table
    op.drop_table('device_registry')
