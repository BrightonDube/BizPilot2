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

# Constants for unlimited values
UNLIMITED = None  # Use NULL to represent unlimited instead of magic numbers


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
        # NULL represents unlimited
        sa.Column('max_devices', sa.Integer(), nullable=True),
        sa.Column('max_users', sa.Integer(), nullable=True),
        
        # Feature flags (Requirements 5.1, 5.2, 9.1, 9.2, 10.1, 10.2, 12.1, 12.2)
        sa.Column('has_payroll', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_ai', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_api_access', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_advanced_reporting', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_multi_location', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_loyalty_programs', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_recipe_management', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_accounting_integration', sa.Boolean(), nullable=False, server_default='false'),
        
        # Pricing in ZAR (Requirement 3.1, 3.5)
        sa.Column('price_monthly', sa.Numeric(10, 2), nullable=False),
        
        # Soft delete support (consistent with migration 005)
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.PrimaryKeyConstraint('tier_name'),
        sa.CheckConstraint('max_devices IS NULL OR max_devices > 0', name='check_max_devices_positive'),
        sa.CheckConstraint('max_users IS NULL OR max_users > 0', name='check_max_users_positive'),
        sa.CheckConstraint('price_monthly >= 0', name='check_price_non_negative'),
        sa.CheckConstraint(
            "tier_name IN ('demo', 'pilot_core', 'pilot_pro', 'enterprise')",
            name='check_valid_tier_name'
        )
    )
    
    # Seed data for the four tiers using bulk_insert for better maintainability
    # (Requirements 1.1, 2.1, 3.1, 4.1, 4.2)
    tier_features_table = sa.table(
        'tier_features',
        sa.column('tier_name', sa.String),
        sa.column('max_devices', sa.Integer),
        sa.column('max_users', sa.Integer),
        sa.column('has_payroll', sa.Boolean),
        sa.column('has_ai', sa.Boolean),
        sa.column('has_api_access', sa.Boolean),
        sa.column('has_advanced_reporting', sa.Boolean),
        sa.column('has_multi_location', sa.Boolean),
        sa.column('has_loyalty_programs', sa.Boolean),
        sa.column('has_recipe_management', sa.Boolean),
        sa.column('has_accounting_integration', sa.Boolean),
        sa.column('price_monthly', sa.Numeric),
    )
    
    op.bulk_insert(
        tier_features_table,
        [
            {
                'tier_name': 'demo',
                'max_devices': 1,
                'max_users': 1,
                'has_payroll': True,
                'has_ai': True,
                'has_api_access': True,
                'has_advanced_reporting': True,
                'has_multi_location': False,
                'has_loyalty_programs': True,
                'has_recipe_management': True,
                'has_accounting_integration': False,
                'price_monthly': 0.00,
            },
            {
                'tier_name': 'pilot_core',
                'max_devices': 2,
                'max_users': 5,
                'has_payroll': False,
                'has_ai': False,
                'has_api_access': False,
                'has_advanced_reporting': False,
                'has_multi_location': False,
                'has_loyalty_programs': False,
                'has_recipe_management': False,
                'has_accounting_integration': False,
                'price_monthly': 620.00,
            },
            {
                'tier_name': 'pilot_pro',
                'max_devices': None,  # Unlimited
                'max_users': None,    # Unlimited
                'has_payroll': True,
                'has_ai': True,
                'has_api_access': True,
                'has_advanced_reporting': True,
                'has_multi_location': True,
                'has_loyalty_programs': True,
                'has_recipe_management': True,
                'has_accounting_integration': True,
                'price_monthly': 1699.00,
            },
            {
                'tier_name': 'enterprise',
                'max_devices': None,  # Unlimited
                'max_users': None,    # Unlimited
                'has_payroll': True,
                'has_ai': True,
                'has_api_access': True,
                'has_advanced_reporting': True,
                'has_multi_location': True,
                'has_loyalty_programs': True,
                'has_recipe_management': True,
                'has_accounting_integration': True,
                'price_monthly': 0.00,  # Custom pricing
            },
        ]
    )


def downgrade() -> None:
    """Drop tier_features table."""
    op.drop_table('tier_features')
