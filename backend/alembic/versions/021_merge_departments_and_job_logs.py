"""merge departments and job logs

Revision ID: 021_merge_heads
Revises: 020_add_department_id, 298dd1eda420
Create Date: 2026-01-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '021_merge_heads'
down_revision = ('020_add_department_id', '298dd1eda420')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge migration - no changes needed
    pass


def downgrade() -> None:
    # Merge migration - no changes needed
    pass
