"""Extend general ledger with balances cache, recurring entries, and audit log.

Revision ID: 093_gl_extensions
Revises: 092_integrations
Create Date: 2025-01-01 00:00:00.000000

Why these three tables?
- gl_account_balances: Pre-aggregated period balances so trial balance and
  financial statements don't scan the entire journal_entries table.
- gl_recurring_entries: Template-based repeating entries (rent, depreciation)
  that the scheduler can materialise on the next_date.
- gl_audit_log: Immutable compliance trail for every GL mutation, separate
  from the app-wide audit_logs table to satisfy accounting regulations.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers
revision = "093_gl_extensions"
down_revision = "092_integrations"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # -- gl_account_balances: period-level balance cache ----------------
    op.create_table(
        "gl_account_balances",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id"), nullable=False),
        sa.Column("period_year", sa.Integer, nullable=False),
        sa.Column("period_month", sa.Integer, nullable=False),
        sa.Column("opening_balance", sa.Numeric(14, 2), server_default="0"),
        sa.Column("debit_total", sa.Numeric(14, 2), server_default="0"),
        sa.Column("credit_total", sa.Numeric(14, 2), server_default="0"),
        sa.Column("closing_balance", sa.Numeric(14, 2), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # Unique per account per period — prevents duplicate balance rows.
    op.create_unique_constraint(
        "uq_gl_account_balances_account_period",
        "gl_account_balances",
        ["account_id", "period_year", "period_month"],
    )
    op.create_index("ix_gl_balances_business", "gl_account_balances", ["business_id"])

    # -- gl_recurring_entries: template-based repeating journal entries --
    op.create_table(
        "gl_recurring_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("frequency", sa.String(20), nullable=False),  # daily|weekly|monthly|quarterly|yearly
        sa.Column("next_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=True),
        sa.Column("template", JSONB, nullable=False),  # {lines: [{account_id, debit, credit, memo}]}
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("last_generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_gl_recurring_business", "gl_recurring_entries", ["business_id"])
    op.create_index("ix_gl_recurring_next_date", "gl_recurring_entries", ["next_date"])

    # -- gl_audit_log: immutable compliance trail for GL mutations -------
    op.create_table(
        "gl_audit_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),  # e.g. journal_entry, account, mapping
        sa.Column("entity_id", UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),  # create|update|delete|post|reverse
        sa.Column("old_value", JSONB, nullable=True),
        sa.Column("new_value", JSONB, nullable=True),
        sa.Column("performed_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_gl_audit_business", "gl_audit_log", ["business_id"])
    op.create_index("ix_gl_audit_entity", "gl_audit_log", ["entity_type", "entity_id"])

def downgrade() -> None:
    op.drop_table("gl_audit_log")
    op.drop_table("gl_recurring_entries")
    op.drop_table("gl_account_balances")
