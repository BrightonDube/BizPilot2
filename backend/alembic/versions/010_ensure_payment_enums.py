"""Ensure payment enum values are complete

Revision ID: 010_ensure_pay_enums
Revises: 009_ai_chat_and_user_settings
Create Date: 2025-01-08 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "010_ensure_pay_enums"
down_revision: Union[str, None] = "009_ai_chat_and_user_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Ensure all payment method enum values exist.
    This migration adds any missing values to the paymentmethod enum.
    """
    op.execute(
        """
        DO $$
        BEGIN
            -- First, ensure the paymentmethod type exists
            IF NOT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'paymentmethod'
            ) THEN
                CREATE TYPE paymentmethod AS ENUM (
                    'cash', 'card', 'bank_transfer', 'eft', 'mobile', 
                    'check', 'payfast', 'yoco', 'snapscan', 'other'
                );
            ELSE
                -- Add missing values to existing enum
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'eft'
                ) THEN
                    ALTER TYPE paymentmethod ADD VALUE IF NOT EXISTS 'eft';
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'payfast'
                ) THEN
                    ALTER TYPE paymentmethod ADD VALUE IF NOT EXISTS 'payfast';
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'yoco'
                ) THEN
                    ALTER TYPE paymentmethod ADD VALUE IF NOT EXISTS 'yoco';
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'snapscan'
                ) THEN
                    ALTER TYPE paymentmethod ADD VALUE IF NOT EXISTS 'snapscan';
                END IF;
            END IF;

            -- Ensure paymentstatus type exists
            IF NOT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'paymentstatus'
            ) THEN
                CREATE TYPE paymentstatus AS ENUM (
                    'pending', 'completed', 'failed', 'refunded', 'cancelled'
                );
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # Cannot remove enum values in PostgreSQL, so downgrade is a no-op
    pass
