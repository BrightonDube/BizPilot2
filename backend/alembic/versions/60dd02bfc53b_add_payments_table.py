"""add_payments_table

Revision ID: 60dd02bfc53b
Revises: 8f1e3ca8b3e8
Create Date: 2025-12-17 01:26:59.397114

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '60dd02bfc53b'
down_revision: Union[str, None] = '8f1e3ca8b3e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types if they don't exist
    from sqlalchemy import text
    conn = op.get_bind()
    
    # Check and create paymentmethod enum
    result = conn.execute(text("SELECT 1 FROM pg_type WHERE typname = 'paymentmethod'"))
    if not result.fetchone():
        op.execute("CREATE TYPE paymentmethod AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'EFT', 'MOBILE', 'CHECK', 'PAYFAST', 'YOCO', 'SNAPSCAN', 'OTHER')")
    
    # Check and create paymentstatus enum
    result = conn.execute(text("SELECT 1 FROM pg_type WHERE typname = 'paymentstatus'"))
    if not result.fetchone():
        op.execute("CREATE TYPE paymentstatus AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED')")
    
    # Create payments table
    op.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            business_id UUID NOT NULL REFERENCES businesses(id),
            invoice_id UUID REFERENCES invoices(id),
            customer_id UUID REFERENCES customers(id),
            payment_number VARCHAR(50) NOT NULL UNIQUE,
            amount NUMERIC(12, 2) NOT NULL,
            payment_method paymentmethod,
            status paymentstatus,
            payment_date DATE,
            reference VARCHAR(100),
            transaction_id VARCHAR(100),
            notes TEXT,
            id UUID PRIMARY KEY,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE
        )
    """)
    
    # Create indexes
    op.execute("CREATE INDEX IF NOT EXISTS ix_payments_business_id ON payments (business_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_payments_customer_id ON payments (customer_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_payments_invoice_id ON payments (invoice_id)")


def downgrade() -> None:
    op.drop_index(op.f('ix_payments_payment_number'), table_name='payments')
    op.drop_index(op.f('ix_payments_invoice_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_customer_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_business_id'), table_name='payments')
    op.drop_table('payments')
    # Drop enums
    op.execute("DROP TYPE IF EXISTS paymentmethod")
    op.execute("DROP TYPE IF EXISTS paymentstatus")
