"""Merge alembic heads

Revision ID: 042_merge_heads
Revises: 041_employment_start_date, 6ead9fc807d9
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '042_merge_heads'
down_revision: Union[str, None] = ('041_employment_start_date', '6ead9fc807d9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
