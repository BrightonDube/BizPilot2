"""Fix invalid payment status values

Revision ID: 011_fix_payment_status
Revises: 010_ensure_pay_enums
Create Date: 2025-01-11 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "011_fix_payment_status"
down_revision: Union[str, None] = "010_ensure_pay_enums"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Sync payment status enum with code expectations.
    DB has: failed, paid, partial, pending, refunded
    Code expects: pending, completed, failed, refunded, cancelled
    
    Solution: Add 'completed' and 'cancelled' to enum, keep 'paid' and 'partial' for backwards compat
    """
    # Add missing enum values
    op.execute(
        """
        DO $$
        BEGIN
            -- Add 'completed' as an enum value if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'paymentstatus' AND e.enumlabel = 'completed'
            ) THEN
                ALTER TYPE paymentstatus ADD VALUE 'completed';
            END IF;
        END $$;
        """
    )
    
    op.execute(
        """
        DO $$
        BEGIN
            -- Add 'cancelled' as an enum value if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'paymentstatus' AND e.enumlabel = 'cancelled'
            ) THEN
                ALTER TYPE paymentstatus ADD VALUE 'cancelled';
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # Cannot remove enum values in PostgreSQL, so downgrade is a no-op
    pass
