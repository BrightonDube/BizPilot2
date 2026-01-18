"""add_is_custom_pricing_to_subscription_tiers (no-op)

Revision ID: ef3bb807b7d5
Revises: 4777487a7c3d
Create Date: 2026-01-18 22:27:11.050416

Note: This is a no-op migration as the is_custom_pricing column
already exists in the subscription_tiers table.
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
    """
    No-op migration: is_custom_pricing column already exists.
    
    This migration was originally intended to add the is_custom_pricing column
    to the subscription_tiers table, but the column already exists in the current
    database schema. This no-op ensures the migration history remains consistent
    without making redundant changes.
    """
    pass


def downgrade() -> None:
    """
    No-op migration downgrade.
    
    Since the upgrade is a no-op, the downgrade is also a no-op.
    The is_custom_pricing column should remain in the table as it's
    part of the expected schema.
    """
    pass