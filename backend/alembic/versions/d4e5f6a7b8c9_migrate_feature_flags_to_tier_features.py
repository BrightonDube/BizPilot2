"""Migrate feature_flags JSONB to tier_features and normalise BusinessSubscription tier names.

Revision ID: d4e5f6a7b8c9
Revises: c1d2e3f4a5b6
Create Date: 2026-03-27 03:00:00.000000

This migration bridges the two permission systems:
  OLD: subscription_tiers.feature_flags (JSONB per tier row)
  NEW: tier_features table with boolean columns (seeded by migration 030)

What it does:
1. Ensures the four standard tier_features rows exist (idempotent upsert).
2. For any BusinessSubscription whose tier_name is NOT one of the four valid
   values, maps it to the closest equivalent and updates the row in-place.
3. Logs unmapped tier names so operators can review them.

Mapping rules (old name → new name):
  free / starter / basic / core  → pilot_core
  pro / professional / growth    → pilot_pro
  enterprise / custom            → enterprise
  demo / trial                   → demo
  (anything else)                → pilot_core  (safe default — least permissive)
"""

from __future__ import annotations

import logging
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

logger = logging.getLogger("alembic.migration")

# revision identifiers
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None

VALID_TIER_NAMES = {"demo", "pilot_core", "pilot_pro", "enterprise"}

# Maps old subscription_tiers.name values → tier_features.tier_name
_TIER_NAME_MAP = {
    # Free / entry-level
    "free": "pilot_core",
    "basic": "pilot_core",
    "starter": "pilot_core",
    "core": "pilot_core",
    "pilot_core": "pilot_core",
    # Pro / mid-tier
    "pro": "pilot_pro",
    "professional": "pilot_pro",
    "growth": "pilot_pro",
    "pilot_pro": "pilot_pro",
    # Enterprise
    "enterprise": "enterprise",
    "custom": "enterprise",
    # Demo / trial
    "demo": "demo",
    "trial": "demo",
}


def _map_tier_name(old_name: str) -> str:
    """Map an old tier name to a valid tier_features.tier_name."""
    if old_name in VALID_TIER_NAMES:
        return old_name
    mapped = _TIER_NAME_MAP.get(old_name.lower(), "pilot_core")
    if old_name.lower() not in _TIER_NAME_MAP:
        logger.warning(
            "Unknown tier name '%s' — defaulting to 'pilot_core'. "
            "Review and update BusinessSubscription manually if needed.",
            old_name,
        )
    return mapped


def upgrade() -> None:
    """
    1. Upsert the four standard tier_features rows (safe if already present).
    2. Normalise any BusinessSubscription.tier_name values not in the valid set.
    """
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # -- Step 1: Upsert standard tier_features rows -------------------------
    table_names = inspector.get_table_names()

    if "tier_features" in table_names:
        tier_features = sa.table(
            "tier_features",
            sa.column("tier_name", sa.String),
            sa.column("max_devices", sa.Integer),
            sa.column("max_users", sa.Integer),
            sa.column("has_payroll", sa.Boolean),
            sa.column("has_ai", sa.Boolean),
            sa.column("has_api_access", sa.Boolean),
            sa.column("has_advanced_reporting", sa.Boolean),
            sa.column("has_multi_location", sa.Boolean),
            sa.column("has_loyalty_programs", sa.Boolean),
            sa.column("has_recipe_management", sa.Boolean),
            sa.column("has_accounting_integration", sa.Boolean),
            sa.column("price_monthly", sa.Numeric),
        )

        standard_rows = [
            {
                "tier_name": "demo",
                "max_devices": 1, "max_users": 1,
                "has_payroll": True, "has_ai": True, "has_api_access": True,
                "has_advanced_reporting": True, "has_multi_location": False,
                "has_loyalty_programs": True, "has_recipe_management": True,
                "has_accounting_integration": False, "price_monthly": 0.00,
            },
            {
                "tier_name": "pilot_core",
                "max_devices": 2, "max_users": 5,
                "has_payroll": False, "has_ai": False, "has_api_access": False,
                "has_advanced_reporting": False, "has_multi_location": False,
                "has_loyalty_programs": False, "has_recipe_management": False,
                "has_accounting_integration": False, "price_monthly": 620.00,
            },
            {
                "tier_name": "pilot_pro",
                "max_devices": None, "max_users": None,
                "has_payroll": True, "has_ai": True, "has_api_access": True,
                "has_advanced_reporting": True, "has_multi_location": True,
                "has_loyalty_programs": True, "has_recipe_management": True,
                "has_accounting_integration": True, "price_monthly": 1699.00,
            },
            {
                "tier_name": "enterprise",
                "max_devices": None, "max_users": None,
                "has_payroll": True, "has_ai": True, "has_api_access": True,
                "has_advanced_reporting": True, "has_multi_location": True,
                "has_loyalty_programs": True, "has_recipe_management": True,
                "has_accounting_integration": True, "price_monthly": 0.00,
            },
        ]

        existing_tiers = {
            row[0]
            for row in bind.execute(
                sa.text("SELECT tier_name FROM tier_features")
            ).fetchall()
        }

        rows_to_insert = [r for r in standard_rows if r["tier_name"] not in existing_tiers]
        if rows_to_insert:
            op.bulk_insert(tier_features, rows_to_insert)
            logger.info("Inserted %d missing tier_features rows.", len(rows_to_insert))
        else:
            logger.info("All standard tier_features rows already exist — skipping insert.")

    # -- Step 2: Normalise BusinessSubscription.tier_name -------------------
    if "business_subscriptions" in table_names:
        rows = bind.execute(
            sa.text("SELECT id, tier_name FROM business_subscriptions WHERE tier_name IS NOT NULL")
        ).fetchall()

        updates: list[dict] = []
        for row_id, tier_name in rows:
            if tier_name not in VALID_TIER_NAMES:
                new_name = _map_tier_name(tier_name)
                updates.append({"id": str(row_id), "new_tier_name": new_name, "old": tier_name})

        if updates:
            logger.info(
                "Normalising %d BusinessSubscription.tier_name values.", len(updates)
            )
            for u in updates:
                bind.execute(
                    sa.text(
                        "UPDATE business_subscriptions SET tier_name = :new_name WHERE id = :id"
                    ),
                    {"new_name": u["new_tier_name"], "id": u["id"]},
                )
                logger.info("  %s: '%s' → '%s'", u["id"], u["old"], u["new_tier_name"])
        else:
            logger.info("All BusinessSubscription.tier_name values already valid — no updates.")


def downgrade() -> None:
    """Downgrade is a no-op: tier_name normalisation cannot be safely reversed."""
    logger.info(
        "Downgrade of d4e5f6a7b8c9 is a no-op. "
        "Tier name normalisation cannot be automatically reversed."
    )
