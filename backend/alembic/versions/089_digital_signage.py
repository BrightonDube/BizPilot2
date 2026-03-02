"""Create core digital signage tables.

Revision ID: 089_digital_signage
Revises: 088_smart_collections
Create Date: 2025-01-01 00:00:00.000000

Why dedicated signage tables instead of reusing customer_displays?
customer_displays tracks order-line displays at the POS.  Digital
signage is a content management system for promotional screens in
the store — different lifecycle, different content types, different
hardware requirements.  Keeping them separate avoids coupling.
"""

revision = "089_digital_signage"
down_revision = "088_smart_collections"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY


def upgrade() -> None:
    # -- signage_display_groups: logical grouping for displays ---------------
    op.create_table(
        "signage_display_groups",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # -- signage_displays: registered signage hardware ----------------------
    op.create_table(
        "signage_displays",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "display_group_id",
            UUID(as_uuid=True),
            sa.ForeignKey("signage_display_groups.id"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("pairing_code", sa.String(20), nullable=True, unique=True),
        sa.Column("device_id", sa.String(255), nullable=True),
        sa.Column(
            "status",
            sa.String(30),
            server_default="offline",
            nullable=False,
        ),
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
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

    # -- signage_content: slides / layouts ----------------------------------
    op.create_table(
        "signage_content",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "content_type",
            sa.String(30),
            nullable=False,
            comment="image | video | html | menu_board | promotion",
        ),
        sa.Column("layout", JSONB, nullable=True),
        sa.Column("duration_seconds", sa.Integer, server_default="10", nullable=False),
        sa.Column("transition_type", sa.String(30), server_default="fade", nullable=False),
        sa.Column(
            "status",
            sa.String(30),
            server_default="draft",
            nullable=False,
        ),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
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

    # -- signage_playlists: ordered content playback sequences --------------
    op.create_table(
        "signage_playlists",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("shuffle", sa.Boolean, server_default="false", nullable=False),
        sa.Column("loop", sa.Boolean, server_default="true", nullable=False),
        sa.Column("priority", sa.Integer, server_default="0", nullable=False),
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

    # -- signage_playlist_items: content within a playlist ------------------
    op.create_table(
        "signage_playlist_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "playlist_id",
            UUID(as_uuid=True),
            sa.ForeignKey("signage_playlists.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "content_id",
            UUID(as_uuid=True),
            sa.ForeignKey("signage_content.id"),
            nullable=True,
        ),
        sa.Column("sort_order", sa.Integer, server_default="0", nullable=False),
        sa.Column("duration_seconds", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("signage_playlist_items")
    op.drop_table("signage_playlists")
    op.drop_table("signage_content")
    op.drop_table("signage_displays")
    op.drop_table("signage_display_groups")
