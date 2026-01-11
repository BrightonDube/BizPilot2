"""Merge heads after payment status fixes

Revision ID: f1a2b3c4d5e6
Revises: 011_fix_payment_status, e7c1f3a2b9d0
Create Date: 2026-01-12 00:00:00.000000

"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, tuple[str, ...], None] = (
    "011_fix_payment_status",
    "e7c1f3a2b9d0",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
