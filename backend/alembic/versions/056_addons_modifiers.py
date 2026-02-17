"""Add product addons and modifiers system

Revision ID: 056_addons_modifiers
Revises: 055_multi_location
Create Date: 2025-01-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '056_addons_modifiers'
down_revision: Union[str, None] = '055_multi_location'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create selectiontype enum
    selectiontype = postgresql.ENUM(
        'single', 'multiple',
        name='selectiontype', create_type=False,
    )
    selectiontype.create(op.get_bind(), checkfirst=True)

    # Add new columns to modifier_groups
    op.add_column(
        'modifier_groups',
        sa.Column('description', sa.Text(), nullable=True),
    )
    op.add_column(
        'modifier_groups',
        sa.Column(
            'selection_type',
            selectiontype,
            server_default='single',
            nullable=True,
        ),
    )
    op.add_column(
        'modifier_groups',
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
    )

    # Widen name column on modifier_groups from 100 to 255
    op.alter_column(
        'modifier_groups', 'name',
        existing_type=sa.String(100),
        type_=sa.String(255),
        existing_nullable=False,
    )

    # Make max_selections nullable (allows unlimited for MULTIPLE)
    op.alter_column(
        'modifier_groups', 'max_selections',
        existing_type=sa.Integer(),
        nullable=True,
    )

    # Add new columns to modifiers
    op.add_column(
        'modifiers',
        sa.Column(
            'is_default', sa.Boolean(), server_default=sa.text('false'), nullable=False
        ),
    )
    op.add_column(
        'modifiers',
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
    )

    # Widen name column on modifiers from 100 to 255
    op.alter_column(
        'modifiers', 'name',
        existing_type=sa.String(100),
        type_=sa.String(255),
        existing_nullable=False,
    )

    # Create product_modifier_groups link table
    op.create_table(
        'product_modifier_groups',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'product_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('products.id'),
            nullable=False,
            index=True,
        ),
        sa.Column(
            'modifier_group_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('modifier_groups.id'),
            nullable=False,
            index=True,
        ),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('product_modifier_groups')

    op.drop_column('modifiers', 'sort_order')
    op.drop_column('modifiers', 'is_default')
    op.alter_column(
        'modifiers', 'name',
        existing_type=sa.String(255),
        type_=sa.String(100),
        existing_nullable=False,
    )

    op.alter_column(
        'modifier_groups', 'max_selections',
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.alter_column(
        'modifier_groups', 'name',
        existing_type=sa.String(255),
        type_=sa.String(100),
        existing_nullable=False,
    )
    op.drop_column('modifier_groups', 'sort_order')
    op.drop_column('modifier_groups', 'selection_type')
    op.drop_column('modifier_groups', 'description')

    postgresql.ENUM(name='selectiontype').drop(op.get_bind(), checkfirst=True)
