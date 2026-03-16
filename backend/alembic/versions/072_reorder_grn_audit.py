"""Create product_reorder_settings, goods_received_notes, grn_items, reorder_audit_log tables.

Revision ID: 072_reorder_grn_audit
Revises: 071_nested_modifiers
Create Date: 2025-01-01

These four tables fill the gaps identified in the automated-reordering
design spec.  product_reorder_settings stores per-product reorder
configuration.  goods_received_notes / grn_items implement a formal
goods receiving workflow separate from the purchase request.
reorder_audit_log captures a full history of automated and manual
reorder actions for compliance and debugging.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "072_reorder_grn_audit"
down_revision = "071_nested_modifiers"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # ------------------------------------------------------------------
    # product_reorder_settings — per-product reorder configuration
    # ------------------------------------------------------------------
    op.create_table(
        "product_reorder_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "business_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reorder_point", sa.Integer, nullable=False, server_default="0"),
        sa.Column("safety_stock", sa.Integer, nullable=False, server_default="0"),
        sa.Column("par_level", sa.Integer, nullable=True),
        sa.Column("eoq", sa.Integer, nullable=True),
        sa.Column("auto_reorder", sa.Boolean, server_default="false"),
        sa.Column(
            "preferred_supplier_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("suppliers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("product_id", "business_id", name="uq_reorder_product_business"),
    )

    op.create_index("idx_reorder_settings_product", "product_reorder_settings", ["product_id"])
    op.create_index("idx_reorder_settings_business", "product_reorder_settings", ["business_id"])

    # ------------------------------------------------------------------
    # goods_received_notes — formal GRN documents
    # ------------------------------------------------------------------
    op.create_table(
        "goods_received_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "purchase_order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("purchase_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "business_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("grn_number", sa.String(50), nullable=False, unique=True),
        sa.Column(
            "received_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("idx_grn_po", "goods_received_notes", ["purchase_order_id"])
    op.create_index("idx_grn_business", "goods_received_notes", ["business_id"])

    # ------------------------------------------------------------------
    # grn_items — line items within a GRN
    # ------------------------------------------------------------------
    op.create_table(
        "grn_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "grn_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("goods_received_notes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "po_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("purchase_request_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quantity_received", sa.Integer, nullable=False),
        sa.Column("variance", sa.Integer, server_default="0"),
        sa.Column("variance_reason", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("idx_grn_items_grn", "grn_items", ["grn_id"])
    op.create_index("idx_grn_items_po_item", "grn_items", ["po_item_id"])

    # ------------------------------------------------------------------
    # reorder_audit_log — immutable audit trail
    # ------------------------------------------------------------------
    op.create_table(
        "reorder_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("details", postgresql.JSONB, nullable=True),
        sa.Column(
            "performed_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("is_automated", sa.Boolean, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    op.create_index("idx_audit_business", "reorder_audit_log", ["business_id"])
    op.create_index("idx_audit_entity", "reorder_audit_log", ["entity_type", "entity_id"])
    op.create_index("idx_audit_created", "reorder_audit_log", ["created_at"])

def downgrade() -> None:
    op.drop_table("reorder_audit_log")
    op.drop_table("grn_items")
    op.drop_table("goods_received_notes")
    op.drop_table("product_reorder_settings")
