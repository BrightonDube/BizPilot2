"""Add delivery management tables

Revision ID: 048_delivery_management
Revises: 047_menu_engineering
Create Date: 2025-01-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '048_delivery_management'
down_revision: Union[str, None] = '047_menu_engineering'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum
    deliverystatus = postgresql.ENUM(
        'pending', 'assigned', 'picked_up', 'in_transit',
        'delivered', 'failed', 'returned',
        name='deliverystatus', create_type=False,
    )
    deliverystatus.create(op.get_bind(), checkfirst=True)

    # delivery_zones
    op.create_table(
        'delivery_zones',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('delivery_fee', sa.Numeric(12, 2), nullable=False),
        sa.Column('estimated_minutes', sa.Integer, nullable=False),
        sa.Column('is_active', sa.Boolean, server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # drivers
    op.create_table(
        'drivers',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('user_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(50), nullable=False),
        sa.Column('vehicle_type', sa.String(50), nullable=True),
        sa.Column('license_plate', sa.String(20), nullable=True),
        sa.Column('is_available', sa.Boolean, server_default=sa.text('true'), nullable=False),
        sa.Column('is_active', sa.Boolean, server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # deliveries
    op.create_table(
        'deliveries',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('order_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id'), nullable=False, index=True),
        sa.Column('driver_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('drivers.id'), nullable=True, index=True),
        sa.Column('zone_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('delivery_zones.id'), nullable=True),
        sa.Column('status', sa.Enum('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned', name='deliverystatus', create_constraint=False, native_enum=False), server_default='pending', nullable=False),
        sa.Column('delivery_address', sa.Text, nullable=False),
        sa.Column('customer_phone', sa.String(50), nullable=False),
        sa.Column('delivery_fee', sa.Numeric(12, 2), server_default=sa.text('0'), nullable=False),
        sa.Column('estimated_delivery_time', sa.DateTime, nullable=True),
        sa.Column('actual_delivery_time', sa.DateTime, nullable=True),
        sa.Column('delivery_notes', sa.Text, nullable=True),
        sa.Column('proof_of_delivery', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('deliveries')
    op.drop_table('drivers')
    op.drop_table('delivery_zones')
    postgresql.ENUM(name='deliverystatus').drop(op.get_bind(), checkfirst=True)
