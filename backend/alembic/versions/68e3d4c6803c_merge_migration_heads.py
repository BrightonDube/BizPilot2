"""merge migration heads

Revision ID: 68e3d4c6803c
Revises: df4f520ae4d7, ecad824d00b3
Create Date: 2026-03-14 22:27:43.050135

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '68e3d4c6803c'
down_revision: Union[str, None] = ('df4f520ae4d7', 'ecad824d00b3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
