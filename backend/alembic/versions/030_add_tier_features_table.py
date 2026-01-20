"""add tier_features table

Revision ID: 030_add_tier_features
Revises: 029_add_stock_reservations
Create Date: 2026-01-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '030_add_tier_features'
down_revision = '029_add_stock_reservations'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create tier_features table for subscription tier definitions.
    
    This table defines the four subscription tiers (Demo, Pilot Core, Pilot Pro, Enterprise)
    with their feature flags, device limits, and pricing. It replaces the JSONB-based
    feature storage in subscription_tiers with a normalized schema for better queryability
    and type safety.
    
    Validates: Requirements 1.1, 1.2, 2.1, 3.1, 4.1
    - 1.1: Define four subscription tiers with distinct feature sets
    - 1.2: Store tier configuration in database for runtime access
    - 2.1: Demo tier with 1 device, all features enabled, free pricing
    - 3.1: Pilot Core tier with 2 devices, limited features, R620/month
    - 4.1: Pilot Pro tier with unlimited devices, all features, R1699/month
    """
    op.create_table(
        'tier_features',
        # Primary key - tier name (demo, pilot_core, pilot_pro, enterprise)
        sa.Column('tier_name', sa.String(50), nullable=False),
        
        # Device and user limits (Requirement 4.1, 4.2)
        sa.Column('max_devices', sa.Integer(), nullable=False),
        sa.Column('max_users', sa.Integer(), nullable=False),
        
        # Feature flags (Requirements 5.1, 5.2, 9.1, 9.2, 10.1, 10.2, 12.1, 12.2)
        sa.Column('has_payroll', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_ai', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_api_access', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_advanced_reporting', sa.Boolean(), nullable=False, server_default='false'),
        
        # Pricing in ZAR (Requirement 3.1, 3.5)
        sa.Column('price_monthly', sa.Numeric(10, 2), nullable=False),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.PrimaryKeyConstraint('tier_name')
    )
    
    # Seed data for the four tiers (Requirements 1.1, 2.1, 3.1, 4.1, 4.2)
    op.execute("""
        INSERT INTO tier_features (tier_name, max_devices, max_users, has_payroll, has_ai, has_api_access, has_advanced_reporting, price_monthly)
        VALUES
            ('demo', 1, 1, true, true, true, true, 0.00),
            ('pilot_core', 2, 5, false, false, false, false, 620.00),
            ('pilot_pro', 999999, 999999, true, true, true, true, 1699.00),
            ('enterprise', 999999, 999999, true, true, true, true, 0.00)
    """)
    
    # Create index on tier_name for fast lookups (already PK, but explicit for clarity)
    op.create_index('idx_tier_features_tier_name', 'tier_features', ['tier_name'])


def downgrade() -> None:
    """Drop tier_features table and its indexes."""
    # Drop index
    op.drop_index('idx_tier_features_tier_name', table_name='tier_features')
    
    # Drop table
    op.drop_table('tier_features')
