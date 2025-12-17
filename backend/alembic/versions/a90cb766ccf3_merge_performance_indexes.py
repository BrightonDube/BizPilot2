"""merge_performance_indexes

Revision ID: a90cb766ccf3
Revises: 004_performance_indexes, 60dd02bfc53b
Create Date: 2025-12-17 13:37:34.821434

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a90cb766ccf3'
down_revision: Union[str, None] = ('004_performance_indexes', '60dd02bfc53b')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
