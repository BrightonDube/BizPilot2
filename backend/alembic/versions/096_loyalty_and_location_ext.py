"""Add loyalty reward catalog and tier benefits; multi-location settings/pricing/access.

Revision ID: 096_loyalty_and_location_ext
Revises: 095_sync_queue
Create Date: 2025-01-01 00:00:00.000000

Why bundle these?
Both loyalty extensions and location extensions are small (2-3 tables each)
and unrelated to each other, so combining them avoids migration sprawl.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "096_loyalty_and_location_ext"
down_revision = "095_sync_queue"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- reward_catalog: redeemable loyalty rewards ---------------------
    op.create_table(
        "reward_catalog",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("points_cost", sa.Integer, nullable=False),
        sa.Column("reward_type", sa.String(30), nullable=False),  # discount, free_item, voucher
        sa.Column("reward_value", sa.Numeric(12, 2), nullable=True),  # discount amount or item value
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=True),
        sa.Column("min_tier", sa.String(20), nullable=True),  # minimum tier required to redeem
        sa.Column("stock_quantity", sa.Integer, nullable=True),  # null = unlimited
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_reward_catalog_business", "reward_catalog", ["business_id"])

    # -- tier_benefits: perks associated with each loyalty tier ----------
    op.create_table(
        "tier_benefits",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("tier_name", sa.String(20), nullable=False),  # bronze, silver, gold, platinum
        sa.Column("benefit_type", sa.String(30), nullable=False),  # discount, bonus_points, free_delivery, etc.
        sa.Column("benefit_value", sa.Numeric(12, 2), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_tier_benefits_business", "tier_benefits", ["business_id", "tier_name"])

    # -- location_settings: location-specific config overrides ----------
    op.create_table(
        "location_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("location_id", UUID(as_uuid=True), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("setting_key", sa.String(100), nullable=False),
        sa.Column("setting_value", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_location_setting", "location_settings",
        ["location_id", "setting_key"],
    )

    # -- location_pricing: per-location product price overrides ---------
    op.create_table(
        "location_pricing",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("location_id", UUID(as_uuid=True), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("selling_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("cost_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_location_product_pricing", "location_pricing",
        ["location_id", "product_id"],
    )

    # -- user_location_access: per-user per-location permissions --------
    op.create_table(
        "user_location_access",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("location_id", UUID(as_uuid=True), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("access_level", sa.String(20), nullable=False, server_default="view"),  # view, manage, admin
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_user_location_access", "user_location_access",
        ["user_id", "location_id"],
    )


def downgrade() -> None:
    op.drop_table("user_location_access")
    op.drop_table("location_pricing")
    op.drop_table("location_settings")
    op.drop_table("tier_benefits")
    op.drop_table("reward_catalog")
