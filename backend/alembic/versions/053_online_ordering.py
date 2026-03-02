"""Add online ordering tables

Revision ID: 052_online_ordering
Revises: 051_automated_reorder
Create Date: 2025-01-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '053_online_ordering'
down_revision: Union[str, None] = '052_custom_dashboards'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums
    fulfillmenttype = postgresql.ENUM(
        'delivery', 'collection',
        name='fulfillmenttype', create_type=False,
    )
    fulfillmenttype.create(op.get_bind(), checkfirst=True)

    onlineorderstatus = postgresql.ENUM(
        'pending', 'confirmed', 'preparing', 'ready',
        'out_for_delivery', 'delivered', 'collected',
        'cancelled', 'refunded',
        name='onlineorderstatus', create_type=False,
    )
    onlineorderstatus.create(op.get_bind(), checkfirst=True)

    # online_stores
    op.create_table(
        'online_stores',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True, index=True),
        sa.Column('store_name', sa.String(255), nullable=False),
        sa.Column('store_url_slug', sa.String(100), nullable=True, unique=True),
        sa.Column('is_active', sa.Boolean(), server_default='false'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('min_order_amount', sa.Numeric(12, 2), server_default='0'),
        sa.Column('delivery_fee', sa.Numeric(12, 2), server_default='0'),
        sa.Column('free_delivery_threshold', sa.Numeric(12, 2), nullable=True),
        sa.Column('estimated_prep_minutes', sa.Integer(), server_default='30'),
        sa.Column('accepts_delivery', sa.Boolean(), server_default='true'),
        sa.Column('accepts_collection', sa.Boolean(), server_default='true'),
        sa.Column('operating_hours', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # online_orders
    op.create_table(
        'online_orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('order_number', sa.String(50), nullable=False, unique=True, index=True),
        sa.Column('customer_name', sa.String(255), nullable=False),
        sa.Column('customer_email', sa.String(255), nullable=True),
        sa.Column('customer_phone', sa.String(50), nullable=False),
        sa.Column('fulfillment_type', fulfillmenttype, nullable=False),
        sa.Column('delivery_address', sa.Text(), nullable=True),
        sa.Column('status', onlineorderstatus, server_default='pending'),
        sa.Column('subtotal', sa.Numeric(12, 2), server_default='0'),
        sa.Column('delivery_fee', sa.Numeric(12, 2), server_default='0'),
        sa.Column('total', sa.Numeric(12, 2), server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('estimated_ready_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('payment_method', sa.String(50), nullable=True),
        sa.Column('is_paid', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # online_order_items
    op.create_table(
        'online_order_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('online_orders.id'), nullable=False, index=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id'), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('quantity', sa.Integer(), server_default='1'),
        sa.Column('unit_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('total', sa.Numeric(12, 2), nullable=False),
        sa.Column('modifiers', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('online_order_items')
    op.drop_table('online_orders')
    op.drop_table('online_stores')

    op.execute("DROP TYPE IF EXISTS onlineorderstatus")
    op.execute("DROP TYPE IF EXISTS fulfillmenttype")
