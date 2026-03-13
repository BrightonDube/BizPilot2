"""Unit tests for ModifierAvailabilityService.

Tests cover:
- Rule matching logic: positive rules, negative rules, wildcard (NULL) fields
- No rules = always available (open-by-default)
- 86'd modifiers (blanket unavailability)
- Time / date / day-of-week / location filter combinations
- CRUD operations for availability rules
- get_available_modifiers group filtering
"""

import os
import uuid
from datetime import date, time
from unittest.mock import MagicMock

os.environ.setdefault("SECRET_KEY", "test-secret-key")


from app.services.modifier_availability_service import ModifierAvailabilityService


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

MOD_ID = str(uuid.uuid4())
GROUP_ID = str(uuid.uuid4())
LOC_A = str(uuid.uuid4())
LOC_B = str(uuid.uuid4())
RULE_ID = str(uuid.uuid4())


def _make_service():
    db = MagicMock()
    return ModifierAvailabilityService(db), db


def _chain(first=None, rows=None, count=0):
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    return c


def _rule(**kwargs):
    """Build a mock ModifierAvailability rule."""
    r = MagicMock()
    r.modifier_id = kwargs.get("modifier_id", MOD_ID)
    r.day_of_week = kwargs.get("day_of_week", None)
    r.start_time = kwargs.get("start_time", None)
    r.end_time = kwargs.get("end_time", None)
    r.start_date = kwargs.get("start_date", None)
    r.end_date = kwargs.get("end_date", None)
    r.location_id = kwargs.get("location_id", None)
    r.is_available = kwargs.get("is_available", True)
    r.deleted_at = None
    r.id = kwargs.get("id", uuid.uuid4())
    return r


def _modifier(**kwargs):
    """Build a mock Modifier object."""
    m = MagicMock()
    m.id = kwargs.get("id", uuid.uuid4())
    m.group_id = kwargs.get("group_id", GROUP_ID)
    m.name = kwargs.get("name", "Extra Cheese")
    m.is_available = kwargs.get("is_available", True)
    m.sort_order = kwargs.get("sort_order", 0)
    m.deleted_at = None
    return m


# ══════════════════════════════════════════════════════════════════════════════
# _rule_matches static method
# ══════════════════════════════════════════════════════════════════════════════

class TestRuleMatches:
    """Tests for the _rule_matches static helper."""

    def test_wildcard_rule_matches_everything(self):
        """A rule with all NULL filters matches any context."""
        rule = _rule()
        assert ModifierAvailabilityService._rule_matches(
            rule, time(12, 0), date(2025, 1, 6), 0, LOC_A
        ) is True

    def test_day_of_week_match(self):
        rule = _rule(day_of_week=0)  # Monday
        assert ModifierAvailabilityService._rule_matches(
            rule, time(12, 0), date(2025, 1, 6), 0, None
        ) is True

    def test_day_of_week_mismatch(self):
        rule = _rule(day_of_week=0)  # Monday
        assert ModifierAvailabilityService._rule_matches(
            rule, time(12, 0), date(2025, 1, 7), 1, None  # Tuesday
        ) is False

    def test_time_within_window(self):
        rule = _rule(start_time=time(9, 0), end_time=time(17, 0))
        assert ModifierAvailabilityService._rule_matches(
            rule, time(12, 0), date(2025, 1, 6), 0, None
        ) is True

    def test_time_before_window(self):
        rule = _rule(start_time=time(9, 0), end_time=time(17, 0))
        assert ModifierAvailabilityService._rule_matches(
            rule, time(8, 59), date(2025, 1, 6), 0, None
        ) is False

    def test_time_after_window(self):
        rule = _rule(start_time=time(9, 0), end_time=time(17, 0))
        assert ModifierAvailabilityService._rule_matches(
            rule, time(17, 1), date(2025, 1, 6), 0, None
        ) is False

    def test_date_within_range(self):
        rule = _rule(start_date=date(2025, 1, 1), end_date=date(2025, 3, 31))
        assert ModifierAvailabilityService._rule_matches(
            rule, time(12, 0), date(2025, 2, 15), 5, None
        ) is True

    def test_date_before_range(self):
        rule = _rule(start_date=date(2025, 1, 1), end_date=date(2025, 3, 31))
        assert ModifierAvailabilityService._rule_matches(
            rule, time(12, 0), date(2024, 12, 31), 1, None
        ) is False

    def test_date_after_range(self):
        rule = _rule(start_date=date(2025, 1, 1), end_date=date(2025, 3, 31))
        assert ModifierAvailabilityService._rule_matches(
            rule, time(12, 0), date(2025, 4, 1), 1, None
        ) is False

    def test_location_match(self):
        rule = _rule(location_id=LOC_A)
        assert ModifierAvailabilityService._rule_matches(
            rule, time(12, 0), date(2025, 1, 6), 0, LOC_A
        ) is True

    def test_location_mismatch(self):
        rule = _rule(location_id=LOC_A)
        assert ModifierAvailabilityService._rule_matches(
            rule, time(12, 0), date(2025, 1, 6), 0, LOC_B
        ) is False

    def test_location_rule_with_no_context_location(self):
        """Rule has a location filter but caller passes None → no match."""
        rule = _rule(location_id=LOC_A)
        assert ModifierAvailabilityService._rule_matches(
            rule, time(12, 0), date(2025, 1, 6), 0, None
        ) is False

    def test_combined_filters_all_match(self):
        rule = _rule(
            day_of_week=0,
            start_time=time(9, 0),
            end_time=time(17, 0),
            start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31),
            location_id=LOC_A,
        )
        assert ModifierAvailabilityService._rule_matches(
            rule, time(12, 0), date(2025, 1, 6), 0, LOC_A
        ) is True

    def test_combined_filters_one_mismatch(self):
        """All filters match except day_of_week → overall mismatch."""
        rule = _rule(
            day_of_week=0,
            start_time=time(9, 0),
            end_time=time(17, 0),
            location_id=LOC_A,
        )
        assert ModifierAvailabilityService._rule_matches(
            rule, time(12, 0), date(2025, 1, 7), 1, LOC_A  # Tuesday
        ) is False

    def test_time_at_exact_boundaries(self):
        """Edge: current_time exactly equals start_time and end_time."""
        rule = _rule(start_time=time(9, 0), end_time=time(17, 0))
        assert ModifierAvailabilityService._rule_matches(
            rule, time(9, 0), date(2025, 1, 6), 0, None
        ) is True
        assert ModifierAvailabilityService._rule_matches(
            rule, time(17, 0), date(2025, 1, 6), 0, None
        ) is True


# ══════════════════════════════════════════════════════════════════════════════
# check_availability
# ══════════════════════════════════════════════════════════════════════════════

class TestCheckAvailability:
    """Tests for check_availability logic."""

    def test_no_rules_means_available(self):
        svc, db = _make_service()
        db.query.return_value = _chain(rows=[])
        assert svc.check_availability(MOD_ID, time(12, 0), date(2025, 1, 6), 0) is True

    def test_matching_negative_rule_blocks(self):
        """A matching is_available=False rule makes modifier unavailable."""
        svc, db = _make_service()
        rule = _rule(is_available=False)
        db.query.return_value = _chain(rows=[rule])
        assert svc.check_availability(MOD_ID, time(12, 0), date(2025, 1, 6), 0) is False

    def test_non_matching_negative_rule_allows(self):
        """Negative rule for wrong day doesn't block."""
        svc, db = _make_service()
        rule = _rule(is_available=False, day_of_week=5)  # Saturday
        db.query.return_value = _chain(rows=[rule])
        # Monday check — rule doesn't match, only negative rules exist → available
        assert svc.check_availability(MOD_ID, time(12, 0), date(2025, 1, 6), 0) is True

    def test_positive_rule_matching(self):
        """A matching positive rule makes modifier available."""
        svc, db = _make_service()
        rule = _rule(is_available=True, start_time=time(9, 0), end_time=time(17, 0))
        db.query.return_value = _chain(rows=[rule])
        assert svc.check_availability(MOD_ID, time(12, 0), date(2025, 1, 6), 0) is True

    def test_positive_rule_not_matching_blocks(self):
        """Positive rules exist but none match → unavailable."""
        svc, db = _make_service()
        rule = _rule(is_available=True, start_time=time(9, 0), end_time=time(17, 0))
        db.query.return_value = _chain(rows=[rule])
        # 20:00 is outside the window
        assert svc.check_availability(MOD_ID, time(20, 0), date(2025, 1, 6), 0) is False

    def test_negative_rule_takes_priority_over_positive(self):
        """If a negative rule matches, unavailable — even if positive rules also exist."""
        svc, db = _make_service()
        pos_rule = _rule(is_available=True, start_time=time(9, 0), end_time=time(17, 0))
        neg_rule = _rule(is_available=False)  # blanket unavailability
        db.query.return_value = _chain(rows=[pos_rule, neg_rule])
        assert svc.check_availability(MOD_ID, time(12, 0), date(2025, 1, 6), 0) is False

    def test_location_scoped_negative_rule(self):
        """Negative rule for LOC_A doesn't block LOC_B."""
        svc, db = _make_service()
        rule = _rule(is_available=False, location_id=LOC_A)
        db.query.return_value = _chain(rows=[rule])
        assert svc.check_availability(
            MOD_ID, time(12, 0), date(2025, 1, 6), 0, location_id=LOC_B
        ) is True

    def test_defaults_to_current_time(self):
        """When no time/date/day args are given, uses datetime.now()."""
        svc, db = _make_service()
        db.query.return_value = _chain(rows=[])
        result = svc.check_availability(MOD_ID)
        assert result is True


# ══════════════════════════════════════════════════════════════════════════════
# get_available_modifiers
# ══════════════════════════════════════════════════════════════════════════════

class TestGetAvailableModifiers:
    """Tests for get_available_modifiers."""

    def test_returns_available_modifiers(self):
        svc, db = _make_service()
        mod1 = _modifier(id=uuid.uuid4(), name="Cheese")
        mod2 = _modifier(id=uuid.uuid4(), name="Bacon")

        # First query → modifier list; subsequent queries → no rules (available)
        call_count = [0]

        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[mod1, mod2])
            return _chain(rows=[])

        db.query.side_effect = side_effect

        result = svc.get_available_modifiers(GROUP_ID, time(12, 0), date(2025, 1, 6))
        assert len(result) == 2
        assert mod1 in result
        assert mod2 in result

    def test_filters_out_unavailable_modifier(self):
        svc, db = _make_service()
        mod1 = _modifier(id=uuid.uuid4(), name="Cheese")
        mod2 = _modifier(id=uuid.uuid4(), name="Bacon")
        neg_rule = _rule(modifier_id=str(mod2.id), is_available=False)

        call_count = [0]

        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[mod1, mod2])
            if call_count[0] == 2:
                # mod1 — no rules → available
                return _chain(rows=[])
            # mod2 — negative rule
            return _chain(rows=[neg_rule])

        db.query.side_effect = side_effect

        result = svc.get_available_modifiers(GROUP_ID, time(12, 0), date(2025, 1, 6))
        assert len(result) == 1
        assert result[0] is mod1

    def test_empty_group_returns_empty(self):
        svc, db = _make_service()
        db.query.return_value = _chain(rows=[])
        result = svc.get_available_modifiers(GROUP_ID, time(12, 0), date(2025, 1, 6))
        assert result == []


# ══════════════════════════════════════════════════════════════════════════════
# set_86d_status
# ══════════════════════════════════════════════════════════════════════════════

class TestSet86dStatus:
    """Tests for set_86d_status (create/update blanket unavailability)."""

    def test_creates_new_blanket_rule_when_none_exists(self):
        svc, db = _make_service()
        db.query.return_value = _chain(first=None)
        svc.set_86d_status(MOD_ID, is_86d=True)
        db.add.assert_called_once()
        db.commit.assert_called_once()
        added_rule = db.add.call_args[0][0]
        assert added_rule.is_available is False
        assert added_rule.modifier_id == MOD_ID

    def test_updates_existing_blanket_rule(self):
        svc, db = _make_service()
        existing = _rule(is_available=True)
        db.query.return_value = _chain(first=existing)
        svc.set_86d_status(MOD_ID, is_86d=True)
        assert existing.is_available is False
        db.commit.assert_called_once()

    def test_restore_sets_available_true(self):
        svc, db = _make_service()
        existing = _rule(is_available=False)
        db.query.return_value = _chain(first=existing)
        svc.set_86d_status(MOD_ID, is_86d=False)
        assert existing.is_available is True

    def test_location_scoped_86d(self):
        svc, db = _make_service()
        db.query.return_value = _chain(first=None)
        svc.set_86d_status(MOD_ID, is_86d=True, location_id=LOC_A)
        added_rule = db.add.call_args[0][0]
        assert added_rule.location_id == LOC_A


# ══════════════════════════════════════════════════════════════════════════════
# create_availability_rule
# ══════════════════════════════════════════════════════════════════════════════

class TestCreateAvailabilityRule:
    """Tests for create_availability_rule."""

    def test_creates_rule_with_all_fields(self):
        svc, db = _make_service()
        svc.create_availability_rule(
            modifier_id=MOD_ID,
            day_of_week=0,
            start_time=time(9, 0),
            end_time=time(17, 0),
            start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31),
            location_id=LOC_A,
            is_available=True,
        )
        db.add.assert_called_once()
        db.commit.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.modifier_id == MOD_ID
        assert added.day_of_week == 0
        assert added.start_time == time(9, 0)
        assert added.location_id == LOC_A
        assert added.is_available is True

    def test_creates_rule_with_defaults(self):
        svc, db = _make_service()
        svc.create_availability_rule(modifier_id=MOD_ID)
        added = db.add.call_args[0][0]
        assert added.day_of_week is None
        assert added.start_time is None
        assert added.end_time is None
        assert added.is_available is True


# ══════════════════════════════════════════════════════════════════════════════
# get_availability_rules
# ══════════════════════════════════════════════════════════════════════════════

class TestGetAvailabilityRules:
    """Tests for get_availability_rules."""

    def test_returns_rules_list(self):
        svc, db = _make_service()
        rules = [_rule(), _rule()]
        db.query.return_value = _chain(rows=rules)
        result = svc.get_availability_rules(MOD_ID)
        assert result == rules

    def test_returns_empty_when_no_rules(self):
        svc, db = _make_service()
        db.query.return_value = _chain(rows=[])
        assert svc.get_availability_rules(MOD_ID) == []


# ══════════════════════════════════════════════════════════════════════════════
# update_availability_rule
# ══════════════════════════════════════════════════════════════════════════════

class TestUpdateAvailabilityRule:
    """Tests for update_availability_rule."""

    def test_returns_none_when_not_found(self):
        svc, db = _make_service()
        db.query.return_value = _chain(first=None)
        assert svc.update_availability_rule(RULE_ID, is_available=False) is None

    def test_updates_fields(self):
        svc, db = _make_service()
        rule = _rule(is_available=True, day_of_week=0)
        rule.day_of_week = 0
        db.query.return_value = _chain(first=rule)
        svc.update_availability_rule(RULE_ID, day_of_week=3, is_available=False)
        assert rule.day_of_week == 3
        assert rule.is_available is False
        db.commit.assert_called_once()


# ══════════════════════════════════════════════════════════════════════════════
# delete_availability_rule
# ══════════════════════════════════════════════════════════════════════════════

class TestDeleteAvailabilityRule:
    """Tests for delete_availability_rule (soft delete)."""

    def test_soft_deletes_rule(self):
        svc, db = _make_service()
        rule = _rule()
        db.query.return_value = _chain(first=rule)
        assert svc.delete_availability_rule(RULE_ID) is True
        rule.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_returns_false_when_not_found(self):
        svc, db = _make_service()
        db.query.return_value = _chain(first=None)
        assert svc.delete_availability_rule(RULE_ID) is False


# ══════════════════════════════════════════════════════════════════════════════
# is_modifier_available (convenience wrapper)
# ══════════════════════════════════════════════════════════════════════════════

class TestIsModifierAvailable:
    """Tests for is_modifier_available wrapper."""

    def test_delegates_to_check_availability(self):
        svc, db = _make_service()
        db.query.return_value = _chain(rows=[])
        assert svc.is_modifier_available(MOD_ID, location_id=LOC_A) is True


# ══════════════════════════════════════════════════════════════════════════════
# eighty_six_modifier / un_eighty_six_modifier
# ══════════════════════════════════════════════════════════════════════════════

class TestEightySixModifier:
    """Tests for 86 / un-86 helpers."""

    def test_eighty_six_creates_blanket_unavailable(self):
        svc, db = _make_service()
        db.query.return_value = _chain(first=None)
        svc.eighty_six_modifier(MOD_ID)
        added = db.add.call_args[0][0]
        assert added.is_available is False

    def test_un_eighty_six_removes_blanket_rules(self):
        svc, db = _make_service()
        blanket_rule = _rule(is_available=False)
        db.query.return_value = _chain(rows=[blanket_rule])
        count = svc.un_eighty_six_modifier(MOD_ID)
        assert count == 1
        blanket_rule.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_un_eighty_six_no_rules_returns_zero(self):
        svc, db = _make_service()
        db.query.return_value = _chain(rows=[])
        assert svc.un_eighty_six_modifier(MOD_ID) == 0

    def test_un_eighty_six_location_scoped(self):
        svc, db = _make_service()
        rule = _rule(is_available=False, location_id=LOC_A)
        db.query.return_value = _chain(rows=[rule])
        count = svc.un_eighty_six_modifier(MOD_ID, location_id=LOC_A)
        assert count == 1
