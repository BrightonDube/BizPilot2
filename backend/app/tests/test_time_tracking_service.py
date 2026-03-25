"""Tests for TimeTrackingService."""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")

from datetime import datetime, date, time, timezone, timedelta
from decimal import Decimal
from unittest.mock import MagicMock
import pytest

from app.services.time_tracking_service import TimeTrackingService
from app.models.time_entry import TimeEntry, TimeEntryStatus
from app.models.business_time_settings import BusinessTimeSettings
from app.models.business_user import BusinessUser

BIZ_ID = "biz-001"
USR_ID = "usr-001"
USR_ID_2 = "usr-002"
ENTRY_ID = "entry-001"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _chain(first=None, rows=None, count=0):
    """Mock SQLAlchemy query chain."""
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


def _svc():
    """Return (service, mock_db) tuple."""
    db = MagicMock()
    return TimeTrackingService(db), db


def _settings(**overrides):
    """Return a mock BusinessTimeSettings."""
    s = MagicMock(spec=BusinessTimeSettings)
    s.business_id = BIZ_ID
    s.auto_clock_out_penalty_hours = Decimal("4.00")
    s.day_end_time = time(5, 0)
    s.day_end_time_str = "05:00"
    s.timezone = "Africa/Johannesburg"
    s.standard_work_hours = Decimal("8.00")
    s.overtime_threshold = Decimal("8.00")
    s.should_auto_clock_out = MagicMock(return_value=True)
    for k, v in overrides.items():
        setattr(s, k, v)
    return s


def _entry(**overrides):
    """Return a mock TimeEntry with sensible defaults."""
    e = MagicMock(spec=TimeEntry)
    e.id = ENTRY_ID
    e.business_id = BIZ_ID
    e.user_id = USR_ID
    e.clock_in = datetime(2025, 1, 10, 8, 0, 0, tzinfo=timezone.utc)
    e.clock_out = None
    e.break_start = None
    e.break_end = None
    e.break_duration = None
    e.hours_worked = None
    e.net_hours = None
    e.status = TimeEntryStatus.ACTIVE
    e.is_auto_clocked_out = False
    e.auto_clock_out_reason = None
    e.device_id = None
    e.location = None
    e.notes = None
    # Relationship mock
    user = MagicMock()
    user.id = USR_ID
    user.first_name = "Alice"
    user.last_name = "Smith"
    user.email = "alice@example.com"
    e.user = user
    for k, v in overrides.items():
        setattr(e, k, v)
    return e


def _side_effect(*chains):
    """Build db.query.side_effect from a sequence of _chain objects."""
    idx = [0]
    def _pick(*args):
        i = idx[0]
        idx[0] += 1
        if i < len(chains):
            return chains[i]
        return _chain()
    return _pick


# ===========================================================================
# get_or_create_business_settings
# ===========================================================================


class TestGetOrCreateBusinessSettings:
    def test_returns_existing_settings(self):
        svc, db = _svc()
        existing = _settings()
        db.query.return_value = _chain(first=existing)
        result = svc.get_or_create_business_settings(BIZ_ID)
        assert result is existing
        db.add.assert_not_called()

    def test_creates_settings_when_missing(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        svc.get_or_create_business_settings(BIZ_ID)
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()


# ===========================================================================
# clock_in
# ===========================================================================


class TestClockIn:
    def test_success(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)  # no active entry
        svc.clock_in(BIZ_ID, USR_ID)
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_with_device_and_location(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        svc.clock_in(BIZ_ID, USR_ID, device_id="POS-1", location="Main St")
        added = db.add.call_args[0][0]
        assert added.device_id == "POS-1"
        assert added.location == "Main St"

    def test_raises_when_already_clocked_in(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=_entry())
        with pytest.raises(ValueError, match="already clocked in"):
            svc.clock_in(BIZ_ID, USR_ID)


# ===========================================================================
# clock_out
# ===========================================================================


class TestClockOut:
    def test_success(self):
        svc, db = _svc()
        entry = _entry()
        # Allow attribute assignment on the mock
        entry.clock_out = None
        entry.status = TimeEntryStatus.ACTIVE
        db.query.return_value = _chain(first=entry)
        result = svc.clock_out(BIZ_ID, USR_ID)
        assert result is entry
        db.commit.assert_called_once()

    def test_raises_when_no_active_entry(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        with pytest.raises(ValueError, match="No active time entry"):
            svc.clock_out(BIZ_ID, USR_ID)

    def test_auto_clock_out_applies_penalty(self):
        svc, db = _svc()
        # Use a relative clock_in so actual hours (10h) exceed the penalty cap (4h)
        entry = _entry(clock_in=datetime.now(timezone.utc) - timedelta(hours=10))
        settings = _settings()
        # First query: find active entry; second query: find settings for auto-clock-out
        db.query.side_effect = _side_effect(
            _chain(first=entry),   # active entry lookup
            _chain(first=settings) # settings lookup in get_or_create_business_settings
        )
        svc.clock_out(BIZ_ID, USR_ID, auto_clock_out=True, reason="day end")
        assert entry.is_auto_clocked_out is True
        assert entry.auto_clock_out_reason == "day end"
        assert entry.hours_worked == Decimal("10.00")  # actual time worked
        assert entry.net_hours == Decimal("4.00")       # capped at penalty_hours

    def test_auto_clock_out_default_reason(self):
        svc, db = _svc()
        entry = _entry()
        settings = _settings()
        db.query.side_effect = _side_effect(
            _chain(first=entry),
            _chain(first=settings)
        )
        svc.clock_out(BIZ_ID, USR_ID, auto_clock_out=True)
        assert entry.auto_clock_out_reason == "Auto clocked out at day end"


# ===========================================================================
# start_break
# ===========================================================================


class TestStartBreak:
    def test_success(self):
        svc, db = _svc()
        entry = _entry(break_start=None)
        db.query.return_value = _chain(first=entry)
        result = svc.start_break(BIZ_ID, USR_ID)
        assert result is entry
        assert entry.break_start is not None
        db.commit.assert_called_once()

    def test_raises_when_no_active_entry(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        with pytest.raises(ValueError, match="No active time entry"):
            svc.start_break(BIZ_ID, USR_ID)

    def test_raises_when_break_already_started(self):
        svc, db = _svc()
        entry = _entry(break_start=datetime(2025, 1, 10, 12, 0, tzinfo=timezone.utc))
        db.query.return_value = _chain(first=entry)
        with pytest.raises(ValueError, match="Break already started"):
            svc.start_break(BIZ_ID, USR_ID)


# ===========================================================================
# end_break
# ===========================================================================


class TestEndBreak:
    def test_success(self):
        svc, db = _svc()
        entry = _entry(
            break_start=datetime(2025, 1, 10, 12, 0, tzinfo=timezone.utc),
            break_end=None,
            break_duration=None,
        )
        db.query.return_value = _chain(first=entry)
        result = svc.end_break(BIZ_ID, USR_ID)
        assert result is entry
        assert entry.break_end is not None
        db.commit.assert_called_once()

    def test_raises_when_no_active_entry(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        with pytest.raises(ValueError, match="No active time entry"):
            svc.end_break(BIZ_ID, USR_ID)

    def test_raises_when_no_break_started(self):
        svc, db = _svc()
        entry = _entry(break_start=None)
        db.query.return_value = _chain(first=entry)
        with pytest.raises(ValueError, match="No active break"):
            svc.end_break(BIZ_ID, USR_ID)

    def test_raises_when_break_already_ended(self):
        svc, db = _svc()
        entry = _entry(
            break_start=datetime(2025, 1, 10, 12, 0, tzinfo=timezone.utc),
            break_end=datetime(2025, 1, 10, 12, 30, tzinfo=timezone.utc),
        )
        db.query.return_value = _chain(first=entry)
        with pytest.raises(ValueError, match="Break already ended"):
            svc.end_break(BIZ_ID, USR_ID)


# ===========================================================================
# update_time_entry
# ===========================================================================


class TestUpdateTimeEntry:
    def test_raises_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        with pytest.raises(ValueError, match="Time entry not found"):
            svc.update_time_entry(ENTRY_ID)

    def test_updates_fields(self):
        svc, db = _svc()
        entry = _entry(
            clock_in=datetime(2025, 1, 10, 8, 0, tzinfo=timezone.utc),
            clock_out=datetime(2025, 1, 10, 16, 0, tzinfo=timezone.utc),
            break_start=None,
            break_end=None,
            break_duration=None,
            hours_worked=None,
            net_hours=None,
        )
        db.query.return_value = _chain(first=entry)
        new_in = datetime(2025, 1, 10, 7, 0, tzinfo=timezone.utc)
        new_out = datetime(2025, 1, 10, 15, 0, tzinfo=timezone.utc)
        svc.update_time_entry(ENTRY_ID, clock_in=new_in, clock_out=new_out, notes="corrected")
        assert entry.clock_in == new_in
        assert entry.clock_out == new_out
        assert entry.notes == "corrected"
        db.commit.assert_called_once()

    def test_updates_break_duration(self):
        svc, db = _svc()
        entry = _entry(
            clock_in=datetime(2025, 1, 10, 8, 0, tzinfo=timezone.utc),
            clock_out=datetime(2025, 1, 10, 16, 0, tzinfo=timezone.utc),
            break_start=None,
            break_end=None,
            break_duration=None,
            hours_worked=None,
            net_hours=None,
        )
        db.query.return_value = _chain(first=entry)
        svc.update_time_entry(ENTRY_ID, break_duration=Decimal("1.00"))
        assert entry.break_duration == Decimal("1.00")


# ===========================================================================
# get_user_time_entries
# ===========================================================================


class TestGetUserTimeEntries:
    def test_no_filters(self):
        svc, db = _svc()
        entries = [_entry(), _entry()]
        db.query.return_value = _chain(rows=entries)
        result = svc.get_user_time_entries(BIZ_ID, USR_ID)
        assert len(result) == 2

    def test_with_date_filters(self):
        svc, db = _svc()
        chain = _chain(rows=[_entry()])
        db.query.return_value = chain
        result = svc.get_user_time_entries(
            BIZ_ID, USR_ID,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 31),
        )
        assert len(result) == 1
        # filter called multiple times: base filter + start_date + end_date
        assert chain.filter.call_count >= 1

    def test_empty_result(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        result = svc.get_user_time_entries(BIZ_ID, USR_ID)
        assert result == []


# ===========================================================================
# get_team_time_entries
# ===========================================================================


class TestGetTeamTimeEntries:
    def test_groups_by_user(self):
        svc, db = _svc()
        e1 = _entry(user_id=USR_ID)
        e2 = _entry(user_id=USR_ID)
        e3 = _entry(user_id=USR_ID_2)
        db.query.return_value = _chain(rows=[e1, e2, e3])
        result = svc.get_team_time_entries(BIZ_ID)
        assert USR_ID in result
        assert USR_ID_2 in result
        assert len(result[USR_ID]) == 2
        assert len(result[USR_ID_2]) == 1

    def test_empty(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        result = svc.get_team_time_entries(BIZ_ID)
        assert result == {}

    def test_with_date_filters(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain
        svc.get_team_time_entries(BIZ_ID, start_date=date(2025, 1, 1), end_date=date(2025, 1, 31))
        assert chain.filter.call_count >= 1


# ===========================================================================
# get_payroll_report
# ===========================================================================


class TestGetPayrollReport:
    def test_aggregates_per_user(self):
        svc, db = _svc()

        user_mock = MagicMock()
        user_mock.id = USR_ID
        user_mock.first_name = "Alice"
        user_mock.last_name = "Smith"
        user_mock.email = "alice@example.com"

        bu = MagicMock(spec=BusinessUser)
        bu.user = user_mock

        completed_entry = _entry(
            clock_out=datetime(2025, 1, 10, 16, 0, tzinfo=timezone.utc),
            hours_worked=Decimal("8.00"),
            break_duration=Decimal("0.50"),
            net_hours=Decimal("7.50"),
            status=TimeEntryStatus.COMPLETED,
        )

        # query 1: business_users, query 2+: user time entries
        db.query.side_effect = _side_effect(
            _chain(rows=[bu]),           # BusinessUser query
            _chain(rows=[completed_entry]),  # TimeEntry query for user
        )
        report = svc.get_payroll_report(BIZ_ID, date(2025, 1, 1), date(2025, 1, 31))
        assert len(report) == 1
        assert report[0]["user_id"] == USR_ID
        assert report[0]["total_hours"] == 8.0
        assert report[0]["break_hours"] == 0.5
        assert report[0]["net_hours"] == 7.5
        assert report[0]["entries"] == 1

    def test_empty_when_no_users(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        report = svc.get_payroll_report(BIZ_ID, date(2025, 1, 1), date(2025, 1, 31))
        assert report == []


# ===========================================================================
# run_day_end_process
# ===========================================================================


class TestRunDayEndProcess:
    def test_force_clocks_out_active(self):
        svc, db = _svc()
        settings = _settings()
        active = _entry()

        call_idx = [0]
        def side_effect(*args):
            call_idx[0] += 1
            if call_idx[0] == 1:
                # settings lookup
                return _chain(first=settings)
            if call_idx[0] == 2:
                # active entries
                return _chain(rows=[active])
            if call_idx[0] == 3:
                # clock_out -> find active entry
                return _chain(first=active)
            if call_idx[0] == 4:
                # clock_out -> get_or_create_business_settings
                return _chain(first=settings)
            return _chain()
        db.query.side_effect = side_effect

        result = svc.run_day_end_process(BIZ_ID, force=True)
        assert result["auto_clocked_out"] == 1
        assert "penalty_hours" in result

    def test_no_active_entries(self):
        svc, db = _svc()
        settings = _settings()
        db.query.side_effect = _side_effect(
            _chain(first=settings),  # settings
            _chain(rows=[]),         # active entries
        )
        result = svc.run_day_end_process(BIZ_ID, force=True)
        assert result["auto_clocked_out"] == 0

    def test_skips_when_not_time(self):
        svc, db = _svc()
        settings = _settings()
        settings.should_auto_clock_out.return_value = False
        db.query.return_value = _chain(first=settings)

        result = svc.run_day_end_process(BIZ_ID, force=False)
        assert result["auto_clocked_out"] == 0
        assert "Not yet time" in result["message"]


# ===========================================================================
# get_currently_working_users
# ===========================================================================


class TestGetCurrentlyWorkingUsers:
    def test_returns_active_users(self):
        svc, db = _svc()
        entry = _entry(clock_in=datetime.now(timezone.utc) - timedelta(hours=2))
        db.query.return_value = _chain(rows=[entry])
        result = svc.get_currently_working_users(BIZ_ID)
        assert len(result) == 1
        assert result[0]["user_id"] == USR_ID
        assert result[0]["name"] == "Alice Smith"
        assert result[0]["on_break"] is False

    def test_on_break_flag(self):
        svc, db = _svc()
        entry = _entry(
            clock_in=datetime.now(timezone.utc) - timedelta(hours=2),
            break_start=datetime.now(timezone.utc) - timedelta(minutes=10),
            break_end=None,
        )
        db.query.return_value = _chain(rows=[entry])
        result = svc.get_currently_working_users(BIZ_ID)
        assert result[0]["on_break"] is True

    def test_empty(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        result = svc.get_currently_working_users(BIZ_ID)
        assert result == []


# ===========================================================================
# _calculate_hours  (private but important)
# ===========================================================================


class TestCalculateHours:
    def test_basic_8_hour_day(self):
        svc, _ = _svc()
        entry = _entry(
            clock_in=datetime(2025, 1, 10, 8, 0, tzinfo=timezone.utc),
            clock_out=datetime(2025, 1, 10, 16, 0, tzinfo=timezone.utc),
            break_start=None,
            break_end=None,
            break_duration=None,
            hours_worked=None,
            net_hours=None,
        )
        svc._calculate_hours(entry)
        assert entry.hours_worked == Decimal("8.00")
        assert entry.net_hours == Decimal("8.00")

    def test_with_break(self):
        svc, _ = _svc()
        entry = _entry(
            clock_in=datetime(2025, 1, 10, 8, 0, tzinfo=timezone.utc),
            clock_out=datetime(2025, 1, 10, 16, 0, tzinfo=timezone.utc),
            break_start=datetime(2025, 1, 10, 12, 0, tzinfo=timezone.utc),
            break_end=datetime(2025, 1, 10, 13, 0, tzinfo=timezone.utc),
            break_duration=None,
            hours_worked=None,
            net_hours=None,
        )
        svc._calculate_hours(entry)
        assert entry.hours_worked == Decimal("8.00")
        assert entry.break_duration == Decimal("1.00")
        assert entry.net_hours == Decimal("7.00")

    def test_no_clock_out_noop(self):
        svc, _ = _svc()
        entry = _entry(clock_out=None, hours_worked=None, net_hours=None)
        svc._calculate_hours(entry)
        assert entry.hours_worked is None

    def test_with_preset_break_duration(self):
        svc, _ = _svc()
        entry = _entry(
            clock_in=datetime(2025, 1, 10, 8, 0, tzinfo=timezone.utc),
            clock_out=datetime(2025, 1, 10, 16, 0, tzinfo=timezone.utc),
            break_start=None,
            break_end=None,
            break_duration=Decimal("0.50"),
            hours_worked=None,
            net_hours=None,
        )
        svc._calculate_hours(entry)
        assert entry.hours_worked == Decimal("8.00")
        assert entry.net_hours == Decimal("7.50")


# ===========================================================================
# _calculate_break_duration
# ===========================================================================


class TestCalculateBreakDuration:
    def test_30_min_break(self):
        svc, _ = _svc()
        entry = _entry(
            break_start=datetime(2025, 1, 10, 12, 0, tzinfo=timezone.utc),
            break_end=datetime(2025, 1, 10, 12, 30, tzinfo=timezone.utc),
            break_duration=None,
        )
        svc._calculate_break_duration(entry)
        assert entry.break_duration == Decimal("0.50")

    def test_no_break_noop(self):
        svc, _ = _svc()
        entry = _entry(break_start=None, break_end=None, break_duration=None)
        svc._calculate_break_duration(entry)
        assert entry.break_duration is None


# ===========================================================================
# _calculate_current_hours
# ===========================================================================


class TestCalculateCurrentHours:
    def test_active_entry(self):
        svc, _ = _svc()
        entry = _entry(
            clock_in=datetime.now(timezone.utc) - timedelta(hours=3),
            break_start=None,
            break_end=None,
        )
        hours = svc._calculate_current_hours(entry)
        # Should be approximately 3 hours (allow small delta for execution time)
        assert Decimal("2.95") <= hours <= Decimal("3.10")

    def test_with_completed_break(self):
        svc, _ = _svc()
        now = datetime.now(timezone.utc)
        entry = _entry(
            clock_in=now - timedelta(hours=4),
            break_start=now - timedelta(hours=2),
            break_end=now - timedelta(hours=1),
        )
        hours = svc._calculate_current_hours(entry)
        # 4 hours total - 1 hour break = ~3 hours
        assert Decimal("2.95") <= hours <= Decimal("3.10")

    def test_currently_on_break(self):
        svc, _ = _svc()
        now = datetime.now(timezone.utc)
        entry = _entry(
            clock_in=now - timedelta(hours=2),
            break_start=now - timedelta(hours=1),
            break_end=None,
        )
        hours = svc._calculate_current_hours(entry)
        # 2 hours total - 1 hour on break = ~1 hour
        assert Decimal("0.95") <= hours <= Decimal("1.10")

    def test_no_clock_in(self):
        svc, _ = _svc()
        entry = _entry(clock_in=None)
        hours = svc._calculate_current_hours(entry)
        assert hours == Decimal("0")
