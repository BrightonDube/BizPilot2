"""add feature_overrides table

Revision ID: 032_add_feature_overrides
Revises: 031_add_business_subscription
Create Date: 2026-01-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '032_add_feature_overrides'
down_revision = '031_add_business_subscription'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create feature_overrides table for SuperAdmin custom feature configurations.
    
    This table allows SuperAdmin users to override tier defaults for specific businesses,
    enabling custom deals and special configurations without code changes. Overrides
    take precedence over tier defaults when computing effective permissions.
    
    Validates: Requirements 3.1, 3.2, 13.3, 13.4
    - 3.1: Store feature overrides in database
    - 3.2: Override tier defaults for specific businesses
    - 13.3: Track who created each override for audit purposes
    - 13.4: Ensure one override per feature per business
    """
    op.create_table(
        'feature_overrides',
        # Primary key
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        
        # Foreign key to businesses table (Requirement 3.1)
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Feature name being overridden (Requirement 3.2)
        # Valid values: max_devices, max_users, has_payroll, has_ai, has_api_access, has_advanced_reporting
        sa.Column('feature_name', sa.String(50), nullable=False),
        
        # Feature value as text (cast based on feature_name)
        # For boolean features: 'true' or 'false'
        # For integer features: numeric string like '5' or '999999'
        sa.Column('feature_value', sa.Text(), nullable=False),
        
        # Audit trail: who created this override (Requirement 13.3)
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Timestamp
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.UniqueConstraint('business_id', 'feature_name', name='uq_feature_overrides_business_feature'),
        sa.CheckConstraint(
            "feature_name IN ('max_devices', 'max_users', 'has_payroll', 'has_ai', 'has_api_access', 'has_advanced_reporting')",
            name='ck_feature_overrides_feature_name'
        )
    )
    
    # Create index for looking up overrides by business_id (most common query)
    op.create_index('idx_feature_overrides_business_id', 'feature_overrides', ['business_id'])


def downgrade() -> None:
    """Drop feature_overrides table and its indexes."""
    # Drop index
    op.drop_index('idx_feature_overrides_business_id', table_name='feature_overrides')
    
    # Drop table
    op.drop_table('feature_overrides')
