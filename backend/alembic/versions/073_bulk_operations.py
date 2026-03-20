"""Add bulk operations, items, templates tables.

Provides the persistence layer for tracked bulk operations (price updates,
stock adjustments, imports, category/supplier changes).  Each operation
consists of a header row (bulk_operations) with per-record detail rows
(bulk_operation_items).  Reusable import/export templates are stored in
bulk_templates.

Revision ID: 073_bulk_operations
Revises: 072_reorder_grn_audit
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# --- Alembic revision metadata ---------------------------------------------------
revision = "073_bulk_operations"
down_revision = "072_reorder_grn_audit"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # ── bulk_operations ──────────────────────────────────────────────────
    op.create_table(
        "bulk_operations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "operation_type",
            sa.String(50),
            nullable=False,
            comment="PRICE_UPDATE | STOCK_ADJUSTMENT | IMPORT | EXPORT | CATEGORY_ASSIGN | SUPPLIER_ASSIGN | ACTIVATE | DELETE",
        ),
        sa.Column(
            "status",
            sa.String(30),
            nullable=False,
            server_default="pending",
            comment="pending | validating | processing | completed | failed | cancelled | rolling_back",
        ),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("total_records", sa.Integer, nullable=False, server_default="0"),
        sa.Column("processed_records", sa.Integer, nullable=False, server_default="0"),
        sa.Column("successful_records", sa.Integer, nullable=False, server_default="0"),
        sa.Column("failed_records", sa.Integer, nullable=False, server_default="0"),
        sa.Column("parameters", JSONB, nullable=True, comment="Operation-specific parameters"),
        sa.Column("error_summary", sa.Text, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_bulk_operations_business_id", "bulk_operations", ["business_id"])
    op.create_index("ix_bulk_operations_user_id", "bulk_operations", ["user_id"])
    op.create_index("ix_bulk_operations_status", "bulk_operations", ["status"])
    op.create_index("ix_bulk_operations_operation_type", "bulk_operations", ["operation_type"])

    # ── bulk_operation_items ─────────────────────────────────────────────
    op.create_table(
        "bulk_operation_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "bulk_operation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("bulk_operations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("record_id", UUID(as_uuid=True), nullable=True, comment="FK to the affected entity (product, inventory, etc.)"),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
            comment="pending | processing | success | failed | skipped",
        ),
        sa.Column("before_data", JSONB, nullable=True, comment="Snapshot of original values"),
        sa.Column("after_data", JSONB, nullable=True, comment="Snapshot of new values"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_bulk_operation_items_operation_id", "bulk_operation_items", ["bulk_operation_id"])
    op.create_index("ix_bulk_operation_items_record_id", "bulk_operation_items", ["record_id"])
    op.create_index("ix_bulk_operation_items_status", "bulk_operation_items", ["status"])

    # ── bulk_templates ───────────────────────────────────────────────────
    op.create_table(
        "bulk_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "operation_type",
            sa.String(50),
            nullable=False,
            comment="Same enum values as bulk_operations.operation_type",
        ),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("template_data", JSONB, nullable=False, comment="Field mappings, validation rules, defaults"),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=True, comment="NULL for system templates"),
        sa.Column("is_system_template", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_bulk_templates_business_id", "bulk_templates", ["business_id"])
    op.create_index("ix_bulk_templates_operation_type", "bulk_templates", ["operation_type"])

def downgrade() -> None:
    op.drop_table("bulk_templates")
    op.drop_table("bulk_operation_items")
    op.drop_table("bulk_operations")
