"""Create combo_deals and combo_components tables.

These tables support the combo/bundle deals feature described in the
addons-modifiers spec (Requirement 4).  combo_deals holds the top-level
promotional bundles while combo_components defines the individual items
(or item-choice slots) within a deal.

Design note: We use PostgreSQL ARRAY(UUID) columns for
``location_ids``, ``allowed_category_ids``, and ``allowed_product_ids``
rather than separate junction tables.  This keeps the schema simpler for
what are essentially small, rarely-queried filter lists that are always
read as a whole.  If we later need to query "which combos include
product X" at scale, we can add GIN indexes or migrate to junction
tables.

Revision ID: 068_combo_deals
Revises: 067_staff_targets
Create Date: 2026-03-02
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op


# ---------------------------------------------------------------------------
# Alembic revision identifiers
# ---------------------------------------------------------------------------
revision = "068_combo_deals"
down_revision = "067_staff_targets"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # ------------------------------------------------------------------
    # Enum: combo_component_type – distinguishes between a fixed product
    # and a "pick one from these options" slot in a combo deal.
    # ------------------------------------------------------------------
    combo_component_type_enum = postgresql.ENUM(
        "fixed",
        "choice",
        name="combocomponenttype",
        create_type=False,
    )
    combo_component_type_enum.create(op.get_bind(), checkfirst=True)

    # ------------------------------------------------------------------
    # Table: combo_deals
    # ------------------------------------------------------------------
    op.create_table(
        "combo_deals",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "business_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("image_url", sa.String(500), nullable=True),
        # combo_price is the bundled selling price; original_price is the
        # sum of individual item prices so the front-end can display the
        # savings to the customer.
        sa.Column(
            "combo_price",
            sa.Numeric(12, 2),
            nullable=False,
            comment="Bundled selling price of the combo",
        ),
        sa.Column(
            "original_price",
            sa.Numeric(12, 2),
            nullable=False,
            comment="Sum of component prices before discount",
        ),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("start_date", sa.Date, nullable=True),
        sa.Column("end_date", sa.Date, nullable=True),
        # ARRAY(UUID) stores the locations where this combo is offered.
        # NULL means available everywhere.
        sa.Column(
            "location_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=True,
            comment="Locations where this combo is available; NULL = all locations",
        ),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ------------------------------------------------------------------
    # Table: combo_components
    # ------------------------------------------------------------------
    op.create_table(
        "combo_components",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "combo_deal_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("combo_deals.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "component_type",
            combo_component_type_enum,
            nullable=False,
            comment="fixed = always this product; choice = pick from allowed list",
        ),
        # fixed_product_id is only populated when component_type='fixed'.
        sa.Column(
            "fixed_product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        # allowed_category_ids and allowed_product_ids are only populated
        # when component_type='choice'.
        sa.Column(
            "allowed_category_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=True,
            comment="Category IDs the customer may choose from",
        ),
        sa.Column(
            "allowed_product_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=True,
            comment="Product IDs the customer may choose from",
        ),
        sa.Column("quantity", sa.Integer, nullable=False, server_default=sa.text("1")),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column(
            "allow_modifiers",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("true"),
            comment="Whether modifier selection is allowed on this component",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

def downgrade() -> None:
    op.drop_table("combo_components")
    op.drop_table("combo_deals")
    # Drop the enum type we created in upgrade().
    postgresql.ENUM(name="combocomponenttype").drop(op.get_bind(), checkfirst=True)
