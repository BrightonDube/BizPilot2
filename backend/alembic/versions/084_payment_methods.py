"""Create payment_methods and payment_transactions tables.

Revision ID: 084_payment_methods
Revises: 083_delivery_tracking
Create Date: 2025-01-01 00:00:00.000000

Why dedicated payment tables?
The existing Order model tracks payment_status and payment_method as
simple strings, but integrated payment processing requires tracking
configured payment methods per business (card terminals, EFT providers,
mobile wallets) and a full transaction audit trail with gateway
references, retry counts, and refund chains.
"""

revision = "084_payment_methods"
down_revision = "083_delivery_tracking"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


def upgrade() -> None:
    # -- payment_methods: configured payment types per business ---------------
    op.create_table(
        "payment_methods",
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
            "method_type",
            sa.String(30),
            nullable=False,
            comment="cash | card | eft | snapscan | mobile | gift_card | account",
        ),
        sa.Column("provider", sa.String(100), nullable=True),
        sa.Column("config", JSONB, nullable=True, comment="Provider-specific config (no secrets)"),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("sort_order", sa.Integer, server_default="0", nullable=False),
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

    # -- payment_transactions: audit trail for every payment attempt ----------
    op.create_table(
        "payment_transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "order_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orders.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "payment_method_id",
            UUID(as_uuid=True),
            sa.ForeignKey("payment_methods.id"),
            nullable=True,
        ),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("tip_amount", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column(
            "status",
            sa.String(30),
            server_default="pending",
            nullable=False,
            comment="pending | processing | completed | failed | refunded | voided",
        ),
        sa.Column("gateway_reference", sa.String(255), nullable=True),
        sa.Column("gateway_response", JSONB, nullable=True),
        sa.Column(
            "refund_of_id",
            UUID(as_uuid=True),
            sa.ForeignKey("payment_transactions.id"),
            nullable=True,
            comment="Links refund to original transaction",
        ),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
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
    op.drop_table("payment_transactions")
    op.drop_table("payment_methods")
