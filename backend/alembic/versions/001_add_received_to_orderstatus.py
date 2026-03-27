"""Add 'received' status to orderstatus enum

Revision ID: g2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-03-27 10:00:00.000000

"""

from alembic import op
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'g2b3c4d5e6f7'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add 'received' value to orderstatus enum type."""
    # PostgreSQL doesn't allow removing enum values, so we use ALTER TYPE ADD VALUE
    # Check if the value already exists to make this migration idempotent
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'orderstatus' AND e.enumlabel = 'received'
            ) THEN
                ALTER TYPE orderstatus ADD VALUE 'received' AFTER 'delivered';
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Remove 'received' value from orderstatus enum type."""
    # PostgreSQL doesn't allow removing enum values, so this is a no-op
    # The value will remain in the database after downgrade
    pass
