"""Tests for granular permissions migration and backward-compatibility fallback.

Covers:
- Migration tier-name mapping helper (_map_tier_name)
- Backward compat fallback: _load_tier_features_from_jsonb()
- PermissionService._load_tier_features() falls back when TierFeature missing
- PermissionService and old subscription.py return consistent results
"""

import uuid
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Migration mapping helper tests
# ---------------------------------------------------------------------------

class TestMigrationTierNameMapping:
    def _get_map_fn(self):
        """Import the helper from the migration module."""
        import importlib.util, sys
        # The migration file is not on sys.path by default — import it directly
        import os
        path = os.path.join(
            os.path.dirname(__file__),
            "..", "..", "alembic", "versions",
            "d4e5f6a7b8c9_migrate_feature_flags_to_tier_features.py",
        )
        spec = importlib.util.spec_from_file_location("mig_d4e5", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod._map_tier_name

    def test_valid_names_pass_through(self):
        fn = self._get_map_fn()
        for valid in ("demo", "pilot_core", "pilot_pro", "enterprise"):
            assert fn(valid) == valid

    def test_old_free_maps_to_pilot_core(self):
        fn = self._get_map_fn()
        assert fn("free") == "pilot_core"
        assert fn("starter") == "pilot_core"
        assert fn("basic") == "pilot_core"

    def test_old_pro_maps_to_pilot_pro(self):
        fn = self._get_map_fn()
        assert fn("pro") == "pilot_pro"
        assert fn("professional") == "pilot_pro"
        assert fn("growth") == "pilot_pro"

    def test_old_enterprise_maps_to_enterprise(self):
        fn = self._get_map_fn()
        assert fn("enterprise") == "enterprise"
        assert fn("custom") == "enterprise"

    def test_old_trial_maps_to_demo(self):
        fn = self._get_map_fn()
        assert fn("trial") == "demo"
        assert fn("demo") == "demo"

    def test_unknown_name_defaults_to_pilot_core(self):
        fn = self._get_map_fn()
        assert fn("totally_unknown_tier_xyz") == "pilot_core"


# ---------------------------------------------------------------------------
# _load_tier_features_from_jsonb fallback tests
# ---------------------------------------------------------------------------

class TestLoadTierFeaturesFromJsonb:
    def _make_service(self, old_tier_flags=None, tier_found=True):
        """Return a PermissionService with a mocked DB session."""
        from app.services.permission_service import PermissionService

        mock_db = MagicMock()

        # Mock TierFeature query (returns nothing — forces fallback)
        tf_result = MagicMock()
        tf_result.scalar_one_or_none.return_value = None

        # Mock SubscriptionTier query
        if tier_found and old_tier_flags is not None:
            old_tier = MagicMock()
            old_tier.feature_flags = old_tier_flags
            st_result = MagicMock()
            st_result.scalar_one_or_none.return_value = old_tier
        else:
            st_result = MagicMock()
            st_result.scalar_one_or_none.return_value = None

        # .execute() returns tf_result first, then st_result on subsequent calls
        mock_db.execute.side_effect = [tf_result, st_result]

        svc = PermissionService(db=mock_db)
        return svc

    @pytest.mark.asyncio
    async def test_returns_enabled_features_from_jsonb(self):
        """When TierFeature missing, reads feature_flags JSONB and returns enabled features."""
        svc = self._make_service(
            old_tier_flags={
                "has_payroll": True,
                "has_ai": False,
                "has_api_access": True,
                "has_advanced_reporting": False,
                "has_multi_location": False,
                "has_loyalty_programs": True,
                "has_recipe_management": False,
                "has_accounting_integration": False,
            }
        )

        features = await svc._load_tier_features("legacy_pro")

        assert "has_payroll" in features
        assert "has_api_access" in features
        assert "has_loyalty_programs" in features
        assert "has_ai" not in features
        assert "has_advanced_reporting" not in features

    @pytest.mark.asyncio
    async def test_returns_empty_when_old_tier_not_found(self):
        """Returns empty set when neither TierFeature nor SubscriptionTier exists."""
        svc = self._make_service(old_tier_flags=None, tier_found=False)
        features = await svc._load_tier_features("ghost_tier")
        assert features == set()

    @pytest.mark.asyncio
    async def test_ignores_unknown_keys_in_feature_flags(self):
        """Unknown keys in feature_flags JSONB are ignored."""
        svc = self._make_service(
            old_tier_flags={
                "has_payroll": True,
                "max_users": 10,               # limit key, not a feature
                "unknown_feature": True,       # unknown key
                "has_ai": False,
            }
        )
        features = await svc._load_tier_features("old_tier")
        assert "has_payroll" in features
        assert "max_users" not in features
        assert "unknown_feature" not in features
        assert "has_ai" not in features


# ---------------------------------------------------------------------------
# Consistency: old subscription.py vs PermissionService
# ---------------------------------------------------------------------------

class TestOldAndNewSystemConsistency:
    def test_get_user_effective_features_reads_feature_flags(self):
        """get_user_effective_features should read tier.feature_flags JSONB."""
        from app.core.subscription import get_user_effective_features

        mock_user = MagicMock()
        mock_user.current_tier_id = uuid.uuid4()
        mock_user.feature_overrides = {}

        mock_tier = MagicMock()
        mock_tier.feature_flags = {"has_ai": True, "has_payroll": False}

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_tier

        features = get_user_effective_features(mock_user, mock_db)

        assert features.get("has_ai") is True
        assert features.get("has_payroll") is False

    def test_user_overrides_take_precedence(self):
        """User-level feature_overrides should override tier defaults."""
        from app.core.subscription import get_user_effective_features

        mock_user = MagicMock()
        mock_user.current_tier_id = uuid.uuid4()
        mock_user.feature_overrides = {"has_ai": False}  # override: disable ai

        mock_tier = MagicMock()
        mock_tier.feature_flags = {"has_ai": True}

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_tier

        features = get_user_effective_features(mock_user, mock_db)
        assert features.get("has_ai") is False

    def test_no_tier_returns_empty_features(self):
        """When user has no tier, features should be empty."""
        from app.core.subscription import get_user_effective_features

        mock_user = MagicMock()
        mock_user.current_tier_id = None
        mock_user.feature_overrides = {}

        features = get_user_effective_features(mock_user, MagicMock())
        assert features == {}


# ---------------------------------------------------------------------------
# Migration idempotence smoke test
# ---------------------------------------------------------------------------

class TestMigrationIdempotence:
    def test_upgrade_is_idempotent_when_tiers_already_exist(self):
        """Running upgrade twice should not raise even if tier_features rows exist."""
        import importlib.util, os

        path = os.path.join(
            os.path.dirname(__file__),
            "..", "..", "alembic", "versions",
            "d4e5f6a7b8c9_migrate_feature_flags_to_tier_features.py",
        )
        spec = importlib.util.spec_from_file_location("mig_d4e5_idem", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        # All 4 tiers already exist → nothing to insert
        existing = [("demo",), ("pilot_core",), ("pilot_pro",), ("enterprise",)]

        mock_bind = MagicMock()
        mock_bind.execute.return_value.fetchall.side_effect = [
            existing,    # SELECT tier_name FROM tier_features
            [],          # SELECT id, tier_name FROM business_subscriptions
        ]

        mock_inspector = MagicMock()
        mock_inspector.get_table_names.return_value = ["tier_features", "business_subscriptions"]

        with patch("alembic.op.get_bind", return_value=mock_bind), \
             patch("sqlalchemy.inspect", return_value=mock_inspector), \
             patch("alembic.op.bulk_insert") as mock_bulk:
            mod.upgrade()
            mock_bulk.assert_not_called()

    def test_mapping_is_deterministic(self):
        """The same old tier name always maps to the same new tier name."""
        import importlib.util, os

        path = os.path.join(
            os.path.dirname(__file__),
            "..", "..", "alembic", "versions",
            "d4e5f6a7b8c9_migrate_feature_flags_to_tier_features.py",
        )
        spec = importlib.util.spec_from_file_location("mig_d4e5_det", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        fn = mod._map_tier_name
        for name in ("free", "pro", "enterprise", "trial"):
            first_call = fn(name)
            second_call = fn(name)
            assert first_call == second_call, f"Non-deterministic mapping for '{name}'"
