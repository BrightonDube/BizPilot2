"""Create delivery_tracking and delivery_proofs tables.

Revision ID: 083_delivery_tracking
Revises: 082_driver_shifts
Create Date: 2025-01-01 00:00:00.000000

Why separate tracking and proof tables?
delivery_tracking stores a time-series of location/status updates per
delivery.  delivery_proofs stores the final proof (signature, photo)
that the delivery was completed.  Keeping them separate from the
deliveries table avoids bloating the main table and allows efficient
queries for real-time tracking vs auditing.
"""

revision = "083_delivery_tracking"
down_revision = "082_driver_shifts"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


def upgrade() -> None:
    # -- delivery_tracking: time-series of status/location updates ----------
    op.create_table(
        "delivery_tracking",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "delivery_id",
            UUID(as_uuid=True),
            sa.ForeignKey("deliveries.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("location", JSONB, nullable=True),
        sa.Column("eta_minutes", sa.Integer, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # -- delivery_proofs: signed/photo confirmation of delivery -------------
    op.create_table(
        "delivery_proofs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "delivery_id",
            UUID(as_uuid=True),
            sa.ForeignKey("deliveries.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("proof_type", sa.String(30), nullable=False),
        sa.Column("signature_url", sa.Text, nullable=True),
        sa.Column("photo_url", sa.Text, nullable=True),
        sa.Column("recipient_name", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("delivery_proofs")
    op.drop_table("delivery_tracking")
