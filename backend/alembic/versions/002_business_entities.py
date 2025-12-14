"""Add products, customers, orders, invoices tables

Revision ID: 002_business_entities
Revises: 001_initial_schema
Create Date: 2024-01-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002_business_entities'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create product_categories table
    op.create_table(
        'product_categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('product_categories.id'), nullable=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sort_order', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # Create products table
    op.create_table(
        'products',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('product_categories.id'), nullable=True, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sku', sa.String(100), nullable=True, index=True),
        sa.Column('barcode', sa.String(100), nullable=True, index=True),
        sa.Column('cost_price', sa.Numeric(12, 2), nullable=True),
        sa.Column('selling_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('compare_at_price', sa.Numeric(12, 2), nullable=True),
        sa.Column('is_taxable', sa.Boolean(), default=True),
        sa.Column('tax_rate', sa.Numeric(5, 2), nullable=True),
        sa.Column('track_inventory', sa.Boolean(), default=True),
        sa.Column('quantity', sa.Integer(), default=0),
        sa.Column('low_stock_threshold', sa.Integer(), default=10),
        sa.Column('status', sa.Enum('active', 'draft', 'archived', 'out_of_stock', name='productstatus'), default='draft'),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # Create customers table
    op.create_table(
        'customers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('customer_type', sa.Enum('individual', 'business', name='customertype'), default='individual'),
        sa.Column('first_name', sa.String(100), nullable=True),
        sa.Column('last_name', sa.String(100), nullable=True),
        sa.Column('email', sa.String(255), nullable=True, index=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('company_name', sa.String(255), nullable=True),
        sa.Column('tax_number', sa.String(100), nullable=True),
        sa.Column('address_line1', sa.String(255), nullable=True),
        sa.Column('address_line2', sa.String(255), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state', sa.String(100), nullable=True),
        sa.Column('postal_code', sa.String(20), nullable=True),
        sa.Column('country', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('total_orders', sa.Integer(), default=0),
        sa.Column('total_spent', sa.Numeric(12, 2), default=0),
        sa.Column('average_order_value', sa.Numeric(12, 2), default=0),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # Create orders table
    op.create_table(
        'orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id'), nullable=True, index=True),
        sa.Column('order_number', sa.String(50), nullable=False, unique=True, index=True),
        sa.Column('status', sa.Enum('draft', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', name='orderstatus'), default='draft'),
        sa.Column('payment_status', sa.Enum('pending', 'partial', 'paid', 'refunded', 'failed', name='paymentstatus'), default='pending'),
        sa.Column('subtotal', sa.Numeric(12, 2), default=0),
        sa.Column('tax_amount', sa.Numeric(12, 2), default=0),
        sa.Column('discount_amount', sa.Numeric(12, 2), default=0),
        sa.Column('shipping_amount', sa.Numeric(12, 2), default=0),
        sa.Column('total', sa.Numeric(12, 2), default=0),
        sa.Column('amount_paid', sa.Numeric(12, 2), default=0),
        sa.Column('payment_method', sa.String(50), nullable=True),
        sa.Column('shipping_address', postgresql.JSONB(), nullable=True),
        sa.Column('billing_address', postgresql.JSONB(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('internal_notes', sa.Text(), nullable=True),
        sa.Column('order_date', sa.DateTime(), nullable=True),
        sa.Column('shipped_date', sa.DateTime(), nullable=True),
        sa.Column('delivered_date', sa.DateTime(), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('source', sa.String(50), default='manual'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # Create order_items table
    op.create_table(
        'order_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id'), nullable=False, index=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id'), nullable=True, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('sku', sa.String(100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('unit_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('quantity', sa.Integer(), default=1),
        sa.Column('tax_rate', sa.Numeric(5, 2), default=0),
        sa.Column('tax_amount', sa.Numeric(12, 2), default=0),
        sa.Column('discount_percent', sa.Numeric(5, 2), default=0),
        sa.Column('discount_amount', sa.Numeric(12, 2), default=0),
        sa.Column('total', sa.Numeric(12, 2), default=0),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # Create invoices table
    op.create_table(
        'invoices',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id'), nullable=True, index=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id'), nullable=True, index=True),
        sa.Column('invoice_number', sa.String(50), nullable=False, unique=True, index=True),
        sa.Column('status', sa.Enum('draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'cancelled', name='invoicestatus'), default='draft'),
        sa.Column('issue_date', sa.Date(), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('paid_date', sa.Date(), nullable=True),
        sa.Column('subtotal', sa.Numeric(12, 2), default=0),
        sa.Column('tax_amount', sa.Numeric(12, 2), default=0),
        sa.Column('discount_amount', sa.Numeric(12, 2), default=0),
        sa.Column('total', sa.Numeric(12, 2), default=0),
        sa.Column('amount_paid', sa.Numeric(12, 2), default=0),
        sa.Column('billing_address', postgresql.JSONB(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('terms', sa.Text(), nullable=True),
        sa.Column('footer', sa.Text(), nullable=True),
        sa.Column('pdf_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # Create invoice_items table
    op.create_table(
        'invoice_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('invoice_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('invoices.id'), nullable=False, index=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id'), nullable=True),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('quantity', sa.Numeric(10, 2), default=1),
        sa.Column('unit_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('tax_rate', sa.Numeric(5, 2), default=0),
        sa.Column('tax_amount', sa.Numeric(12, 2), default=0),
        sa.Column('discount_percent', sa.Numeric(5, 2), default=0),
        sa.Column('discount_amount', sa.Numeric(12, 2), default=0),
        sa.Column('total', sa.Numeric(12, 2), default=0),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # Create inventory_items table
    op.create_table(
        'inventory_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id'), nullable=False, index=True),
        sa.Column('quantity_on_hand', sa.Integer(), default=0),
        sa.Column('quantity_reserved', sa.Integer(), default=0),
        sa.Column('quantity_incoming', sa.Integer(), default=0),
        sa.Column('reorder_point', sa.Integer(), default=10),
        sa.Column('reorder_quantity', sa.Integer(), default=50),
        sa.Column('location', sa.String(100), nullable=True),
        sa.Column('bin_location', sa.String(50), nullable=True),
        sa.Column('average_cost', sa.Numeric(12, 2), default=0),
        sa.Column('last_cost', sa.Numeric(12, 2), default=0),
        sa.Column('last_counted_at', sa.DateTime(), nullable=True),
        sa.Column('last_received_at', sa.DateTime(), nullable=True),
        sa.Column('last_sold_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # Create inventory_transactions table
    op.create_table(
        'inventory_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id'), nullable=False, index=True),
        sa.Column('inventory_item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inventory_items.id'), nullable=True, index=True),
        sa.Column('transaction_type', sa.Enum('adjustment', 'purchase', 'sale', 'transfer', 'return', 'write_off', 'count', name='transactiontype'), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_cost', sa.Numeric(12, 2), nullable=True),
        sa.Column('reference_type', sa.String(50), nullable=True),
        sa.Column('reference_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('performed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('performed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('inventory_transactions')
    op.drop_table('inventory_items')
    op.drop_table('invoice_items')
    op.drop_table('invoices')
    op.drop_table('order_items')
    op.drop_table('orders')
    op.drop_table('customers')
    op.drop_table('products')
    op.drop_table('product_categories')
    
    # Drop enums
    sa.Enum(name='transactiontype').drop(op.get_bind())
    sa.Enum(name='invoicestatus').drop(op.get_bind())
    sa.Enum(name='paymentstatus').drop(op.get_bind())
    sa.Enum(name='orderstatus').drop(op.get_bind())
    sa.Enum(name='customertype').drop(op.get_bind())
    sa.Enum(name='productstatus').drop(op.get_bind())
