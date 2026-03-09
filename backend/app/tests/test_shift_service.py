"""Unit tests for ShiftService."""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import date, time, datetime, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models.shift import Shift, ShiftStatus, LeaveRequest, LeaveType, LeaveStatus
from app.services.shift_service import ShiftService

BIZ = str(uuid4())
USER = str(uuid4())
SHIFT_ID = str(uuid4())
LEAVE_ID = str(uuid4())
APPROVER = str(uuid4())
LOCATION = str(uuid4())


def _svc():
    db = MagicMock()
    return ShiftService(db), db


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


def _mock_shift(**kw):
    s = MagicMock(spec=Shift)
    s.id = kw.get("id", SHIFT_ID)
    s.business_id = kw.get("business_id", BIZ)
    s.user_id = kw.get("user_id", USER)
    s.shift_date = kw.get("shift_date", date(2025, 6, 15))
    s.start_time = kw.get("start_time", time(8, 0))
    s.end_time = kw.get("end_time", time(16, 0))
    s.break_minutes = kw.get("break_minutes", 0)
    s.role = kw.get("role", None)
    s.location_id = kw.get("location_id", None)
    s.notes = kw.get("notes", None)
    s.status = kw.get("status", ShiftStatus.SCHEDULED)
    s.actual_start = kw.get("actual_start", None)
    s.actual_end = kw.get("actual_end", None)
    s.deleted_at = None
    return s


def _mock_leave(**kw):
    lr = MagicMock(spec=LeaveRequest)
    lr.id = kw.get("id", LEAVE_ID)
    lr.business_id = kw.get("business_id", BIZ)
    lr.user_id = kw.get("user_id", USER)
    lr.leave_type = kw.get("leave_type", LeaveType.ANNUAL)
    lr.start_date = kw.get("start_date", date(2025, 7, 1))
    lr.end_date = kw.get("end_date", date(2025, 7, 5))
    lr.reason = kw.get("reason", None)
    lr.status = kw.get("status", LeaveStatus.PENDING)
    lr.approved_by = kw.get("approved_by", None)
    lr.deleted_at = None
    lr.created_at = kw.get("created_at", datetime(2025, 6, 20))
    return lr


# ── create_shift ──────────────────────────────────────────────────


class TestCreateShift:
    def test_creates_shift_with_all_fields(self):
        svc, db = _svc()

        result = svc.create_shift(
            business_id=BIZ,
            user_id=USER,
            shift_date=date(2025, 6, 15),
            start_time=time(8, 0),
            end_time=time(16, 0),
            break_minutes=30,
            role="Cashier",
            location_id=LOCATION,
            notes="Morning shift",
        )
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.business_id == BIZ
        assert added.user_id == USER
        assert added.shift_date == date(2025, 6, 15)
        assert added.start_time == time(8, 0)
        assert added.end_time == time(16, 0)
        assert added.break_minutes == 30
        assert added.role == "Cashier"
        assert added.location_id == LOCATION
        assert added.notes == "Morning shift"
        assert added.status == ShiftStatus.SCHEDULED
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_creates_shift_defaults(self):
        svc, db = _svc()

        svc.create_shift(
            business_id=BIZ,
            user_id=USER,
            shift_date=date(2025, 6, 15),
            start_time=time(9, 0),
            end_time=time(17, 0),
        )
        added = db.add.call_args[0][0]
        assert added.break_minutes == 0
        assert added.role is None
        assert added.location_id is None
        assert added.notes is None


# ── list_shifts ───────────────────────────────────────────────────


class TestListShifts:
    def test_basic_list(self):
        svc, db = _svc()
        shifts = [_mock_shift(), _mock_shift()]
        db.query.return_value = _chain(rows=shifts, count=2)

        items, total = svc.list_shifts(BIZ)
        assert len(items) == 2
        assert total == 2

    def test_filters_by_date_range_and_user(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_shifts(
            BIZ,
            start_date=date(2025, 6, 1),
            end_date=date(2025, 6, 30),
            user_id=USER,
        )
        # base filter + start_date + end_date + user_id
        assert chain.filter.call_count >= 4

    def test_filters_by_status(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_shifts(BIZ, shift_status=ShiftStatus.COMPLETED)
        # base filter + status
        assert chain.filter.call_count >= 2

    def test_pagination(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=50)
        db.query.return_value = chain

        svc.list_shifts(BIZ, page=3, per_page=10)
        chain.offset.assert_called_once_with(20)
        chain.limit.assert_called_once_with(10)


# ── get_shift ─────────────────────────────────────────────────────


class TestGetShift:
    def test_returns_shift(self):
        svc, db = _svc()
        shift = _mock_shift()
        db.query.return_value = _chain(first=shift)

        result = svc.get_shift(SHIFT_ID, BIZ)
        assert result is shift
        db.query.assert_called_once_with(Shift)

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.get_shift(SHIFT_ID, BIZ)
        assert result is None


# ── update_shift ──────────────────────────────────────────────────


class TestUpdateShift:
    @patch.object(ShiftService, "get_shift")
    def test_update_success(self, mock_get):
        shift = _mock_shift()
        mock_get.return_value = shift
        svc, db = _svc()

        result = svc.update_shift(
            SHIFT_ID, BIZ, role="Manager", notes="Updated"
        )
        assert result is shift
        assert shift.role == "Manager"
        assert shift.notes == "Updated"
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    @patch.object(ShiftService, "get_shift", return_value=None)
    def test_update_not_found(self, mock_get):
        svc, db = _svc()

        result = svc.update_shift(SHIFT_ID, BIZ, role="Cashier")
        assert result is None
        db.commit.assert_not_called()

    @patch.object(ShiftService, "get_shift")
    def test_update_skips_none_values(self, mock_get):
        shift = _mock_shift(role="Original")
        mock_get.return_value = shift
        svc, db = _svc()

        svc.update_shift(SHIFT_ID, BIZ, role=None, notes="New note")
        assert shift.role == "Original"
        assert shift.notes == "New note"


# ── delete_shift ──────────────────────────────────────────────────


class TestDeleteShift:
    @patch.object(ShiftService, "get_shift")
    def test_delete_success(self, mock_get):
        shift = _mock_shift()
        mock_get.return_value = shift
        svc, db = _svc()

        result = svc.delete_shift(SHIFT_ID, BIZ)
        assert result is True
        assert shift.deleted_at is not None
        db.commit.assert_called_once()

    @patch.object(ShiftService, "get_shift", return_value=None)
    def test_delete_not_found(self, mock_get):
        svc, db = _svc()

        result = svc.delete_shift(SHIFT_ID, BIZ)
        assert result is False
        db.commit.assert_not_called()


# ── clock_in ──────────────────────────────────────────────────────


class TestClockIn:
    @patch.object(ShiftService, "get_shift")
    def test_clock_in_success(self, mock_get):
        shift = _mock_shift(status=ShiftStatus.SCHEDULED)
        mock_get.return_value = shift
        svc, db = _svc()

        result = svc.clock_in(SHIFT_ID, BIZ)
        assert result is shift
        assert shift.actual_start is not None
        assert shift.status == ShiftStatus.IN_PROGRESS
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    @patch.object(ShiftService, "get_shift", return_value=None)
    def test_clock_in_not_found(self, mock_get):
        svc, db = _svc()

        result = svc.clock_in(SHIFT_ID, BIZ)
        assert result is None

    @patch.object(ShiftService, "get_shift")
    def test_clock_in_wrong_status(self, mock_get):
        shift = _mock_shift(status=ShiftStatus.COMPLETED)
        mock_get.return_value = shift
        svc, db = _svc()

        with pytest.raises(HTTPException) as exc_info:
            svc.clock_in(SHIFT_ID, BIZ)
        assert exc_info.value.status_code == 400
        assert "SCHEDULED" in exc_info.value.detail


# ── clock_out ─────────────────────────────────────────────────────


class TestClockOut:
    @patch.object(ShiftService, "get_shift")
    def test_clock_out_success(self, mock_get):
        shift = _mock_shift(status=ShiftStatus.IN_PROGRESS)
        mock_get.return_value = shift
        svc, db = _svc()

        result = svc.clock_out(SHIFT_ID, BIZ)
        assert result is shift
        assert shift.actual_end is not None
        assert shift.status == ShiftStatus.COMPLETED
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    @patch.object(ShiftService, "get_shift", return_value=None)
    def test_clock_out_not_found(self, mock_get):
        svc, db = _svc()

        result = svc.clock_out(SHIFT_ID, BIZ)
        assert result is None

    @patch.object(ShiftService, "get_shift")
    def test_clock_out_wrong_status(self, mock_get):
        shift = _mock_shift(status=ShiftStatus.SCHEDULED)
        mock_get.return_value = shift
        svc, db = _svc()

        with pytest.raises(HTTPException) as exc_info:
            svc.clock_out(SHIFT_ID, BIZ)
        assert exc_info.value.status_code == 400
        assert "IN_PROGRESS" in exc_info.value.detail


# ── get_schedule ──────────────────────────────────────────────────


class TestGetSchedule:
    @patch.object(ShiftService, "list_shifts")
    def test_groups_shifts_by_date(self, mock_list):
        s1 = _mock_shift(shift_date=date(2025, 6, 16))
        s2 = _mock_shift(shift_date=date(2025, 6, 16))
        s3 = _mock_shift(shift_date=date(2025, 6, 18))
        mock_list.return_value = ([s1, s2, s3], 3)
        svc, db = _svc()

        result = svc.get_schedule(BIZ, date(2025, 6, 16))
        assert "2025-06-16" in result
        assert len(result["2025-06-16"]) == 2
        assert "2025-06-18" in result
        assert len(result["2025-06-18"]) == 1

    @patch.object(ShiftService, "list_shifts")
    def test_empty_schedule(self, mock_list):
        mock_list.return_value = ([], 0)
        svc, db = _svc()

        result = svc.get_schedule(BIZ, date(2025, 6, 16))
        assert result == {}

    @patch.object(ShiftService, "list_shifts")
    def test_passes_correct_date_range(self, mock_list):
        mock_list.return_value = ([], 0)
        svc, db = _svc()
        start = date(2025, 6, 16)

        svc.get_schedule(BIZ, start)
        mock_list.assert_called_once_with(
            business_id=BIZ,
            start_date=start,
            end_date=start + timedelta(days=6),
            per_page=1000,
        )


# ── create_leave_request ──────────────────────────────────────────


class TestCreateLeaveRequest:
    def test_creates_leave_request(self):
        svc, db = _svc()

        result = svc.create_leave_request(
            business_id=BIZ,
            user_id=USER,
            leave_type=LeaveType.SICK,
            start_date=date(2025, 7, 1),
            end_date=date(2025, 7, 3),
            reason="Flu",
        )
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.business_id == BIZ
        assert added.user_id == USER
        assert added.leave_type == LeaveType.SICK
        assert added.start_date == date(2025, 7, 1)
        assert added.end_date == date(2025, 7, 3)
        assert added.reason == "Flu"
        assert added.status == LeaveStatus.PENDING
        db.commit.assert_called_once()
        db.refresh.assert_called_once()


# ── list_leave_requests ───────────────────────────────────────────


class TestListLeaveRequests:
    def test_basic_list(self):
        svc, db = _svc()
        leaves = [_mock_leave(), _mock_leave()]
        db.query.return_value = _chain(rows=leaves, count=2)

        items, total = svc.list_leave_requests(BIZ)
        assert len(items) == 2
        assert total == 2

    def test_filters_by_user_and_status(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_leave_requests(
            BIZ, user_id=USER, leave_status=LeaveStatus.APPROVED
        )
        # base filter + user_id + status
        assert chain.filter.call_count >= 3

    def test_pagination(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=30)
        db.query.return_value = chain

        svc.list_leave_requests(BIZ, page=2, per_page=10)
        chain.offset.assert_called_once_with(10)
        chain.limit.assert_called_once_with(10)


# ── approve_leave ─────────────────────────────────────────────────


class TestApproveLeave:
    def test_approve_success(self):
        svc, db = _svc()
        leave = _mock_leave(status=LeaveStatus.PENDING)
        db.query.return_value = _chain(first=leave)

        result = svc.approve_leave(LEAVE_ID, BIZ, APPROVER)
        assert result is leave
        assert leave.status == LeaveStatus.APPROVED
        assert leave.approved_by == APPROVER
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_approve_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.approve_leave(LEAVE_ID, BIZ, APPROVER)
        assert result is None

    def test_approve_wrong_status(self):
        svc, db = _svc()
        leave = _mock_leave(status=LeaveStatus.APPROVED)
        db.query.return_value = _chain(first=leave)

        with pytest.raises(HTTPException) as exc_info:
            svc.approve_leave(LEAVE_ID, BIZ, APPROVER)
        assert exc_info.value.status_code == 400
        assert "PENDING" in exc_info.value.detail


# ── reject_leave ──────────────────────────────────────────────────


class TestRejectLeave:
    def test_reject_success(self):
        svc, db = _svc()
        leave = _mock_leave(status=LeaveStatus.PENDING)
        db.query.return_value = _chain(first=leave)

        result = svc.reject_leave(LEAVE_ID, BIZ)
        assert result is leave
        assert leave.status == LeaveStatus.REJECTED
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_reject_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.reject_leave(LEAVE_ID, BIZ)
        assert result is None

    def test_reject_wrong_status(self):
        svc, db = _svc()
        leave = _mock_leave(status=LeaveStatus.REJECTED)
        db.query.return_value = _chain(first=leave)

        with pytest.raises(HTTPException) as exc_info:
            svc.reject_leave(LEAVE_ID, BIZ)
        assert exc_info.value.status_code == 400
        assert "PENDING" in exc_info.value.detail
