"""add deleted_at to business_subscription

Revision ID: 099_fix_subscription_deleted_at
Revises: 098_sage_integration
Create Date: 2026-03-06

The BusinessSubscription model inherits deleted_at from BaseModel but
migration 031 never created that column.  Every query that touches
BusinessSubscription (e.g. AI chat auth, reports auth) fails with:
    column business_subscription.deleted_at does not exist
"""

from alembic import op
import sqlalchemy as sa


revision = '099_fix_subscription_deleted_at'
down_revision = '098_sage_integration'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column(
        'business_subscription',
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

def downgrade() -> None:
    op.drop_column('business_subscription', 'deleted_at')
