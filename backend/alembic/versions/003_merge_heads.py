"""Merge heads

Revision ID: 003_merge_heads
Revises: 002_add_payments, 002_business_entities
Create Date: 2025-12-14 00:00:00.000000

"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "003_merge_heads"
down_revision: Union[str, tuple[str, ...], None] = ("002_add_payments", "002_business_entities")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
