"""add_is_custom_pricing_to_subscription_tiers

Revision ID: ef3bb807b7d5
Revises: 4777487a7c3d
Create Date: 2026-01-18 22:27:11.050416

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ef3bb807b7d5'
down_revision: Union[str, None] = '4777487a7c3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_custom_pricing column to subscription_tiers table
    op.add_column('subscription_tiers', sa.Column('is_custom_pricing', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    # Remove is_custom_pricing column from subscription_tiers table
    op.drop_column('subscription_tiers', 'is_custom_pricing')
