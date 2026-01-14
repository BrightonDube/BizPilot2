"""Drop payments table and add Paystack payment fields to invoices

Revision ID: 013_drop_payments_add_invoice_paystack
Revises: e7c1f3a2b9d0
Create Date: 2026-01-14

This migration:
1. Drops the payments table (no longer needed)
2. Adds Paystack payment tracking fields to invoices
   - payment_reference: Paystack transaction reference
   - payment_gateway_fees: Gateway fees charged on top of invoice
   - gateway_status: Status of the gateway transaction
   - supplier_id: For supplier invoices that can be paid via Paystack
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "013_drop_payments_add_invoice_paystack"
down_revision: Union[str, None] = "e7c1f3a2b9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # Drop payments table if it exists
    existing_tables = inspector.get_table_names()
    if "payments" in existing_tables:
        op.drop_table("payments")
    
    # Drop payment enums if they exist (from previous migrations)
    # Using raw SQL for PostgreSQL enum dropping with CASCADE
    op.execute("""
        DROP TYPE IF EXISTS paymentstatus CASCADE;
        DROP TYPE IF EXISTS paymentmethod CASCADE;
    """)
    
    # Add Paystack payment fields to invoices table
    columns = {c["name"] for c in inspector.get_columns("invoices")}
    
    if "payment_reference" not in columns:
        op.add_column(
            "invoices",
            sa.Column("payment_reference", sa.String(100), nullable=True),
        )
    
    if "payment_gateway_fees" not in columns:
        op.add_column(
            "invoices",
            sa.Column("payment_gateway_fees", sa.Numeric(12, 2), nullable=True, server_default=sa.text("0")),
        )
    
    if "gateway_status" not in columns:
        op.add_column(
            "invoices",
            sa.Column("gateway_status", sa.String(50), nullable=True),
        )
    
    if "supplier_id" not in columns:
        op.add_column(
            "invoices",
            sa.Column(
                "supplier_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("suppliers.id"),
                nullable=True,
                index=True,
            ),
        )
    
    # Create index on payment_reference for quick lookups
    op.create_index(
        "ix_invoices_payment_reference",
        "invoices",
        ["payment_reference"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # Drop index
    op.drop_index("ix_invoices_payment_reference", table_name="invoices")
    
    # Remove new columns from invoices
    columns = {c["name"] for c in inspector.get_columns("invoices")}
    
    if "supplier_id" in columns:
        op.drop_column("invoices", "supplier_id")
    if "gateway_status" in columns:
        op.drop_column("invoices", "gateway_status")
    if "payment_gateway_fees" in columns:
        op.drop_column("invoices", "payment_gateway_fees")
    if "payment_reference" in columns:
        op.drop_column("invoices", "payment_reference")
    
    # Recreate payment enums
    op.execute(
        """
        DO $$
        BEGIN
            CREATE TYPE paymentstatus AS ENUM ('pending', 'completed', 'paid', 'partial', 'failed', 'refunded', 'cancelled');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )
    
    op.execute(
        """
        DO $$
        BEGIN
            CREATE TYPE paymentmethod AS ENUM ('cash', 'card', 'bank_transfer', 'eft', 'mobile', 'check', 'payfast', 'yoco', 'snapscan', 'other');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )
    
    # Recreate payments table
    op.create_table(
        'payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('invoice_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('invoices.id'), nullable=True, index=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id'), nullable=True, index=True),
        sa.Column('payment_number', sa.String(50), unique=True, nullable=False, index=True),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('payment_method', postgresql.ENUM('cash', 'card', 'bank_transfer', 'eft', 'mobile', 'check', 'payfast', 'yoco', 'snapscan', 'other', name='paymentmethod', create_type=False), default='cash'),
        sa.Column('status', postgresql.ENUM('pending', 'completed', 'paid', 'partial', 'failed', 'refunded', 'cancelled', name='paymentstatus', create_type=False), default='pending'),
        sa.Column('payment_date', sa.Date(), nullable=True),
        sa.Column('reference', sa.String(100), nullable=True),
        sa.Column('transaction_id', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
    )
