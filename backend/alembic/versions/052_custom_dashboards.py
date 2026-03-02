"""Add custom dashboards tables

Revision ID: 052_custom_dashboards
Revises: 051_automated_reorder
Create Date: 2025-01-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '052_custom_dashboards'
down_revision: Union[str, None] = '051_automated_reorder'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'dashboards',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_default', sa.Boolean(), server_default='false'),
        sa.Column('layout', sa.Text(), nullable=True),
        sa.Column('is_shared', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    )
    op.create_index('ix_dashboards_business_id', 'dashboards', ['business_id'])
    op.create_index('ix_dashboards_user_id', 'dashboards', ['user_id'])

    op.create_table(
        'dashboard_widgets',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('dashboard_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('widget_type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('config', postgresql.JSONB(), nullable=True),
        sa.Column('position_x', sa.Integer(), server_default='0'),
        sa.Column('position_y', sa.Integer(), server_default='0'),
        sa.Column('width', sa.Integer(), server_default='4'),
        sa.Column('height', sa.Integer(), server_default='3'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['dashboard_id'], ['dashboards.id']),
    )
    op.create_index('ix_dashboard_widgets_dashboard_id', 'dashboard_widgets', ['dashboard_id'])


def downgrade() -> None:
    op.drop_index('ix_dashboard_widgets_dashboard_id', table_name='dashboard_widgets')
    op.drop_table('dashboard_widgets')
    op.drop_index('ix_dashboards_user_id', table_name='dashboards')
    op.drop_index('ix_dashboards_business_id', table_name='dashboards')
    op.drop_table('dashboards')
