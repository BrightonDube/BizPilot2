"""merge_heads — fix broken migration chain and apply pending orphan migrations

Revision ID: z9a8b7c6d5e4
Revises: 106_add_waste_tracking, d4e5f6a7b8c9
Create Date: 2026-03-28

Merges two independent heads into a single head:
- 106_add_waste_tracking (main chain head after 105 down_revision fix)
- d4e5f6a7b8c9 (migrate feature flags to tier features — orphan)

Also inlines the orderstatus 'received' enum migration that was previously an
orphan head (h3c4d5e6f7a8) but was never applied in production because the
migration chain was broken at 105. The file is deleted to avoid Alembic
referencing a revision whose file doesn't exist.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "z9a8b7c6d5e4"
down_revision: Union[str, tuple[str, ...], None] = (
    "106_add_waste_tracking",
    "d4e5f6a7b8c9",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'received' to the orderstatus enum if not already present.
    # (was previously in h3c4d5e6f7a8 which was an orphan head never applied)
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
    # PostgreSQL does not support removing enum values — no-op.
    pass
