"""single superadmin

Revision ID: e7c1f3a2b9d0
Revises: c53915a0c393, d21cfee4a049
Create Date: 2026-01-09

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e7c1f3a2b9d0"
down_revision: Union[str, tuple[str, ...], None] = ("c53915a0c393", "d21cfee4a049")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = {c["name"] for c in inspector.get_columns("users")}
    if "is_superadmin" not in columns:
        op.add_column(
            "users",
            sa.Column("is_superadmin", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        )

    # Ensure the constraint can be applied even if multiple superadmins exist.
    # Keep the oldest superadmin and demote the rest.
    op.execute(
        "WITH su AS ("
        "  SELECT id FROM users WHERE is_superadmin = TRUE ORDER BY created_at ASC NULLS LAST"
        ") "
        "UPDATE users SET is_superadmin = FALSE "
        "WHERE is_superadmin = TRUE AND id NOT IN (SELECT id FROM su LIMIT 1)"
    )

    op.create_index(
        "ux_users_single_superadmin_true",
        "users",
        ["is_superadmin"],
        unique=True,
        postgresql_where=sa.text("is_superadmin = TRUE"),
    )


def downgrade() -> None:
    op.drop_index("ux_users_single_superadmin_true", table_name="users")
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("users")}
    if "is_superadmin" in columns:
        op.drop_column("users", "is_superadmin")
