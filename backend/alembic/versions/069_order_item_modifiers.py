"""Create order_item_modifiers table.

Stores the modifier selections made for each line item in an order
(Requirement 8 of the addons-modifiers spec).  Each row captures the
modifier that was chosen, its price *at the time of ordering* (so
historical orders remain accurate even if modifier prices change later),
and an optional parent_modifier_id for nested modifier support.

Why snapshot prices into this table instead of joining back to modifiers?
Modifier prices can change over time, but an order's financial record
must reflect the exact prices charged at checkout.  Denormalising the
price and names into this table provides an immutable audit trail.

Revision ID: 069_order_item_modifiers
Revises: 068_combo_deals
Create Date: 2026-03-02
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op


# ---------------------------------------------------------------------------
# Alembic revision identifiers
# ---------------------------------------------------------------------------
revision = "069_order_item_modifiers"
down_revision = "068_combo_deals"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "order_item_modifiers",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        # ------------------------------------------------------------------
        # Foreign key to the order line item this modifier was applied to.
        # ------------------------------------------------------------------
        sa.Column(
            "order_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("order_items.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        # ------------------------------------------------------------------
        # Reference back to the modifier catalogue entry.  SET NULL on
        # delete so we keep the historical record even if the modifier is
        # later removed from the catalogue.
        # ------------------------------------------------------------------
        sa.Column(
            "modifier_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("modifiers.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        # ------------------------------------------------------------------
        # Denormalised snapshot fields – immutable record of what was sold.
        # ------------------------------------------------------------------
        sa.Column(
            "modifier_name",
            sa.String(255),
            nullable=False,
            comment="Name of the modifier at time of order",
        ),
        sa.Column(
            "modifier_group_name",
            sa.String(255),
            nullable=False,
            comment="Name of the modifier group at time of order",
        ),
        sa.Column(
            "quantity",
            sa.Integer,
            nullable=False,
            server_default=sa.text("1"),
        ),
        sa.Column(
            "unit_price",
            sa.Numeric(12, 2),
            nullable=False,
            comment="Price per unit at time of order",
        ),
        sa.Column(
            "total_price",
            sa.Numeric(12, 2),
            nullable=False,
            comment="quantity * unit_price",
        ),
        # ------------------------------------------------------------------
        # Nested modifier support – a self-reference that links a
        # sub-modifier selection back to its parent modifier selection.
        # ------------------------------------------------------------------
        sa.Column(
            "parent_modifier_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Self-reference for nested modifier selections",
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

    # Index on parent_modifier_id for efficient nested modifier lookups
    op.create_index(
        "ix_order_item_modifiers_parent_modifier_id",
        "order_item_modifiers",
        ["parent_modifier_id"],
        postgresql_where=sa.text("parent_modifier_id IS NOT NULL"),
    )

def downgrade() -> None:
    op.drop_index(
        "ix_order_item_modifiers_parent_modifier_id",
        table_name="order_item_modifiers",
    )
    op.drop_table("order_item_modifiers")
