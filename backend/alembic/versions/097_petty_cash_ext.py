"""Add petty cash disbursements, receipts, and reconciliation tables.

Revision ID: 097_petty_cash_ext
Revises: 096_loyalty_and_location_ext
Create Date: 2025-01-01 00:00:00.000000

Why these tables?
The base petty cash module handles funds, categories, expenses, and approvals.
These extensions add:
- Disbursements: track cash handovers from fund to requester
- Receipts: capture receipt images and OCR data for expense verification
- Reconciliations: periodic balance checks against actual cash on hand
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "097_petty_cash_ext"
down_revision = "096_loyalty_and_location_ext"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Cash disbursements — track actual cash handover events
    # ------------------------------------------------------------------
    op.create_table(
        "cash_disbursements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("fund_id", UUID(as_uuid=True), sa.ForeignKey("petty_cash_funds.id"), nullable=False),
        sa.Column("expense_id", UUID(as_uuid=True), sa.ForeignKey("petty_cash_expenses.id"), nullable=True),
        sa.Column("disbursement_number", sa.String(50), unique=True, nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("recipient_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("disbursed_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("disbursed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_cash_disbursements_fund_id", "cash_disbursements", ["fund_id"])
    op.create_index("ix_cash_disbursements_status", "cash_disbursements", ["status"])

    # ------------------------------------------------------------------
    # Expense receipts — capture receipt images and OCR for verification
    # ------------------------------------------------------------------
    op.create_table(
        "expense_receipts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("expense_id", UUID(as_uuid=True), sa.ForeignKey("petty_cash_expenses.id"), nullable=False),
        sa.Column("disbursement_id", UUID(as_uuid=True), sa.ForeignKey("cash_disbursements.id"), nullable=True),
        sa.Column("receipt_number", sa.String(100), nullable=True),
        sa.Column("vendor_name", sa.String(255), nullable=True),
        sa.Column("receipt_date", sa.Date, nullable=True),
        sa.Column("receipt_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("tax_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("image_url", sa.Text, nullable=True),
        sa.Column("image_filename", sa.String(255), nullable=True),
        sa.Column("ocr_data", JSONB, nullable=True),
        sa.Column("is_validated", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("validation_notes", sa.Text, nullable=True),
        sa.Column("validated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("change_returned", sa.Numeric(12, 2), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_expense_receipts_expense_id", "expense_receipts", ["expense_id"])

    # ------------------------------------------------------------------
    # Fund reconciliations — periodic balance verification
    # ------------------------------------------------------------------
    op.create_table(
        "fund_reconciliations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("fund_id", UUID(as_uuid=True), sa.ForeignKey("petty_cash_funds.id"), nullable=False),
        sa.Column("reconciliation_number", sa.String(50), unique=True, nullable=False),
        sa.Column("reconciliation_date", sa.Date, nullable=False),
        sa.Column("expected_balance", sa.Numeric(12, 2), nullable=False),
        sa.Column("actual_balance", sa.Numeric(12, 2), nullable=False),
        sa.Column("variance", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("variance_reason", sa.Text, nullable=True),
        sa.Column("variance_approved_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("variance_approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("performed_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_fund_reconciliations_fund_id", "fund_reconciliations", ["fund_id"])
    op.create_index("ix_fund_reconciliations_date", "fund_reconciliations", ["reconciliation_date"])


def downgrade() -> None:
    op.drop_table("fund_reconciliations")
    op.drop_table("expense_receipts")
    op.drop_table("cash_disbursements")
