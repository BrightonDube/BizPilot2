"""proforma approval audit

Revision ID: 102_pf_approval_audit
Revises: 101_bts_timezone
Create Date: 2026-03-08
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "102_pf_approval_audit"
down_revision = "101_bts_timezone"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add approval/audit tables and new columns to proforma_invoices."""

    # ── New columns on proforma_invoices ──────────────────────────────
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = {c["name"] for c in inspector.get_columns("proforma_invoices")}

    new_cols = {
        "created_by": sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        "discount_pct": sa.Column("discount_pct", sa.Numeric(5, 2), server_default="0"),
        "approval_token": sa.Column("approval_token", sa.String(64), nullable=True),
        "approved_at": sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        "approved_by_name": sa.Column("approved_by_name", sa.String(255), nullable=True),
        "rejection_reason": sa.Column("rejection_reason", sa.Text(), nullable=True),
        "rejected_at": sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        "viewed_at": sa.Column("viewed_at", sa.DateTime(timezone=True), nullable=True),
        "cancellation_reason": sa.Column("cancellation_reason", sa.Text(), nullable=True),
        "cancelled_at": sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        "converted_at": sa.Column("converted_at", sa.DateTime(timezone=True), nullable=True),
    }

    for col_name, col_def in new_cols.items():
        if col_name not in existing_cols:
            op.add_column("proforma_invoices", col_def)

    # Add unique index on approval_token if not exists
    try:
        op.create_index(
            "ix_proforma_invoices_approval_token",
            "proforma_invoices",
            ["approval_token"],
            unique=True,
            postgresql_where=sa.text("approval_token IS NOT NULL"),
        )
    except Exception:
        pass  # Index may already exist

    # Foreign key for created_by (idempotent)
    try:
        op.create_foreign_key(
            "fk_proforma_invoices_created_by",
            "proforma_invoices",
            "users",
            ["created_by"],
            ["id"],
        )
    except Exception:
        pass

    # ── is_converted on proforma_items ────────────────────────────────
    item_cols = {c["name"] for c in inspector.get_columns("proforma_items")}
    if "is_converted" not in item_cols:
        op.add_column(
            "proforma_items",
            sa.Column("is_converted", sa.Boolean(), server_default="false"),
        )

    # ── proforma_invoice_approvals table ──────────────────────────────
    if "proforma_invoice_approvals" not in inspector.get_table_names():
        op.create_table(
            "proforma_invoice_approvals",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("proforma_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("proforma_invoices.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("action", sa.String(20), nullable=False),
            sa.Column("customer_name", sa.String(255), nullable=True),
            sa.Column("customer_email", sa.String(255), nullable=True),
            sa.Column("ip_address", sa.String(45), nullable=True),
            sa.Column("user_agent", sa.Text(), nullable=True),
            sa.Column("signature_data", sa.Text(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )

    # ── proforma_invoice_audits table ─────────────────────────────────
    if "proforma_invoice_audits" not in inspector.get_table_names():
        op.create_table(
            "proforma_invoice_audits",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("proforma_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("proforma_invoices.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("action", sa.String(50), nullable=False),
            sa.Column("performed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("old_value", postgresql.JSONB(), nullable=True),
            sa.Column("new_value", postgresql.JSONB(), nullable=True),
            sa.Column("details", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    """Remove approval/audit tables and columns."""
    op.drop_table("proforma_invoice_audits")
    op.drop_table("proforma_invoice_approvals")

    op.drop_column("proforma_items", "is_converted")

    for col in [
        "converted_at", "cancelled_at", "cancellation_reason",
        "viewed_at", "rejected_at", "rejection_reason",
        "approved_by_name", "approved_at", "approval_token",
        "discount_pct", "created_by",
    ]:
        op.drop_column("proforma_invoices", col)
