"""Add order management tables and fields

Revision ID: 043_order_management
Revises: 042_merge_heads
Create Date: 2025-01-01 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '043_order_management'
down_revision: Union[str, None] = '042_merge_heads'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create tablestatus enum
    tablestatus = postgresql.ENUM('available', 'occupied', 'reserved', 'dirty', 'blocked', name='tablestatus', create_type=False)
    tablestatus.create(op.get_bind(), checkfirst=True)

    # Create ordertype enum
    ordertype = postgresql.ENUM('dine_in', 'takeaway', 'delivery', 'collection', 'standard', name='ordertype', create_type=False)
    ordertype.create(op.get_bind(), checkfirst=True)

    # Create restaurant_tables table
    op.create_table(
        'restaurant_tables',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('table_number', sa.String(20), nullable=False),
        sa.Column('capacity', sa.Integer(), default=4),
        sa.Column('status', tablestatus, default='available'),
        sa.Column('section', sa.String(50), nullable=True),
        sa.Column('position_x', sa.Numeric(8, 2), default=0),
        sa.Column('position_y', sa.Numeric(8, 2), default=0),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Create order_status_history table
    op.create_table(
        'order_status_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id'), nullable=False, index=True),
        sa.Column('old_status', sa.String(50), nullable=True),
        sa.Column('new_status', sa.String(50), nullable=False),
        sa.Column('changed_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Add new columns to orders table
    op.add_column('orders', sa.Column('order_type', ordertype, nullable=True))
    op.add_column('orders', sa.Column('table_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('orders', sa.Column('delivery_address_text', sa.Text(), nullable=True))
    op.add_column('orders', sa.Column('delivery_phone', sa.String(50), nullable=True))
    op.add_column('orders', sa.Column('driver_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('orders', sa.Column('estimated_delivery_time', sa.DateTime(timezone=True), nullable=True))
    op.add_column('orders', sa.Column('delivery_fee', sa.Numeric(12, 2), server_default='0'))
    op.add_column('orders', sa.Column('is_tab', sa.Boolean(), server_default='false'))
    op.add_column('orders', sa.Column('tab_name', sa.String(100), nullable=True))
    op.add_column('orders', sa.Column('course_count', sa.Integer(), server_default='1'))

    # Add foreign key for table_id
    op.create_foreign_key('fk_orders_table_id', 'orders', 'restaurant_tables', ['table_id'], ['id'])
    op.create_index('ix_orders_table_id', 'orders', ['table_id'])


def downgrade() -> None:
    op.drop_index('ix_orders_table_id', table_name='orders')
    op.drop_constraint('fk_orders_table_id', 'orders', type_='foreignkey')
    op.drop_column('orders', 'course_count')
    op.drop_column('orders', 'tab_name')
    op.drop_column('orders', 'is_tab')
    op.drop_column('orders', 'delivery_fee')
    op.drop_column('orders', 'estimated_delivery_time')
    op.drop_column('orders', 'driver_id')
    op.drop_column('orders', 'delivery_phone')
    op.drop_column('orders', 'delivery_address_text')
    op.drop_column('orders', 'table_id')
    op.drop_column('orders', 'order_type')
    op.drop_table('order_status_history')
    op.drop_table('restaurant_tables')

    ordertype = postgresql.ENUM('dine_in', 'takeaway', 'delivery', 'collection', 'standard', name='ordertype', create_type=False)
    ordertype.drop(op.get_bind(), checkfirst=True)
    tablestatus = postgresql.ENUM('available', 'occupied', 'reserved', 'dirty', 'blocked', name='tablestatus', create_type=False)
    tablestatus.drop(op.get_bind(), checkfirst=True)
