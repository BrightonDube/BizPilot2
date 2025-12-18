"""Add payments table

Revision ID: 002_add_payments
Revises: 001_initial_schema
Create Date: 2024-12-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002_add_payments'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            CREATE TYPE paymentstatus AS ENUM ('pending', 'completed', 'failed', 'refunded', 'cancelled');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            CREATE TYPE paymentmethod AS ENUM ('cash', 'card', 'bank_transfer', 'mobile', 'check', 'other');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )

    # Create payments table
    op.create_table(
        'payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('invoice_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('invoices.id'), nullable=True, index=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id'), nullable=True, index=True),
        sa.Column('payment_number', sa.String(50), unique=True, nullable=False, index=True),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('payment_method', sa.Enum('cash', 'card', 'bank_transfer', 'mobile', 'check', 'other', name='paymentmethod', create_type=False), default='cash'),
        sa.Column('status', sa.Enum('pending', 'completed', 'failed', 'refunded', 'cancelled', name='paymentstatus', create_type=False), default='pending'),
        sa.Column('payment_date', sa.Date(), nullable=True),
        sa.Column('reference', sa.String(100), nullable=True),
        sa.Column('transaction_id', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('payments')
    
    # Drop enums
    sa.Enum(name='paymentstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='paymentmethod').drop(op.get_bind(), checkfirst=True)
