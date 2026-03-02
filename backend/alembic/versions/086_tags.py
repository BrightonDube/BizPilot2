"""Create tag_categories, tags, and product_tags tables.

Revision ID: 086_tags
Revises: 085_customer_displays
Create Date: 2025-01-01 00:00:00.000000

Why a full tagging subsystem rather than a simple tags column?
Products need hierarchical, multi-category tagging with business-
scoped namespacing.  A JSONB array on products would make cross-
product queries (e.g. "all products tagged 'vegan'") require full
table scans.  Separate tag tables with a join table (product_tags)
support efficient filtering, analytics, and future smart collections.
"""

revision = "086_tags"
down_revision = "085_customer_displays"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


def upgrade() -> None:
    # -- tag_categories: grouping/namespacing for tags ----------------------
    op.create_table(
        "tag_categories",
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
        sa.Column("color", sa.String(7), nullable=True, comment="Hex colour for UI badges"),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("sort_order", sa.Integer, server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
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
        sa.UniqueConstraint("business_id", "slug", name="uq_tag_categories_business_slug"),
    )

    # -- tags: individual tags with optional hierarchy ----------------------
    op.create_table(
        "tags",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "category_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tag_categories.id"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "parent_tag_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tags.id"),
            nullable=True,
            comment="Self-referential for hierarchical tags",
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("hierarchy_level", sa.Integer, server_default="0", nullable=False),
        sa.Column("hierarchy_path", sa.Text, nullable=True, comment="Materialized path e.g. /food/vegan"),
        sa.Column("usage_count", sa.Integer, server_default="0", nullable=False),
        sa.Column("is_system_tag", sa.Boolean, server_default="false", nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("auto_apply_rules", JSONB, nullable=True),
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
        sa.UniqueConstraint("business_id", "slug", name="uq_tags_business_slug"),
    )

    # -- product_tags: many-to-many join between products and tags ----------
    op.create_table(
        "product_tags",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "tag_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tags.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("assigned_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "assignment_source",
            sa.String(50),
            server_default="manual",
            nullable=False,
            comment="manual | import | auto_rule | ai_suggestion",
        ),
        sa.UniqueConstraint("product_id", "tag_id", name="uq_product_tags_product_tag"),
    )


def downgrade() -> None:
    op.drop_table("product_tags")
    op.drop_table("tags")
    op.drop_table("tag_categories")
