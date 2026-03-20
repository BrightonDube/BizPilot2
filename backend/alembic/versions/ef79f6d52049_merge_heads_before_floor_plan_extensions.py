"""merge heads before floor plan extensions

Revision ID: ef79f6d52049
Revises: 104_delivery_missing, a1b2c3d4e5f6
Create Date: 2026-03-13 15:36:18.565155

"""


from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'ef79f6d52049'
down_revision: Union[str, None] = ('104_delivery_missing', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    pass

def downgrade() -> None:
    pass
