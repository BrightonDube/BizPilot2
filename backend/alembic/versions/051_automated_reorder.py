"""Add automated reorder tables

Revision ID: 051_automated_reorder
Revises: 050_general_ledger
Create Date: 2025-01-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '051_automated_reorder'
down_revision: Union[str, None] = '050_general_ledger'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums
    reorderrulestatus = postgresql.ENUM(
        'active', 'paused', 'disabled',
        name='reorderrulestatus', create_type=False,
    )
    reorderrulestatus.create(op.get_bind(), checkfirst=True)

    purchaseorderstatus = postgresql.ENUM(
        'draft', 'submitted', 'approved', 'ordered',
        'partially_received', 'received', 'cancelled',
        name='purchaseorderstatus', create_type=False,
    )
    purchaseorderstatus.create(op.get_bind(), checkfirst=True)

    # reorder_rules
    op.create_table(
        'reorder_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id'), nullable=False, index=True),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('suppliers.id'), nullable=True),
        sa.Column('min_stock_level', sa.Integer(), nullable=False),
        sa.Column('reorder_quantity', sa.Integer(), nullable=False),
        sa.Column('max_stock_level', sa.Integer(), nullable=True),
        sa.Column('lead_time_days', sa.Integer(), server_default='7'),
        sa.Column('status', reorderrulestatus, server_default='active'),
        sa.Column('auto_approve', sa.Boolean(), server_default='false'),
        sa.Column('last_triggered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # purchase_requests
    op.create_table(
        'purchase_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('reference', sa.String(50), nullable=False, unique=True),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('suppliers.id'), nullable=True, index=True),
        sa.Column('status', purchaseorderstatus, server_default='draft'),
        sa.Column('total_amount', sa.Numeric(12, 2), server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('requested_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expected_delivery', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_auto_generated', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # purchase_request_items
    op.create_table(
        'purchase_request_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('request_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('purchase_requests.id'), nullable=False, index=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id'), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_cost', sa.Numeric(12, 2), nullable=False),
        sa.Column('total', sa.Numeric(12, 2), nullable=False),
        sa.Column('received_quantity', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('purchase_request_items')
    op.drop_table('purchase_requests')
    op.drop_table('reorder_rules')

    op.execute("DROP TYPE IF EXISTS purchaseorderstatus")
    op.execute("DROP TYPE IF EXISTS reorderrulestatus")
