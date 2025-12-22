"""Add AI chat persistence tables and user AI privacy settings

Revision ID: 009_ai_chat_and_user_settings
Revises: 008_fix_inventory_tx
Create Date: 2025-12-22 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "009_ai_chat_and_user_settings"
down_revision: Union[str, None] = "008_fix_inventory_tx"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_tables = set(inspector.get_table_names())

    existing_enums = {e["name"] for e in inspector.get_enums()}
    if "aidatasharinglevel" not in existing_enums:
        op.execute(
            "CREATE TYPE aidatasharinglevel AS ENUM ("
            "'none','app_only','metrics_only','full_business','full_business_with_customers'"
            ")"
        )

    if "user_settings" not in existing_tables:
        op.create_table(
            "user_settings",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id"),
                nullable=False,
                unique=True,
            ),
            sa.Column(
                "ai_data_sharing_level",
                sa.Enum(
                    "none",
                    "app_only",
                    "metrics_only",
                    "full_business",
                    "full_business_with_customers",
                    name="aidatasharinglevel",
                ),
                nullable=False,
                server_default="none",
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_user_settings_user_id", "user_settings", ["user_id"])

    if "ai_conversations" not in existing_tables:
        op.create_table(
            "ai_conversations",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("title", sa.String(length=200), nullable=False, server_default="New Conversation"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_ai_conversations_user_id", "ai_conversations", ["user_id"])

    if "ai_messages" not in existing_tables:
        op.create_table(
            "ai_messages",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column(
                "conversation_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("ai_conversations.id"),
                nullable=False,
            ),
            sa.Column("is_user", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_ai_messages_conversation_id", "ai_messages", ["conversation_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_tables = set(inspector.get_table_names())

    if "ai_messages" in existing_tables:
        op.drop_index("ix_ai_messages_conversation_id", table_name="ai_messages")
        op.drop_table("ai_messages")

    if "ai_conversations" in existing_tables:
        op.drop_index("ix_ai_conversations_user_id", table_name="ai_conversations")
        op.drop_table("ai_conversations")

    if "user_settings" in existing_tables:
        op.drop_index("ix_user_settings_user_id", table_name="user_settings")
        op.drop_table("user_settings")

    existing_enums = {e["name"] for e in inspector.get_enums()}
    if "aidatasharinglevel" in existing_enums:
        op.execute("DROP TYPE aidatasharinglevel")
