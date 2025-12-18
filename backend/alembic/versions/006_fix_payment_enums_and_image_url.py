"""Fix payment enum casing and allow longer image URLs

Revision ID: 006_fix_pay_enums_imgurl
Revises: 005_add_deleted_at_columns
Create Date: 2025-12-18 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
# NOTE: Postgres alembic_version.version_num is often VARCHAR(32).
# Keep revision IDs <= 32 chars to avoid deployment failures during stamping.
revision: str = "006_fix_pay_enums_imgurl"
down_revision: Union[str, None] = "005_add_deleted_at_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Normalize payment enums to lowercase and ensure expected values exist
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_type t
                WHERE t.typname = 'paymentmethod'
            ) THEN
                -- Rename uppercase values to lowercase (only if the old label exists)
                IF EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'CASH'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentmethod RENAME VALUE ''CASH'' TO ''cash''';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'CARD'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentmethod RENAME VALUE ''CARD'' TO ''card''';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'BANK_TRANSFER'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentmethod RENAME VALUE ''BANK_TRANSFER'' TO ''bank_transfer''';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'MOBILE'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentmethod RENAME VALUE ''MOBILE'' TO ''mobile''';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'CHECK'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentmethod RENAME VALUE ''CHECK'' TO ''check''';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'OTHER'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentmethod RENAME VALUE ''OTHER'' TO ''other''';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'EFT'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentmethod RENAME VALUE ''EFT'' TO ''eft''';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'PAYFAST'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentmethod RENAME VALUE ''PAYFAST'' TO ''payfast''';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'YOCO'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentmethod RENAME VALUE ''YOCO'' TO ''yoco''';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'SNAPSCAN'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentmethod RENAME VALUE ''SNAPSCAN'' TO ''snapscan''';
                END IF;

                -- Ensure lowercase values exist (ADD VALUE has no IF NOT EXISTS in Postgres 16)
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'eft'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentmethod ADD VALUE ''eft''';
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'payfast'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentmethod ADD VALUE ''payfast''';
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'yoco'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentmethod ADD VALUE ''yoco''';
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentmethod' AND e.enumlabel = 'snapscan'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentmethod ADD VALUE ''snapscan''';
                END IF;
            END IF;

            IF EXISTS (
                SELECT 1
                FROM pg_type t
                WHERE t.typname = 'paymentstatus'
            ) THEN
                IF EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentstatus' AND e.enumlabel = 'PENDING'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentstatus RENAME VALUE ''PENDING'' TO ''pending''';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentstatus' AND e.enumlabel = 'COMPLETED'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentstatus RENAME VALUE ''COMPLETED'' TO ''completed''';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentstatus' AND e.enumlabel = 'FAILED'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentstatus RENAME VALUE ''FAILED'' TO ''failed''';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentstatus' AND e.enumlabel = 'REFUNDED'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentstatus RENAME VALUE ''REFUNDED'' TO ''refunded''';
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'paymentstatus' AND e.enumlabel = 'CANCELLED'
                ) THEN
                    EXECUTE 'ALTER TYPE paymentstatus RENAME VALUE ''CANCELLED'' TO ''cancelled''';
                END IF;
            END IF;
        END $$;
        """
    )

    # Allow long image URLs / data URLs
    op.execute("ALTER TABLE products ALTER COLUMN image_url TYPE TEXT")
    op.execute("ALTER TABLE product_categories ALTER COLUMN image_url TYPE TEXT")


def downgrade() -> None:
    # Best-effort rollback for image_url sizes
    op.execute("ALTER TABLE products ALTER COLUMN image_url TYPE VARCHAR(500)")
    op.execute("ALTER TABLE product_categories ALTER COLUMN image_url TYPE VARCHAR(500)")

    # No safe rollback for enum value renames/additions
    # (PostgreSQL does not support dropping enum values)
