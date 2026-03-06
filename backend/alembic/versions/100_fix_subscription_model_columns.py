"""add missing columns to feature_overrides and device_registry

Revision ID: 100_fix_subscription_model_columns
Revises: 099_fix_subscription_deleted_at
Create Date: 2026-03-06

FeatureOverride and DeviceRegistry inherit updated_at/deleted_at from
BaseModel, but their migrations (032, 033) never created those columns.
Any query that touches these tables fails with:
    UndefinedColumnError: column feature_overrides.updated_at does not exist
"""
from alembic import op
import sqlalchemy as sa


revision = '100_fix_sub_model_cols'
down_revision = '099_fix_subscription_deleted_at'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # feature_overrides: missing updated_at and deleted_at
    op.add_column(
        'feature_overrides',
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
    )
    op.add_column(
        'feature_overrides',
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # device_registry: missing updated_at and deleted_at
    op.add_column(
        'device_registry',
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
    )
    op.add_column(
        'device_registry',
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('device_registry', 'deleted_at')
    op.drop_column('device_registry', 'updated_at')
    op.drop_column('feature_overrides', 'deleted_at')
    op.drop_column('feature_overrides', 'updated_at')
