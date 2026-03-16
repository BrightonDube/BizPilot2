"""add_waiter_cashups

Revision ID: ecad824d00b3
Revises: 4c77b07b9fef
Create Date: 2026-03-13 13:30:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'ecad824d00b3'
down_revision: Union[str, None] = '4c77b07b9fef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        "waiter_cashups",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("shift_id", UUID(as_uuid=True), sa.ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("waiter_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("total_sales", sa.Numeric(15, 2), nullable=False),
        sa.Column("total_tips", sa.Numeric(15, 2), server_default="0.00", nullable=False),
        sa.Column("cash_collected", sa.Numeric(15, 2), server_default="0.00", nullable=False),
        sa.Column("card_collected", sa.Numeric(15, 2), server_default="0.00", nullable=False),
        sa.Column("cover_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("tables_served", sa.Integer(), server_default="0", nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("approved_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_waiter_cashups_business_id", "waiter_cashups", ["business_id"])
    op.create_index("ix_waiter_cashups_shift_id", "waiter_cashups", ["shift_id"], unique=True)
    op.create_index("ix_waiter_cashups_waiter_id", "waiter_cashups", ["waiter_id"])

def downgrade() -> None:
    op.drop_index("ix_waiter_cashups_waiter_id")
    op.drop_index("ix_waiter_cashups_shift_id")
    op.drop_index("ix_waiter_cashups_business_id")
    op.drop_table("waiter_cashups")
