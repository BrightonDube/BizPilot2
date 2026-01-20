"""add business_subscription table

Revision ID: 031_add_business_subscription
Revises: 030_add_tier_features
Create Date: 2026-01-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '031_add_business_subscription'
down_revision = '030_add_tier_features'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create business_subscription table for tracking business subscription tiers.
    
    This table links businesses to their subscription tiers and tracks subscription
    status, expiry dates, and trial periods. Each business has exactly one subscription
    record (enforced by unique constraint on business_id).
    
    Validates: Requirements 13.2, 13.4, 13.6
    - 13.2: Link businesses to subscription tiers
    - 13.4: Track subscription status and validity
    - 13.6: Enforce referential integrity with tier_features table
    """
    op.create_table(
        'business_subscription',
        # Primary key
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        
        # Foreign key to businesses table (Requirement 13.2)
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Foreign key to tier_features table (Requirement 13.6)
        sa.Column('tier_name', sa.String(50), nullable=False),
        
        # Subscription status tracking (Requirement 13.4)
        # Values: active, suspended, cancelled, expired
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        
        # Demo expiry date (Requirement 2.2, 2.5)
        # Only used for demo tier, null for other tiers
        sa.Column('valid_until', sa.DateTime(timezone=True), nullable=True),
        
        # Trial period end date (optional, for future use)
        sa.Column('trial_end_date', sa.DateTime(timezone=True), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tier_name'], ['tier_features.tier_name'], ondelete='RESTRICT'),
        sa.UniqueConstraint('business_id', name='uq_business_subscription_business_id'),
        sa.CheckConstraint(
            "status IN ('active', 'suspended', 'cancelled', 'expired')",
            name='ck_business_subscription_status'
        )
    )
    
    # Create index for looking up subscription by business_id (most common query)
    op.create_index('idx_business_subscription_business_id', 'business_subscription', ['business_id'])
    
    # Create index for filtering by status (for admin dashboard)
    op.create_index('idx_business_subscription_status', 'business_subscription', ['status'])
    
    # Create index for finding expiring demos (background job)
    op.create_index('idx_business_subscription_valid_until', 'business_subscription', ['valid_until'])


def downgrade() -> None:
    """Drop business_subscription table and its indexes."""
    # Drop indexes
    op.drop_index('idx_business_subscription_valid_until', table_name='business_subscription')
    op.drop_index('idx_business_subscription_status', table_name='business_subscription')
    op.drop_index('idx_business_subscription_business_id', table_name='business_subscription')
    
    # Drop table
    op.drop_table('business_subscription')
