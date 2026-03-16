"""Create customer_displays and display_configs tables.

Revision ID: 085_customer_displays
Revises: 084_payment_methods
Create Date: 2025-01-01 00:00:00.000000

Why separate display and config tables?
customer_displays stores hardware-level info (device identity, status,
last ping).  display_configs holds the presentation layer (layout,
theme, features) and is updated more frequently.  Separating them
keeps the device registry lightweight for health checks while the
config table can evolve independently.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "085_customer_displays"
down_revision = "084_payment_methods"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # -- customer_displays: registered display devices -----------------------
    op.create_table(
        "customer_displays",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "display_type",
            sa.String(30),
            nullable=False,
            comment="tablet | monitor | pole_display | web",
        ),
        sa.Column("terminal_id", sa.String(100), nullable=True, comment="Links to POS terminal"),
        sa.Column(
            "status",
            sa.String(30),
            server_default="offline",
            nullable=False,
            comment="online | offline | pairing",
        ),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
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
    )

    # -- display_configs: presentation settings per display ------------------
    op.create_table(
        "display_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "display_id",
            UUID(as_uuid=True),
            sa.ForeignKey("customer_displays.id"),
            nullable=False,
            unique=True,
            comment="1-to-1 with customer_displays",
        ),
        sa.Column(
            "layout",
            sa.String(30),
            server_default="standard",
            nullable=False,
            comment="standard | split | fullscreen",
        ),
        sa.Column(
            "orientation",
            sa.String(20),
            server_default="landscape",
            nullable=False,
        ),
        sa.Column("theme", JSONB, nullable=True, comment="Colours, fonts, logo URL"),
        sa.Column("features", JSONB, nullable=True, comment="Toggle flags for display features"),
        sa.Column(
            "language",
            sa.String(10),
            server_default="en",
            nullable=False,
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
    )

def downgrade() -> None:
    op.drop_table("display_configs")
    op.drop_table("customer_displays")
