"""Add menu engineering tables

Revision ID: 047_menu_engineering
Revises: 046_stock_take
Create Date: 2025-01-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '047_menu_engineering'
down_revision: Union[str, None] = '046_stock_take'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # menu_items
    op.create_table(
        'menu_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id'), nullable=False, index=True),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('product_categories.id'), nullable=True, index=True),
        sa.Column('display_name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('price', sa.Numeric(12, 2), nullable=False),
        sa.Column('cost', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_available', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_featured', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('prep_time_minutes', sa.Integer(), nullable=True),
        sa.Column('course', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # modifier_groups
    op.create_table(
        'modifier_groups',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('min_selections', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_selections', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_required', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # modifiers
    op.create_table(
        'modifiers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('group_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('modifier_groups.id'), nullable=False, index=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('price_adjustment', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('is_available', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # menu_item_modifier_groups
    op.create_table(
        'menu_item_modifier_groups',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('menu_item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('menu_items.id'), nullable=False, index=True),
        sa.Column('modifier_group_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('modifier_groups.id'), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # recipes
    op.create_table(
        'recipes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('menu_item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('menu_items.id'), nullable=True, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('yield_quantity', sa.Numeric(12, 2), nullable=False, server_default='1'),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # recipe_ingredients
    op.create_table(
        'recipe_ingredients',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('recipe_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('recipes.id'), nullable=False, index=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id'), nullable=False, index=True),
        sa.Column('quantity', sa.Numeric(12, 4), nullable=False),
        sa.Column('unit', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('recipe_ingredients')
    op.drop_table('recipes')
    op.drop_table('menu_item_modifier_groups')
    op.drop_table('modifiers')
    op.drop_table('modifier_groups')
    op.drop_table('menu_items')
