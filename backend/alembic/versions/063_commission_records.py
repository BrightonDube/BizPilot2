"""Add commission_records table

Revision ID: 063_commission_records
Revises: 062_cash_registers
Create Date: 2026-03-01 09:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "063_commission_records"
down_revision: Union[str, None] = "062_cash_registers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    commissionstatus = sa.Enum(
        "pending", "approved", "rejected", "paid",
        name="commissionstatus",
    )
    commissionstatus.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "commission_records",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("order_count", sa.Numeric(12, 0), server_default="0"),
        sa.Column("total_sales", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total_discounts", sa.Numeric(12, 2), server_default="0"),
        sa.Column("commission_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("commission_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", commissionstatus, nullable=False, server_default="pending"),
        sa.Column("approved_by", sa.UUID(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_commission_records_business_id", "commission_records", ["business_id"])
    op.create_index("ix_commission_records_user_id", "commission_records", ["user_id"])
    op.create_index("ix_commission_records_status", "commission_records", ["status"])


def downgrade() -> None:
    op.drop_index("ix_commission_records_status", table_name="commission_records")
    op.drop_index("ix_commission_records_user_id", table_name="commission_records")
    op.drop_index("ix_commission_records_business_id", table_name="commission_records")
    op.drop_table("commission_records")
    sa.Enum(name="commissionstatus").drop(op.get_bind(), checkfirst=True)
