"""add_is_custom_pricing_to_subscription_tiers

Revision ID: ef3bb807b7d5
Revises: 4777487a7c3d
Create Date: 2026-01-18 22:27:11.050416

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ef3bb807b7d5'
down_revision: Union[str, None] = '4777487a7c3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_custom_pricing column to subscription_tiers table
    # Use proper PostgreSQL anonymous block syntax with $$ delimiters
    op.execute("""
        DO $$
        BEGIN
            -- Check if subscription_tiers table exists and add column if it doesn't exist
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_tiers') THEN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name = 'subscription_tiers' AND column_name = 'is_custom_pricing') THEN
                    ALTER TABLE subscription_tiers ADD COLUMN is_custom_pricing BOOLEAN NOT NULL DEFAULT false;
                END IF;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # Remove is_custom_pricing column from subscription_tiers table
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'subscription_tiers' AND column_name = 'is_custom_pricing') THEN
                ALTER TABLE subscription_tiers DROP COLUMN is_custom_pricing;
            END IF;
        END $$;
    """)
