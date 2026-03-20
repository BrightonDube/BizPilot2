"""Add parent_modifier_id to modifier_groups for nested modifiers.

Enables modifier groups to be nested under a parent modifier, supporting
use cases like "Bread → Toasting Level" (Requirement 3 of
addons-modifiers spec).

The column uses use_alter=True in the FK definition because
modifier_groups and modifiers reference each other (circular FK).

Revision ID: 071_nested_modifiers
Revises: 070_modifier_availability
Create Date: 2026-03-02
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op


revision = "071_nested_modifiers"
down_revision = "070_modifier_availability"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column(
        "modifier_groups",
        sa.Column(
            "parent_modifier_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    # Add the FK constraint separately (use_alter pattern for circular refs).
    op.create_foreign_key(
        "fk_modifier_groups_parent_modifier_id",
        "modifier_groups",
        "modifiers",
        ["parent_modifier_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_modifier_groups_parent_modifier_id",
        "modifier_groups",
        ["parent_modifier_id"],
        postgresql_where=sa.text("parent_modifier_id IS NOT NULL"),
    )

def downgrade() -> None:
    op.drop_index(
        "ix_modifier_groups_parent_modifier_id",
        table_name="modifier_groups",
    )
    op.drop_constraint(
        "fk_modifier_groups_parent_modifier_id",
        "modifier_groups",
        type_="foreignkey",
    )
    op.drop_column("modifier_groups", "parent_modifier_id")
