"""merge_all_heads

Revision ID: 4c665b9d28c3
Revises: 038_add_account_statements, c5502fb966dd
Create Date: 2026-01-26 08:48:00.797687

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c665b9d28c3'
down_revision: Union[str, None] = ('038_add_account_statements', 'c5502fb966dd')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
