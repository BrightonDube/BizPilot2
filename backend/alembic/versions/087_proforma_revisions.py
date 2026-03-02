"""Create proforma_invoice_revisions table for quote versioning.

Revision ID: 087_proforma_revisions
Revises: 086_tags
Create Date: 2025-01-01 00:00:00.000000

Why a dedicated revisions table?
Once a quote is sent, changes should create a new revision rather than
modifying the original.  This preserves the audit trail showing what
the customer originally saw vs what was subsequently changed, which
is critical for dispute resolution and compliance.
"""

revision = "087_proforma_revisions"
down_revision = "086_tags"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


def upgrade() -> None:
    op.create_table(
        "proforma_invoice_revisions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "proforma_id",
            UUID(as_uuid=True),
            sa.ForeignKey("proforma_invoices.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("revision_number", sa.Integer, nullable=False),
        sa.Column(
            "created_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("change_summary", sa.Text, nullable=True),
        sa.Column(
            "snapshot",
            JSONB,
            nullable=False,
            comment="Full JSON snapshot of proforma + items at this revision",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "proforma_id",
            "revision_number",
            name="uq_proforma_revisions_proforma_number",
        ),
    )


def downgrade() -> None:
    op.drop_table("proforma_invoice_revisions")
