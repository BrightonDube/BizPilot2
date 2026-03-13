"""Unit tests for TimeEntryService."""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import datetime, date
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.models.time_entry import TimeEntry, TimeEntryType, TimeEntryStatus
from app.models.user import User
from app.services.time_entry_service import TimeEntryService

USER = str(uuid4())
BIZ = str(uuid4())
ENTRY_ID = str(uuid4())
APPROVER_ID = str(uuid4())


def _svc():
    db = MagicMock()
    return TimeEntryService(db), db


def _chain(first=None, rows=None, count=0, scalar=0):
    """Reusable mock supporting SQLAlchemy chained-call pattern."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.outerjoin.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.group_by.return_value = c
    c.with_entities.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = scalar
    return c


def _mock_entry(**kw):
    e = MagicMock(spec=TimeEntry)
    e.id = kw.get("id", uuid4())
    e.user_id = kw.get("user_id", USER)
    e.business_id = kw.get("business_id", BIZ)
    e.entry_type = kw.get("entry_type", TimeEntryType.CLOCK_IN)
    e.clock_in = kw.get("clock_in", datetime(2025, 1, 15, 8, 0, 0))
    e.clock_out = kw.get("clock_out", None)
    e.break_start = kw.get("break_start", None)
    e.break_end = kw.get("break_end", None)
    e.break_duration = kw.get("break_duration", None)
    e.hours_worked = kw.get("hours_worked", None)
    e.status = kw.get("status", TimeEntryStatus.ACTIVE)
    e.notes = kw.get("notes", None)
    e.device_id = kw.get("device_id", None)
    e.ip_address = kw.get("ip_address", None)
    e.location = kw.get("location", None)
    e.approved_by_id = kw.get("approved_by_id", None)
    e.approved_at = kw.get("approved_at", None)
    e.rejection_reason = kw.get("rejection_reason", None)
    e.deleted_at = None
    return e


def _mock_user(**kw):
    u = MagicMock(spec=User)
    u.id = kw.get("id", USER)
    u.full_name = kw.get("full_name", "John Doe")
    u.email = kw.get("email", "john@example.com")
    return u


# ── get_active_entry ─────────────────────────────────────────────


class TestGetActiveEntry:
    def test_returns_active_entry(self):
        svc, db = _svc()
        entry = _mock_entry(status=TimeEntryStatus.ACTIVE)
        db.query.return_value = _chain(first=entry)

        result = svc.get_active_entry(USER, BIZ)
        assert result is entry
        db.query.assert_called_once_with(TimeEntry)

    def test_returns_none_when_no_active(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.get_active_entry(USER, BIZ)
        assert result is None


# ── clock_in ─────────────────────────────────────────────────────


class TestClockIn:
    @patch.object(TimeEntryService, "get_active_entry", return_value=None)
    def test_clock_in_success(self, mock_active):
        svc, db = _svc()

        svc.clock_in(
            USER, BIZ,
            device_id="dev-1",
            ip_address="1.2.3.4",
            location="Office",
            notes="Morning shift",
        )
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    @patch.object(TimeEntryService, "get_active_entry")
    def test_clock_in_raises_when_already_active(self, mock_active):
        mock_active.return_value = _mock_entry()
        svc, db = _svc()

        with pytest.raises(ValueError, match="Already clocked in"):
            svc.clock_in(USER, BIZ)
        db.add.assert_not_called()

    @patch.object(TimeEntryService, "get_active_entry", return_value=None)
    def test_clock_in_optional_fields_default_none(self, mock_active):
        svc, db = _svc()
        svc.clock_in(USER, BIZ)
        added = db.add.call_args[0][0]
        assert added.device_id is None
        assert added.ip_address is None
        assert added.location is None
        assert added.notes is None


# ── clock_out ────────────────────────────────────────────────────


class TestClockOut:
    @patch.object(TimeEntryService, "get_active_entry")
    def test_clock_out_success(self, mock_active):
        entry = _mock_entry()
        entry.calculate_hours = MagicMock(return_value=Decimal("8.00"))
        entry.notes = None
        mock_active.return_value = entry
        svc, db = _svc()

        result = svc.clock_out(USER, BIZ)
        assert result is entry
        assert entry.status == TimeEntryStatus.COMPLETED
        assert entry.clock_out is not None
        assert entry.hours_worked == Decimal("8.00")
        db.commit.assert_called_once()

    @patch.object(TimeEntryService, "get_active_entry", return_value=None)
    def test_clock_out_raises_when_not_clocked_in(self, mock_active):
        svc, db = _svc()

        with pytest.raises(ValueError, match="Not currently clocked in"):
            svc.clock_out(USER, BIZ)

    @patch.object(TimeEntryService, "get_active_entry")
    def test_clock_out_appends_notes(self, mock_active):
        entry = _mock_entry(notes="Existing note")
        entry.calculate_hours = MagicMock(return_value=Decimal("4.00"))
        mock_active.return_value = entry
        svc, db = _svc()

        svc.clock_out(USER, BIZ, notes="Goodbye")
        assert "[Clock Out] Goodbye" in entry.notes
        assert "Existing note" in entry.notes

    @patch.object(TimeEntryService, "get_active_entry")
    def test_clock_out_notes_on_empty_existing(self, mock_active):
        entry = _mock_entry(notes=None)
        entry.calculate_hours = MagicMock(return_value=Decimal("1.00"))
        mock_active.return_value = entry
        svc, db = _svc()

        svc.clock_out(USER, BIZ, notes="Done")
        assert entry.notes == "[Clock Out] Done"


# ── start_break ──────────────────────────────────────────────────


class TestStartBreak:
    @patch.object(TimeEntryService, "get_active_entry")
    def test_start_break_success(self, mock_active):
        entry = _mock_entry(break_start=None, break_end=None)
        mock_active.return_value = entry
        svc, db = _svc()

        result = svc.start_break(USER, BIZ)
        assert result is entry
        assert entry.break_start is not None
        db.commit.assert_called_once()

    @patch.object(TimeEntryService, "get_active_entry", return_value=None)
    def test_start_break_raises_when_not_clocked_in(self, mock_active):
        svc, db = _svc()
        with pytest.raises(ValueError, match="Not currently clocked in"):
            svc.start_break(USER, BIZ)

    @patch.object(TimeEntryService, "get_active_entry")
    def test_start_break_raises_when_already_on_break(self, mock_active):
        entry = _mock_entry(
            break_start=datetime(2025, 1, 15, 12, 0, 0),
            break_end=None,
        )
        mock_active.return_value = entry
        svc, db = _svc()

        with pytest.raises(ValueError, match="Already on break"):
            svc.start_break(USER, BIZ)


# ── end_break ────────────────────────────────────────────────────


class TestEndBreak:
    @patch.object(TimeEntryService, "get_active_entry")
    def test_end_break_success(self, mock_active):
        entry = _mock_entry(
            break_start=datetime(2025, 1, 15, 12, 0, 0),
            break_end=None,
            break_duration=None,
        )
        mock_active.return_value = entry
        svc, db = _svc()

        result = svc.end_break(USER, BIZ)
        assert result is entry
        assert entry.break_end is not None
        assert entry.break_duration is not None
        db.commit.assert_called_once()

    @patch.object(TimeEntryService, "get_active_entry", return_value=None)
    def test_end_break_raises_when_not_clocked_in(self, mock_active):
        svc, db = _svc()
        with pytest.raises(ValueError, match="Not currently clocked in"):
            svc.end_break(USER, BIZ)

    @patch.object(TimeEntryService, "get_active_entry")
    def test_end_break_raises_when_not_on_break(self, mock_active):
        entry = _mock_entry(break_start=None, break_end=None)
        mock_active.return_value = entry
        svc, db = _svc()

        with pytest.raises(ValueError, match="Not currently on break"):
            svc.end_break(USER, BIZ)

    @patch.object(TimeEntryService, "get_active_entry")
    def test_end_break_raises_when_break_already_ended(self, mock_active):
        entry = _mock_entry(
            break_start=datetime(2025, 1, 15, 12, 0, 0),
            break_end=datetime(2025, 1, 15, 12, 30, 0),
        )
        mock_active.return_value = entry
        svc, db = _svc()

        with pytest.raises(ValueError, match="Break already ended"):
            svc.end_break(USER, BIZ)

    @patch.object(TimeEntryService, "get_active_entry")
    def test_end_break_accumulates_duration(self, mock_active):
        entry = _mock_entry(
            break_start=datetime(2025, 1, 15, 12, 0, 0),
            break_end=None,
            break_duration=Decimal("0.50"),
        )
        mock_active.return_value = entry
        svc, db = _svc()

        svc.end_break(USER, BIZ)
        # Should add new break time on top of existing 0.50
        assert entry.break_duration > Decimal("0.50")


# ── get_entries ───────────────────────────────────────────────────


class TestGetEntries:
    def test_basic_list(self):
        svc, db = _svc()
        entries = [_mock_entry(), _mock_entry()]
        db.query.return_value = _chain(rows=entries, count=2)

        result, total = svc.get_entries(BIZ)
        assert len(result) == 2
        assert total == 2

    def test_filters_by_user_id(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_entries(BIZ, user_id=USER)
        # filter called at least twice (base + user_id)
        assert chain.filter.call_count >= 2

    def test_filters_by_date_range(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_entries(
            BIZ,
            date_from=date(2025, 1, 1),
            date_to=date(2025, 1, 31),
        )
        # base filter + date_from + date_to
        assert chain.filter.call_count >= 3

    def test_filters_by_status(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_entries(BIZ, status=TimeEntryStatus.COMPLETED)
        assert chain.filter.call_count >= 2

    def test_pagination(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=10)
        db.query.return_value = chain

        svc.get_entries(BIZ, page=2, per_page=5)
        chain.offset.assert_called_once_with(5)
        chain.limit.assert_called_once_with(5)


# ── get_user_summary ─────────────────────────────────────────────


class TestGetUserSummary:
    def test_summary_with_entries(self):
        svc, db = _svc()
        e1 = _mock_entry(
            hours_worked=Decimal("8.00"),
            break_duration=Decimal("0.50"),
            clock_in=datetime(2025, 1, 15, 8, 0, 0),
        )
        e2 = _mock_entry(
            hours_worked=Decimal("7.50"),
            break_duration=Decimal("0.25"),
            clock_in=datetime(2025, 1, 16, 8, 0, 0),
        )
        db.query.return_value = _chain(rows=[e1, e2])

        result = svc.get_user_summary(
            USER, BIZ,
            date_from=date(2025, 1, 1),
            date_to=date(2025, 1, 31),
        )
        assert result["total_hours"] == 15.5
        assert result["total_break_hours"] == 0.75
        assert result["days_worked"] == 2
        assert result["entries_count"] == 2
        assert result["average_hours_per_day"] == pytest.approx(7.75)

    def test_summary_empty(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])

        result = svc.get_user_summary(
            USER, BIZ,
            date_from=date(2025, 1, 1),
            date_to=date(2025, 1, 31),
        )
        assert result["total_hours"] == 0
        assert result["days_worked"] == 0
        assert result["average_hours_per_day"] == 0


# ── get_payroll_report ───────────────────────────────────────────


class TestGetPayrollReport:
    def test_payroll_report(self):
        svc, db = _svc()
        user_id = uuid4()
        user = _mock_user(id=user_id, full_name="Jane Doe", email="jane@test.com")

        agg_row = MagicMock()
        agg_row.user_id = user_id
        agg_row.total_hours = Decimal("40.00")
        agg_row.total_breaks = Decimal("2.50")
        agg_row.entries_count = 5

        agg_chain = _chain(rows=[agg_row])
        user_chain = _chain(first=user)

        call_counter = {"n": 0}
        chains = [agg_chain, user_chain]

        def query_side_effect(*args, **kwargs):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[idx]

        db.query.side_effect = query_side_effect

        report = svc.get_payroll_report(
            BIZ,
            date_from=date(2025, 1, 1),
            date_to=date(2025, 1, 31),
        )
        assert len(report) == 1
        assert report[0]["user_name"] == "Jane Doe"
        assert report[0]["total_hours"] == 40.0
        assert report[0]["total_break_hours"] == 2.5
        assert report[0]["entries_count"] == 5

    def test_payroll_report_user_not_found(self):
        svc, db = _svc()
        agg_row = MagicMock()
        agg_row.user_id = uuid4()
        agg_row.total_hours = Decimal("10.00")
        agg_row.total_breaks = None
        agg_row.entries_count = 2

        agg_chain = _chain(rows=[agg_row])
        user_chain = _chain(first=None)

        call_counter = {"n": 0}
        chains = [agg_chain, user_chain]

        def query_side_effect(*args, **kwargs):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[idx]

        db.query.side_effect = query_side_effect

        report = svc.get_payroll_report(
            BIZ, date_from=date(2025, 1, 1), date_to=date(2025, 1, 31),
        )
        assert report[0]["user_name"] == "Unknown"
        assert report[0]["email"] == ""

    def test_payroll_report_empty(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])

        report = svc.get_payroll_report(
            BIZ, date_from=date(2025, 1, 1), date_to=date(2025, 1, 31),
        )
        assert report == []


# ── approve_entry ────────────────────────────────────────────────


class TestApproveEntry:
    def test_approve_success(self):
        svc, db = _svc()
        entry = _mock_entry(id=ENTRY_ID)
        db.query.return_value = _chain(first=entry)

        result = svc.approve_entry(ENTRY_ID, BIZ, APPROVER_ID)
        assert result is entry
        assert entry.status == TimeEntryStatus.APPROVED
        assert entry.approved_by_id == APPROVER_ID
        assert entry.approved_at is not None
        db.commit.assert_called_once()

    def test_approve_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        with pytest.raises(ValueError, match="Time entry not found"):
            svc.approve_entry(ENTRY_ID, BIZ, APPROVER_ID)


# ── reject_entry ─────────────────────────────────────────────────


class TestRejectEntry:
    def test_reject_success(self):
        svc, db = _svc()
        entry = _mock_entry(id=ENTRY_ID)
        db.query.return_value = _chain(first=entry)

        result = svc.reject_entry(ENTRY_ID, BIZ, "Too many hours")
        assert result is entry
        assert entry.status == TimeEntryStatus.REJECTED
        assert entry.rejection_reason == "Too many hours"
        db.commit.assert_called_once()

    def test_reject_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        with pytest.raises(ValueError, match="Time entry not found"):
            svc.reject_entry(ENTRY_ID, BIZ, "reason")


# ── create_manual_entry ──────────────────────────────────────────


class TestCreateManualEntry:
    def test_create_manual_success(self):
        svc, db = _svc()
        cin = datetime(2025, 1, 15, 8, 0, 0)
        cout = datetime(2025, 1, 15, 16, 0, 0)

        svc.create_manual_entry(USER, BIZ, cin, cout, notes="Adjustment")
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.entry_type == TimeEntryType.MANUAL_ADJUSTMENT
        assert added.status == TimeEntryStatus.PENDING_APPROVAL
        assert added.hours_worked == Decimal("8.00")
        assert "[Manual Entry] Adjustment" in added.notes
        db.commit.assert_called_once()

    def test_create_manual_no_notes(self):
        svc, db = _svc()
        cin = datetime(2025, 1, 15, 8, 0, 0)
        cout = datetime(2025, 1, 15, 12, 0, 0)

        svc.create_manual_entry(USER, BIZ, cin, cout)
        added = db.add.call_args[0][0]
        assert added.notes == "[Manual Entry]"
        assert added.hours_worked == Decimal("4.00")

    def test_create_manual_raises_if_clock_out_before_in(self):
        svc, db = _svc()
        cin = datetime(2025, 1, 15, 16, 0, 0)
        cout = datetime(2025, 1, 15, 8, 0, 0)

        with pytest.raises(ValueError, match="Clock out time must be after clock in"):
            svc.create_manual_entry(USER, BIZ, cin, cout)
        db.add.assert_not_called()
