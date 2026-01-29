"""add subscription_feature_definitions table

Revision ID: 039_add_feat_defs
Revises: 4c665b9d28c3
Create Date: 2026-01-28

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
# NOTE: alembic_version.version_num is varchar(32) in this project, so keep IDs short.
revision = '039_add_feat_defs'
down_revision = '4c665b9d28c3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    uuid_type = sa.String(length=36).with_variant(postgresql.UUID(as_uuid=True), 'postgresql')
    op.create_table(
        'subscription_feature_definitions',
        sa.Column('id', uuid_type, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('display_name', sa.String(length=150), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key', name='uq_subscription_feature_definitions_key'),
    )

    op.create_index(
        'idx_subscription_feature_definitions_key',
        'subscription_feature_definitions',
        ['key'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index('idx_subscription_feature_definitions_key', table_name='subscription_feature_definitions')
    op.drop_table('subscription_feature_definitions')
