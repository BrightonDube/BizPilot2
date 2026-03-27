"""Add 'received' value to orderstatus enum.

The Python OrderStatus enum has RECEIVED = "received" but the PostgreSQL
enum type was created without this value (migration 002_business_entities
only listed draft/pending/confirmed/processing/shipped/delivered/cancelled/
refunded).  Writing OrderStatus.RECEIVED to the DB therefore raises:
  DataError: invalid input value for enum orderstatus: "received"

This migration adds the missing value idempotently.

Revision ID: h3c4d5e6f7a8
Revises: f1a2b3c4d5e6
Create Date: 2026-03-27 12:00:00.000000
"""

from alembic import op
from typing import Sequence, Union

revision: str = "h3c4d5e6f7a8"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add 'received' to orderstatus enum if not already present."""
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'orderstatus'
                  AND e.enumlabel = 'received'
            ) THEN
                ALTER TYPE orderstatus ADD VALUE 'received' AFTER 'delivered';
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    """PostgreSQL does not support removing enum values — this is a no-op."""
    pass
