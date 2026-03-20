"""add_is_custom_pricing_to_subscription_tiers

Revision ID: ef3bb807b7d5
Revises: 4777487a7c3d
Create Date: 2026-01-18 22:27:11.050416

"""


from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'ef3bb807b7d5'
down_revision: Union[str, None] = '4777487a7c3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """
    Add is_custom_pricing column to subscription_tiers table.
    """
    # Check if column exists first to avoid errors if it was added manually in some environments
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('subscription_tiers')]
    
    if 'is_custom_pricing' not in columns:
        op.add_column('subscription_tiers', sa.Column('is_custom_pricing', sa.Boolean(), server_default='false', nullable=False))

def downgrade() -> None:
    """
    Remove is_custom_pricing column from subscription_tiers table.
    """
    op.drop_column('subscription_tiers', 'is_custom_pricing')