"""Modifier availability service.

Determines whether modifiers are currently available based on time,
day, date, and location rules (Requirement 6 of the addons-modifiers
spec).  Also supports "86'd" status — a restaurant industry term for
temporarily marking an item as unavailable.

Why check availability at query time instead of pre-computing?
Availability rules involve time-of-day checks that change minute by
minute.  Pre-computing would require frequent background jobs.  Since
the rule set per modifier is small (typically 1-3 rows), runtime
evaluation is fast enough for real-time POS use.
"""

from datetime import date, datetime, time
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.menu import Modifier
from app.models.modifier_availability import ModifierAvailability


class ModifierAvailabilityService:
    """Checks and manages modifier availability rules."""

    def __init__(self, db: Session):
        self.db = db

    # ── Query Methods ────────────────────────────────────────────

    def check_availability(
        self,
        modifier_id: str,
        current_time: Optional[time] = None,
        current_date: Optional[date] = None,
        current_day_of_week: Optional[int] = None,
        location_id: Optional[str] = None,
    ) -> bool:
        """Check whether a specific modifier is available right now.

        If the modifier has no availability rules at all, it is
        considered always available (open by default).

        If any rule explicitly marks it as unavailable (is_available=False)
        and matches the current context, the modifier is unavailable.

        Args:
            modifier_id: UUID of the modifier to check.
            current_time: Current time (defaults to now).
            current_date: Current date (defaults to today).
            current_day_of_week: ISO day (0=Mon .. 6=Sun; auto-derived).
            location_id: Optional location to check against.

        Returns:
            True if the modifier is available, False otherwise.
        """
        now = datetime.now()
        if current_time is None:
            current_time = now.time()
        if current_date is None:
            current_date = now.date()
        if current_day_of_week is None:
            # Python: Monday=0 matches ISO 8601
            current_day_of_week = current_date.weekday()

        rules = (
            self.db.query(ModifierAvailability)
            .filter(
                ModifierAvailability.modifier_id == modifier_id,
                ModifierAvailability.deleted_at.is_(None),
            )
            .all()
        )

        # No rules means always available (open-by-default policy).
        if not rules:
            return True

        for rule in rules:
            if self._rule_matches(rule, current_time, current_date, current_day_of_week, location_id):
                # A matching rule that says "not available" means 86'd.
                if not rule.is_available:
                    return False

        # If we have rules but none explicitly blocked, check if there
        # are any positive rules.  If positive rules exist and none
        # matched, the modifier is outside its availability window.
        positive_rules = [r for r in rules if r.is_available]
        if positive_rules:
            # At least one positive rule must match for availability.
            for rule in positive_rules:
                if self._rule_matches(rule, current_time, current_date, current_day_of_week, location_id):
                    return True
            # No positive rule matched → not available
            return False

        # Only negative rules exist and none matched → available
        return True

    def get_available_modifiers(
        self,
        group_id: str,
        current_time: Optional[time] = None,
        current_date: Optional[date] = None,
        location_id: Optional[str] = None,
    ) -> List[Modifier]:
        """Get all currently available modifiers in a group.

        Filters out modifiers that are:
        1. Soft-deleted
        2. Marked as not available (is_available=False on modifier)
        3. Outside their availability window (via rules)
        """
        modifiers = (
            self.db.query(Modifier)
            .filter(
                Modifier.group_id == group_id,
                Modifier.deleted_at.is_(None),
                Modifier.is_available.is_(True),
            )
            .order_by(Modifier.sort_order.asc())
            .all()
        )

        available = []
        for mod in modifiers:
            if self.check_availability(
                str(mod.id),
                current_time=current_time,
                current_date=current_date,
                location_id=location_id,
            ):
                available.append(mod)
        return available

    # ── Mutation Methods ─────────────────────────────────────────

    def set_86d_status(
        self,
        modifier_id: str,
        is_86d: bool,
        location_id: Optional[str] = None,
    ) -> ModifierAvailability:
        """Mark a modifier as 86'd (temporarily unavailable) or restore it.

        This creates or updates a blanket "not available" rule with no
        time/day/date constraints, effectively overriding all other rules.

        Args:
            modifier_id: UUID of the modifier.
            is_86d: True to mark as unavailable, False to restore.
            location_id: Optional location scope. NULL = all locations.

        Returns:
            The created or updated ModifierAvailability rule.
        """
        # Look for an existing blanket rule (no time/day/date filters)
        existing = (
            self.db.query(ModifierAvailability)
            .filter(
                ModifierAvailability.modifier_id == modifier_id,
                ModifierAvailability.day_of_week.is_(None),
                ModifierAvailability.start_time.is_(None),
                ModifierAvailability.end_time.is_(None),
                ModifierAvailability.start_date.is_(None),
                ModifierAvailability.end_date.is_(None),
                ModifierAvailability.deleted_at.is_(None),
            )
        )
        if location_id:
            existing = existing.filter(ModifierAvailability.location_id == location_id)
        else:
            existing = existing.filter(ModifierAvailability.location_id.is_(None))
        existing = existing.first()

        if existing:
            existing.is_available = not is_86d
            self.db.commit()
            self.db.refresh(existing)
            return existing

        rule = ModifierAvailability(
            modifier_id=modifier_id,
            is_available=not is_86d,
            location_id=location_id,
        )
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def create_availability_rule(
        self,
        modifier_id: str,
        day_of_week: Optional[int] = None,
        start_time: Optional[time] = None,
        end_time: Optional[time] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        location_id: Optional[str] = None,
        is_available: bool = True,
    ) -> ModifierAvailability:
        """Create a new availability rule for a modifier."""
        rule = ModifierAvailability(
            modifier_id=modifier_id,
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
            start_date=start_date,
            end_date=end_date,
            location_id=location_id,
            is_available=is_available,
        )
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def get_availability_rules(self, modifier_id: str) -> List[ModifierAvailability]:
        """List all availability rules for a modifier."""
        return (
            self.db.query(ModifierAvailability)
            .filter(
                ModifierAvailability.modifier_id == modifier_id,
                ModifierAvailability.deleted_at.is_(None),
            )
            .all()
        )

    def update_availability_rule(
        self, rule_id: str, **kwargs
    ) -> Optional[ModifierAvailability]:
        """Update an existing availability rule.  Only provided fields change."""
        rule = (
            self.db.query(ModifierAvailability)
            .filter(
                ModifierAvailability.id == rule_id,
                ModifierAvailability.deleted_at.is_(None),
            )
            .first()
        )
        if not rule:
            return None
        for field, value in kwargs.items():
            if hasattr(rule, field):
                setattr(rule, field, value)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def delete_availability_rule(self, rule_id: str) -> bool:
        """Soft-delete an availability rule."""
        rule = (
            self.db.query(ModifierAvailability)
            .filter(
                ModifierAvailability.id == rule_id,
                ModifierAvailability.deleted_at.is_(None),
            )
            .first()
        )
        if not rule:
            return False
        rule.soft_delete()
        self.db.commit()
        return True

    # ── Private Helpers ──────────────────────────────────────────

    def is_modifier_available(
        self,
        modifier_id: str,
        location_id: Optional[str] = None,
    ) -> bool:
        """Convenience wrapper: check availability using current time.

        This is what the API endpoint calls for real-time checks.
        """
        return self.check_availability(
            modifier_id=modifier_id,
            location_id=location_id,
        )

    def eighty_six_modifier(
        self,
        modifier_id: str,
        location_id: Optional[str] = None,
    ) -> ModifierAvailability:
        """Mark a modifier as 86'd (out of stock)."""
        return self.set_86d_status(
            modifier_id=modifier_id,
            is_86d=True,
            location_id=location_id,
        )

    def un_eighty_six_modifier(
        self,
        modifier_id: str,
        location_id: Optional[str] = None,
    ) -> int:
        """Remove 86'd status from a modifier.

        Deletes any blanket unavailability rules (no time/date filters).

        Returns:
            Number of rules removed.
        """
        query = self.db.query(ModifierAvailability).filter(
            ModifierAvailability.modifier_id == modifier_id,
            ModifierAvailability.is_available.is_(False),
            ModifierAvailability.day_of_week.is_(None),
            ModifierAvailability.start_time.is_(None),
            ModifierAvailability.end_time.is_(None),
            ModifierAvailability.start_date.is_(None),
            ModifierAvailability.end_date.is_(None),
            ModifierAvailability.deleted_at.is_(None),
        )
        if location_id:
            query = query.filter(ModifierAvailability.location_id == location_id)
        else:
            query = query.filter(ModifierAvailability.location_id.is_(None))

        rules = query.all()
        count = len(rules)
        for rule in rules:
            rule.soft_delete()
        self.db.commit()
        return count

    # ── Private Helpers (rule matching) ──────────────────────────

    @staticmethod
    def _rule_matches(
        rule: ModifierAvailability,
        current_time: time,
        current_date: date,
        current_day_of_week: int,
        location_id: Optional[str],
    ) -> bool:
        """Check whether a single availability rule matches the current context.

        A rule matches if ALL of its non-null filters match.  Null
        filters are treated as wildcards (match everything).
        """
        # Day of week filter
        if rule.day_of_week is not None and rule.day_of_week != current_day_of_week:
            return False

        # Time window filter
        if rule.start_time is not None and current_time < rule.start_time:
            return False
        if rule.end_time is not None and current_time > rule.end_time:
            return False

        # Date range filter
        if rule.start_date is not None and current_date < rule.start_date:
            return False
        if rule.end_date is not None and current_date > rule.end_date:
            return False

        # Location filter
        if rule.location_id is not None:
            if location_id is None or str(rule.location_id) != str(location_id):
                return False

        return True
