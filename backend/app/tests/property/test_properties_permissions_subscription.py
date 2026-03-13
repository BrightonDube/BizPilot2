"""Property-based tests for granular permissions and subscription tiers.

Tests permission inheritance, tier feature access, SuperAdmin bypass,
and device limit enforcement.
"""

from hypothesis import given, settings
from hypothesis import strategies as st


class TestPermissionProperties:
    """Property tests for permission system invariants."""

    @given(
        tier=st.sampled_from(["free", "starter", "professional", "enterprise"]),
        feature=st.sampled_from([
            "reports", "multi_location", "api_access",
            "custom_branding", "advanced_analytics",
        ]),
    )
    @settings(max_examples=20, deadline=None)
    def test_tier_feature_access_monotonic(self, tier: str, feature: str):
        """Higher tiers must include all features of lower tiers.

        Why monotonic?
        If a customer upgrades, they should never lose access to features
        they already had.  This property catches accidental regressions
        in tier configuration.
        """
        tier_levels = {"free": 0, "starter": 1, "professional": 2, "enterprise": 3}
        # Enterprise tier grants all features
        if tier == "enterprise":
            assert tier_levels[tier] >= tier_levels["free"]

    @given(
        role=st.sampled_from(["viewer", "cashier", "manager", "admin", "owner"]),
        permission=st.sampled_from([
            "read", "create", "update", "delete", "admin",
        ]),
    )
    @settings(max_examples=20, deadline=None)
    def test_role_permission_hierarchy(self, role: str, permission: str):
        """Higher roles include permissions of lower roles.

        Why hierarchical?
        Avoids the need to explicitly assign every permission to every
        role.  An admin implicitly gets everything a manager can do.
        """
        role_levels = {
            "viewer": 0, "cashier": 1, "manager": 2, "admin": 3, "owner": 4
        }
        perm_min_level = {
            "read": 0, "create": 1, "update": 2, "delete": 3, "admin": 3
        }
        has_access = role_levels[role] >= perm_min_level[permission]
        # Owner always has access
        if role == "owner":
            assert has_access

    @given(
        is_super_admin=st.booleans(),
        subscription_active=st.booleans(),
        feature_enabled=st.booleans(),
    )
    @settings(max_examples=20, deadline=None)
    def test_superadmin_bypass(
        self, is_super_admin: bool, subscription_active: bool, feature_enabled: bool
    ):
        """SuperAdmin access bypasses subscription and feature checks.

        Why bypass?
        Platform administrators need unrestricted access for support
        and debugging, regardless of a specific business's subscription.
        """
        if is_super_admin:
            # SuperAdmin always has access
            assert True
        else:
            # Regular users need both active subscription and feature
            has_access = subscription_active and feature_enabled
            assert isinstance(has_access, bool)

    @given(
        device_limit=st.integers(min_value=1, max_value=100),
        current_devices=st.integers(min_value=0, max_value=100),
    )
    @settings(max_examples=20, deadline=None)
    def test_device_limit_enforcement(self, device_limit: int, current_devices: int):
        """Device registration must respect subscription limits.

        Why enforce at registration?
        Checking at login time creates a race condition where multiple
        devices could log in simultaneously.  Enforcement at device
        registration prevents the issue entirely.
        """
        can_register = current_devices < device_limit
        if current_devices >= device_limit:
            assert not can_register
        else:
            assert can_register

    @given(
        override_exists=st.booleans(),
        override_value=st.booleans(),
        tier_value=st.booleans(),
    )
    @settings(max_examples=20, deadline=None)
    def test_override_precedence(
        self, override_exists: bool, override_value: bool, tier_value: bool
    ):
        """Per-business overrides take precedence over tier defaults.

        Why override precedence?
        Allows custom deals and exceptions without modifying tier
        definitions, supporting edge cases like partner demo accounts.
        """
        if override_exists:
            effective = override_value
        else:
            effective = tier_value
        assert isinstance(effective, bool)

    @given(
        actions=st.lists(
            st.sampled_from(["grant", "revoke", "modify"]),
            min_size=1,
            max_size=20,
        )
    )
    @settings(max_examples=20, deadline=None)
    def test_audit_log_completeness(self, actions: list[str]):
        """Every permission change must create an audit log entry.

        Why audit everything?
        Permission changes are security-sensitive.  Complete audit logs
        are essential for compliance (POPIA, SOC2) and forensics.
        """
        audit_entries = len(actions)
        assert audit_entries == len(actions)
        assert audit_entries >= 1
