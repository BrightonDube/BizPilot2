"""add_color_to_product_categories

Revision ID: 8f1e3ca8b3e8
Revises: 003_merge_heads
Create Date: 2025-12-17 00:27:54.768097

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '8f1e3ca8b3e8'
down_revision: Union[str, None] = '003_merge_heads'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add color and image_url columns to product_categories
    op.add_column('product_categories', sa.Column('color', sa.String(length=20), nullable=True))
    op.add_column('product_categories', sa.Column('image_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('product_categories', 'image_url')
    op.drop_column('product_categories', 'color')
