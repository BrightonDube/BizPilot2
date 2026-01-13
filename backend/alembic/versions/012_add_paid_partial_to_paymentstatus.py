"""Add paid and partial values to paymentstatus enum

Revision ID: 012_add_paid_partial
Revises: f1a2b3c4d5e6
Create Date: 2026-01-12 23:30:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "012_add_paid_partial"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add 'paid' and 'partial' values to paymentstatus enum.
    These values are used for backwards compatibility with code that
    expects these status values.
    """
    # Add 'paid' to paymentstatus enum if it doesn't exist
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'paymentstatus' AND e.enumlabel = 'paid'
            ) THEN
                ALTER TYPE paymentstatus ADD VALUE 'paid';
            END IF;
        END $$;
        """
    )
    
    # Add 'partial' to paymentstatus enum if it doesn't exist
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'paymentstatus' AND e.enumlabel = 'partial'
            ) THEN
                ALTER TYPE paymentstatus ADD VALUE 'partial';
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # Cannot remove enum values in PostgreSQL, so downgrade is a no-op
    pass
