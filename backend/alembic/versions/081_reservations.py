"""Create reservations table for table booking management.

Revision ID: 081_reservations
Revises: 080_sections
Create Date: 2025-01-01 00:00:00.000000

Why a dedicated reservations table?
Walk-in occupancy is tracked via table status (OCCUPIED/AVAILABLE), but
reservations need future date-time scheduling, party size matching,
guest contact info, and status tracking (confirmed/cancelled/no-show).
A separate table allows querying upcoming reservations without scanning
all order/table records.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "081_reservations"
down_revision = "080_sections"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "reservations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("table_id", UUID(as_uuid=True), sa.ForeignKey("restaurant_tables.id"), nullable=True),
        sa.Column("guest_name", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("party_size", sa.Integer, nullable=False),
        sa.Column("date_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration", sa.Integer, nullable=False, server_default="90"),  # minutes
        sa.Column("status", sa.String(20), nullable=False, server_default="confirmed"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("customers.id"), nullable=True),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_reservations_business_id", "reservations", ["business_id"])
    op.create_index("ix_reservations_date_time", "reservations", ["date_time"])
    op.create_index("ix_reservations_table_id", "reservations", ["table_id"])
    op.create_index("ix_reservations_status", "reservations", ["status"])

def downgrade() -> None:
    op.drop_index("ix_reservations_status")
    op.drop_index("ix_reservations_table_id")
    op.drop_index("ix_reservations_date_time")
    op.drop_index("ix_reservations_business_id")
    op.drop_table("reservations")
