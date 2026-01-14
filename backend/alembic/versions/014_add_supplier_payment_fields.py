"""Add supplier payment fields to invoices

This migration adds fields to support paying supplier invoices via Paystack:
- supplier_id: Link invoice to a supplier
- invoice_type: Distinguish between customer (receivable) and supplier (payable) invoices
- paystack_reference: Track Paystack transaction reference
- paystack_access_code: Store Paystack access code for the payment
- gateway_fee: Store the gateway transaction fee
- gateway_fee_percent: Store the gateway fee percentage

Revision ID: 014_add_supplier_payment_fields
Revises: 013_drop_payments_table
Create Date: 2026-01-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '014_add_supplier_payment_fields'
down_revision: Union[str, None] = '013_drop_payments_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create invoice type enum
    op.execute(
        """
        DO $$
        BEGIN
            CREATE TYPE invoicetype AS ENUM ('customer', 'supplier');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )
    
    # Add supplier_id column
    op.add_column('invoices', sa.Column(
        'supplier_id',
        postgresql.UUID(as_uuid=True),
        sa.ForeignKey('suppliers.id'),
        nullable=True,
        index=True
    ))
    
    # Add invoice_type column with default
    op.add_column('invoices', sa.Column(
        'invoice_type',
        postgresql.ENUM('customer', 'supplier', name='invoicetype', create_type=False),
        nullable=True,
        server_default='customer'
    ))
    
    # Add Paystack payment tracking columns
    op.add_column('invoices', sa.Column('paystack_reference', sa.String(100), nullable=True))
    op.add_column('invoices', sa.Column('paystack_access_code', sa.String(100), nullable=True))
    op.add_column('invoices', sa.Column('gateway_fee', sa.Numeric(12, 2), nullable=True, server_default='0'))
    op.add_column('invoices', sa.Column('gateway_fee_percent', sa.Numeric(5, 2), nullable=True, server_default='1.5'))
    
    # Create index on supplier_id
    op.create_index('ix_invoices_supplier_id', 'invoices', ['supplier_id'])
    
    # Create index on paystack_reference
    op.create_index('ix_invoices_paystack_reference', 'invoices', ['paystack_reference'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_invoices_paystack_reference', table_name='invoices')
    op.drop_index('ix_invoices_supplier_id', table_name='invoices')
    
    # Drop columns
    op.drop_column('invoices', 'gateway_fee_percent')
    op.drop_column('invoices', 'gateway_fee')
    op.drop_column('invoices', 'paystack_access_code')
    op.drop_column('invoices', 'paystack_reference')
    op.drop_column('invoices', 'invoice_type')
    op.drop_column('invoices', 'supplier_id')
    
    # Drop enum
    op.execute("DROP TYPE IF EXISTS invoicetype CASCADE")
