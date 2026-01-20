"""merge_device_registry_and_schema_sync

Revision ID: c5502fb966dd
Revises: 033_add_device_registry, 6e181364b886
Create Date: 2026-01-20 20:09:33.017416

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5502fb966dd'
down_revision: Union[str, None] = ('033_add_device_registry', '6e181364b886')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
