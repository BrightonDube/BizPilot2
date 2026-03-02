"""Create gl_account_mappings table for automatic journal entry generation.

Revision ID: 076_gl_account_mappings
Revises: 075_expense_approvals
Create Date: 2025-01-01 00:00:00.000000

Why a mappings table?
Auto-journaling maps business events (e.g. a sale, a purchase) to the correct
debit/credit accounts.  Instead of hard-coding account IDs in the service layer,
this table lets each business configure which GL accounts correspond to each
event type (mapping_type).  source_id optionally narrows the mapping to a
specific entity such as a product category or payment method.
"""

revision = "076_gl_account_mappings"
down_revision = "075_expense_approvals"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


def upgrade() -> None:
    op.create_table(
        "gl_account_mappings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mapping_type", sa.String(50), nullable=False),
        sa.Column("source_id", sa.String(100), nullable=True),
        sa.Column("debit_account_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id"), nullable=True),
        sa.Column("credit_account_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_index("ix_gl_account_mappings_business_id", "gl_account_mappings", ["business_id"])
    op.create_index(
        "ix_gl_account_mappings_type_source",
        "gl_account_mappings",
        ["business_id", "mapping_type", "source_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_gl_account_mappings_type_source")
    op.drop_index("ix_gl_account_mappings_business_id")
    op.drop_table("gl_account_mappings")
