"""Drop payments table and related enums

This migration removes the payments table as the payment system is being
redesigned. Instead of a separate payments table, payment status is now
tracked directly on invoices using the amount_paid field.

Revision ID: 013_drop_payments_table
Revises: 012_add_paid_partial_to_paymentstatus
Create Date: 2026-01-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '013_drop_payments_table'
down_revision: Union[str, None] = '012_add_paid_partial_to_paymentstatus'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the payments table
    op.drop_table('payments')
    
    # Drop the payment-related enums
    # Use raw SQL to drop enums since SQLAlchemy doesn't always handle this well
    op.execute("DROP TYPE IF EXISTS paymentstatus CASCADE")
    op.execute("DROP TYPE IF EXISTS paymentmethod CASCADE")


def downgrade() -> None:
    # Recreate enums
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
