"""Create modifier_availability table.

Controls when specific modifiers are available for selection based on
time of day, day of week, date ranges, and location (Requirement 6 of
the addons-modifiers spec).

Design note: We use individual rows per availability rule rather than a
JSON blob because the service layer needs to query "which modifiers are
available right now at this location?" efficiently.  With separate rows,
PostgreSQL can filter on indexed columns.

Revision ID: 070_modifier_availability
Revises: 069_order_item_modifiers
Create Date: 2026-03-02
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op


# ---------------------------------------------------------------------------
# Alembic revision identifiers
# ---------------------------------------------------------------------------
revision = "070_modifier_availability"
down_revision = "069_order_item_modifiers"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "modifier_availability",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "modifier_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("modifiers.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        # day_of_week: 0 = Monday … 6 = Sunday (ISO 8601 convention).
        # NULL means the rule applies to every day.
        sa.Column(
            "day_of_week",
            sa.Integer,
            nullable=True,
            comment="0=Mon … 6=Sun; NULL = every day",
        ),
        # Time window within a day.  Both NULL = all day.
        sa.Column(
            "start_time",
            sa.Time,
            nullable=True,
            comment="Start of availability window (HH:MM)",
        ),
        sa.Column(
            "end_time",
            sa.Time,
            nullable=True,
            comment="End of availability window (HH:MM)",
        ),
        # Date range for seasonal availability.  Both NULL = no date
        # restriction.
        sa.Column(
            "start_date",
            sa.Date,
            nullable=True,
            comment="Start of seasonal availability",
        ),
        sa.Column(
            "end_date",
            sa.Date,
            nullable=True,
            comment="End of seasonal availability",
        ),
        # Location-specific availability.  NULL = all locations.
        sa.Column(
            "location_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            index=True,
            comment="Specific location; NULL = all locations",
        ),
        # is_available=False can be used for "86'd" (temporarily
        # unavailable) status — a common restaurant POS concept.
        sa.Column(
            "is_available",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("true"),
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

    # Composite index for the most common query pattern: "which modifiers
    # are available at this location on this day?"
    op.create_index(
        "ix_modifier_availability_lookup",
        "modifier_availability",
        ["modifier_id", "day_of_week", "location_id"],
    )

def downgrade() -> None:
    op.drop_index(
        "ix_modifier_availability_lookup",
        table_name="modifier_availability",
    )
    op.drop_table("modifier_availability")
