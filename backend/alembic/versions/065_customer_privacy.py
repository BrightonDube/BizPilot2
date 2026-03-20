"""Add privacy compliance fields to customers

Revision ID: 065_customer_privacy
Revises: 064_report_templates
Create Date: 2026-03-01 22:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

from typing import Sequence, Union

revision: str = "065_customer_privacy"
down_revision: Union[str, None] = "064_report_templates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column("customers", sa.Column("marketing_consent", sa.Boolean(), server_default="false"))
    op.add_column("customers", sa.Column("data_processing_consent", sa.Boolean(), server_default="true"))
    op.add_column("customers", sa.Column("consent_updated_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "customer_data_access_logs",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("accessed_by", sa.UUID(), nullable=False),
        sa.Column("access_type", sa.String(50), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["accessed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_customer_data_access_logs_customer_id", "customer_data_access_logs", ["customer_id"])
    op.create_index("ix_customer_data_access_logs_business_id", "customer_data_access_logs", ["business_id"])

def downgrade() -> None:
    op.drop_index("ix_customer_data_access_logs_business_id", table_name="customer_data_access_logs")
    op.drop_index("ix_customer_data_access_logs_customer_id", table_name="customer_data_access_logs")
    op.drop_table("customer_data_access_logs")
    op.drop_column("customers", "consent_updated_at")
    op.drop_column("customers", "data_processing_consent")
    op.drop_column("customers", "marketing_consent")
