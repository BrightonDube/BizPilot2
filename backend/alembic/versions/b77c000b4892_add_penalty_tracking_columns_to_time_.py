"""Add penalty tracking columns to time_entries

Revision ID: b77c000b4892
Revises: 68e3d4c6803c
Create Date: 2026-03-16 12:12:58.765098

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'b77c000b4892'
down_revision: Union[str, None] = '68e3d4c6803c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    inspector = inspect(op.get_bind())
    columns = [c['name'] for c in inspector.get_columns('time_entries')]
    
    if 'is_auto_clocked_out' not in columns:
        op.add_column('time_entries',
            sa.Column('is_auto_clocked_out', sa.Boolean(),
                     nullable=False, server_default='false'))
    
    if 'penalty_hours' not in columns:
        op.add_column('time_entries',
            sa.Column('penalty_hours', sa.Numeric(5, 2),
                     nullable=False, server_default='0.00'))

def downgrade() -> None:
    op.drop_column('time_entries', 'penalty_hours')
    op.drop_column('time_entries', 'is_auto_clocked_out')
