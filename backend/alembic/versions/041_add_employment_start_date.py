"""Add employment_start_date to business_users

Revision ID: 041_employment_start_date
Revises: 040_report_subs
Create Date: 2026-02-16
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '041_employment_start_date'
down_revision = '040_report_subs'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('business_users', sa.Column('employment_start_date', sa.Date(), nullable=True))


def downgrade():
    op.drop_column('business_users', 'employment_start_date')
