"""Add proforma invoices tables

Revision ID: 066_proforma_invoices
Revises: 065_customer_privacy
Create Date: 2026-03-01 23:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from typing import Sequence, Union

revision: str = "066_proforma_invoices"
down_revision: Union[str, None] = "065_customer_privacy"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        "proforma_invoices",
        sa.Column("id", UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("business_id", UUID(), nullable=False),
        sa.Column("customer_id", UUID(), nullable=True),
        sa.Column("quote_number", sa.String(50), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("issue_date", sa.Date(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("validity_days", sa.Integer(), server_default="30"),
        sa.Column("subtotal", sa.Numeric(12, 2), server_default="0"),
        sa.Column("tax_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("discount_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total", sa.Numeric(12, 2), server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("terms", sa.Text(), nullable=True),
        sa.Column("converted_invoice_id", UUID(), nullable=True),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["converted_invoice_id"], ["invoices.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_proforma_invoices_business_id", "proforma_invoices", ["business_id"])
    op.create_index("ix_proforma_invoices_customer_id", "proforma_invoices", ["customer_id"])
    op.create_index("ix_proforma_invoices_quote_number", "proforma_invoices", ["quote_number"])

    op.create_table(
        "proforma_items",
        sa.Column("id", UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("proforma_id", UUID(), nullable=False),
        sa.Column("product_id", UUID(), nullable=True),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 4), server_default="1"),
        sa.Column("unit_price", sa.Numeric(12, 2), server_default="0"),
        sa.Column("discount_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("tax_rate", sa.Numeric(5, 2), server_default="15"),
        sa.Column("line_total", sa.Numeric(12, 2), server_default="0"),
        sa.ForeignKeyConstraint(["proforma_id"], ["proforma_invoices.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_proforma_items_proforma_id", "proforma_items", ["proforma_id"])

def downgrade() -> None:
    op.drop_index("ix_proforma_items_proforma_id", table_name="proforma_items")
    op.drop_table("proforma_items")
    op.drop_index("ix_proforma_invoices_quote_number", table_name="proforma_invoices")
    op.drop_index("ix_proforma_invoices_customer_id", table_name="proforma_invoices")
    op.drop_index("ix_proforma_invoices_business_id", table_name="proforma_invoices")
    op.drop_table("proforma_invoices")
