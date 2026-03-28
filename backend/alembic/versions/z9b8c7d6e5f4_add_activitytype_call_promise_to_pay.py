"""add_activitytype_call_promise_to_pay

Revision ID: z9b8c7d6e5f4
Revises: z9a8b7c6d5e4
Create Date: 2026-03-28

Add CALL and PROMISE_TO_PAY values to the activitytype PostgreSQL enum.
The Python ActivityType enum had these values in tests but the DB enum
did not, causing DataError on insert.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "z9b8c7d6e5f4"
down_revision: Union[str, None] = "z9a8b7c6d5e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The activitytype column in collection_activities was created as String(50)
    # in migration 037, not as a PostgreSQL enum type. If a future migration
    # converts it to an enum, these ADD VALUE statements become relevant;
    # until then we guard with an existence check so this migration is a no-op
    # on databases that store activity_type as plain varchar.
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activitytype') THEN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'activitytype' AND e.enumlabel = 'call'
                ) THEN
                    ALTER TYPE activitytype ADD VALUE 'call';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'activitytype' AND e.enumlabel = 'promise_to_pay'
                ) THEN
                    ALTER TYPE activitytype ADD VALUE 'promise_to_pay';
                END IF;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # PostgreSQL does not support removing enum values — no-op.
    pass
