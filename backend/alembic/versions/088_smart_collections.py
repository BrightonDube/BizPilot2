"""Create smart_collections and collection_products tables.

Revision ID: 088_smart_collections
Revises: 087_proforma_revisions
Create Date: 2025-01-01 00:00:00.000000

Why smart collections?
Manual product grouping doesn't scale.  Smart collections use rule-based
criteria (e.g. "all products tagged 'vegan' priced under R100") to
automatically include/exclude products.  This enables dynamic menus,
promotional bundles, and filtered reports without manual maintenance.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "088_smart_collections"
down_revision = "087_proforma_revisions"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # -- smart_collections: rule-based product groupings --------------------
    op.create_table(
        "smart_collections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("rules", JSONB, nullable=True, comment="Array of rule objects"),
        sa.Column(
            "rule_logic",
            sa.String(10),
            server_default="and",
            nullable=False,
            comment="and | or",
        ),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("auto_update", sa.Boolean, server_default="true", nullable=False),
        sa.Column("product_count", sa.Integer, server_default="0", nullable=False),
        sa.Column("last_refresh_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("business_id", "slug", name="uq_smart_collections_business_slug"),
    )

    # -- collection_products: join between collections and products ----------
    op.create_table(
        "collection_products",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "collection_id",
            UUID(as_uuid=True),
            sa.ForeignKey("smart_collections.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "product_id",
            UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("manually_included", sa.Boolean, server_default="false", nullable=False),
        sa.Column("manually_excluded", sa.Boolean, server_default="false", nullable=False),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("collection_id", "product_id", name="uq_collection_products"),
    )

def downgrade() -> None:
    op.drop_table("collection_products")
    op.drop_table("smart_collections")
