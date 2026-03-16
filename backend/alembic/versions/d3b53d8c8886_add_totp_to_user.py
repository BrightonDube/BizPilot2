"""add totp to user

Revision ID: d3b53d8c8886
Revises: 
Create Date: 2026-03-16 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'd3b53d8c8886'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Add columns to users table
    op.add_column('users', sa.Column('totp_secret', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('totp_enabled', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('users', sa.Column('totp_backup_codes', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('users', sa.Column('totp_enrolled_at', sa.DateTime(), nullable=True))

def downgrade() -> None:
    # Remove columns from users table
    op.drop_column('users', 'totp_enrolled_at')
    op.drop_column('users', 'totp_backup_codes')
    op.drop_column('users', 'totp_enabled')
    op.drop_column('users', 'totp_secret')
