"""Merge migration heads

Revision ID: 04c9537675e7
Revises: b77c000b4892, d3b53d8c8886
Create Date: 2026-03-17 00:27:03.458304

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '04c9537675e7'
down_revision: Union[str, None] = ('b77c000b4892', 'd3b53d8c8886')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
