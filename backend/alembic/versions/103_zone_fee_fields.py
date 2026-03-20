"""add delivery zone and fee fields

Revision ID: 103_zone_fee_fields
Revises: 102_pf_approval_audit
Create Date: 2026-03-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "103_zone_fee_fields"
down_revision = "102_pf_approval_audit"
branch_labels = None
depends_on = None

def upgrade() -> None:
    """Add zone type, boundary, fee calculation fields to delivery_zones."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # ── New columns on delivery_zones ─────────────────────────────
    existing_cols = {c["name"] for c in inspector.get_columns("delivery_zones")}

    new_cols = {
        "zone_type": sa.Column("zone_type", sa.String(20), server_default="flat"),
        "boundary": sa.Column("boundary", postgresql.JSONB(), nullable=True),
        "center_lat": sa.Column("center_lat", sa.Numeric(10, 7), nullable=True),
        "center_lng": sa.Column("center_lng", sa.Numeric(10, 7), nullable=True),
        "radius_km": sa.Column("radius_km", sa.Numeric(8, 2), nullable=True),
        "postcodes": sa.Column("postcodes", postgresql.JSONB(), nullable=True),
        "fee_type": sa.Column("fee_type", sa.String(20), server_default="flat"),
        "fee_per_km": sa.Column("fee_per_km", sa.Numeric(8, 2), server_default="0"),
        "min_order_amount": sa.Column("min_order_amount", sa.Numeric(12, 2), server_default="0"),
        "free_delivery_threshold": sa.Column("free_delivery_threshold", sa.Numeric(12, 2), nullable=True),
        "max_distance_km": sa.Column("max_distance_km", sa.Numeric(8, 2), nullable=True),
    }

    for col_name, col_def in new_cols.items():
        if col_name not in existing_cols:
            op.add_column("delivery_zones", col_def)

    # ── New columns on drivers (current location) ─────────────────
    driver_cols = {c["name"] for c in inspector.get_columns("drivers")}
    driver_new = {
        "current_lat": sa.Column("current_lat", sa.Numeric(10, 7), nullable=True),
        "current_lng": sa.Column("current_lng", sa.Numeric(10, 7), nullable=True),
        "last_location_at": sa.Column("last_location_at", sa.DateTime(timezone=True), nullable=True),
        "max_concurrent": sa.Column("max_concurrent", sa.Integer(), server_default="5"),
    }
    for col_name, col_def in driver_new.items():
        if col_name not in driver_cols:
            op.add_column("drivers", col_def)

def downgrade() -> None:
    """Remove added columns."""
    for col in ["zone_type", "boundary", "center_lat", "center_lng",
                "radius_km", "postcodes", "fee_type", "fee_per_km",
                "min_order_amount", "free_delivery_threshold", "max_distance_km"]:
        op.drop_column("delivery_zones", col)
    for col in ["current_lat", "current_lng", "last_location_at", "max_concurrent"]:
        op.drop_column("drivers", col)
