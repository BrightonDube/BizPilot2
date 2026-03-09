"""Unit tests for CashRegisterService.

Covers register CRUD, session lifecycle (open → sales → movements → close),
cash calculations, paginated listing, reporting, and error paths.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.models.cash_register import (
    CashMovement,
    CashRegister,
    RegisterSession,
    RegisterStatus,
)
from app.services.cash_register_service import CashRegisterService

BIZ_ID = str(uuid.uuid4())
REG_ID = str(uuid.uuid4())
SESS_ID = str(uuid.uuid4())
USER_ID = str(uuid.uuid4())
USER_ID2 = str(uuid.uuid4())
LOC_ID = str(uuid.uuid4())


def _chain():
    """MagicMock whose filter/order_by/offset/limit all return itself."""
    m = MagicMock()
    m.filter.return_value = m
    m.order_by.return_value = m
    m.offset.return_value = m
    m.limit.return_value = m
    return m


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def service(db):
    return CashRegisterService(db)


# ---------------------------------------------------------------------------
# Register CRUD
# ---------------------------------------------------------------------------


class TestCreateRegister:
    def test_creates_register(self, service, db):
        """Creates a register, adds to db, commits and refreshes."""
        result = service.create_register(BIZ_ID, "Till 1")
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, CashRegister)
        assert added.business_id == BIZ_ID
        assert added.name == "Till 1"

    def test_creates_register_with_location(self, service, db):
        """Passes optional location_id through."""
        service.create_register(BIZ_ID, "Bar Till", location_id=LOC_ID)
        added = db.add.call_args[0][0]
        assert added.location_id == LOC_ID

    def test_is_active_by_default(self, service, db):
        """New register starts active."""
        service.create_register(BIZ_ID, "Front")
        added = db.add.call_args[0][0]
        assert added.is_active is True


class TestListRegisters:
    def test_returns_registers(self, service, db):
        """Queries by business_id, non-deleted, ordered by name."""
        mocks = [MagicMock(spec=CashRegister), MagicMock(spec=CashRegister)]
        chain = _chain()
        chain.all.return_value = mocks
        db.query.return_value = chain

        result = service.list_registers(BIZ_ID)
        assert result == mocks
        assert len(result) == 2


class TestUpdateRegister:
    def test_updates_register_attrs(self, service, db):
        """Sets kwargs on the found register and commits."""
        mock_reg = MagicMock(spec=CashRegister)
        mock_reg.name = "Old"
        db.query.return_value.filter.return_value.first.return_value = mock_reg

        result = service.update_register(REG_ID, BIZ_ID, name="New Name")
        assert mock_reg.name == "New Name"
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(mock_reg)

    def test_raises_if_not_found(self, service, db):
        """ValueError when register does not exist."""
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(ValueError, match="Register not found"):
            service.update_register(REG_ID, BIZ_ID, name="X")


class TestDeleteRegister:
    def test_soft_deletes(self, service, db):
        """Calls soft_delete() and commits."""
        mock_reg = MagicMock(spec=CashRegister)
        db.query.return_value.filter.return_value.first.return_value = mock_reg

        result = service.delete_register(REG_ID, BIZ_ID)
        mock_reg.soft_delete.assert_called_once()
        db.commit.assert_called_once()
        assert result == mock_reg

    def test_raises_if_not_found(self, service, db):
        """ValueError when register does not exist."""
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(ValueError, match="Register not found"):
            service.delete_register(REG_ID, BIZ_ID)


# ---------------------------------------------------------------------------
# Session operations
# ---------------------------------------------------------------------------


class TestOpenSession:
    def _side_effect(self, register_found, existing_session):
        """Build a query side_effect for the two queries in open_session."""
        calls = iter([register_found, existing_session])

        def _se(*args):
            c = _chain()
            c.first.return_value = next(calls)
            return c

        return _se

    def test_opens_session(self, service, db):
        """Creates a RegisterSession with OPEN status and default float."""
        mock_reg = MagicMock(spec=CashRegister)
        db.query.side_effect = self._side_effect(mock_reg, None)

        result = service.open_session(REG_ID, BIZ_ID, USER_ID)
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, RegisterSession)
        assert added.status == RegisterStatus.OPEN
        assert added.opening_float == Decimal("0")
        assert added.register_id == REG_ID
        assert added.business_id == BIZ_ID
        assert added.opened_by == USER_ID
        db.commit.assert_called_once()

    def test_opens_with_custom_float(self, service, db):
        """Accepts a custom opening_float."""
        mock_reg = MagicMock(spec=CashRegister)
        db.query.side_effect = self._side_effect(mock_reg, None)

        service.open_session(REG_ID, BIZ_ID, USER_ID, opening_float=Decimal("500"))
        added = db.add.call_args[0][0]
        assert added.opening_float == Decimal("500")

    def test_raises_if_register_not_found(self, service, db):
        """ValueError when register doesn't exist."""
        db.query.side_effect = self._side_effect(None, None)
        with pytest.raises(ValueError, match="Register not found"):
            service.open_session(REG_ID, BIZ_ID, USER_ID)

    def test_raises_if_already_open(self, service, db):
        """ValueError when an open session already exists."""
        mock_reg = MagicMock(spec=CashRegister)
        existing = MagicMock(spec=RegisterSession)
        db.query.side_effect = self._side_effect(mock_reg, existing)

        with pytest.raises(ValueError, match="already has an open session"):
            service.open_session(REG_ID, BIZ_ID, USER_ID)


class TestCloseSession:
    def _make_session(self, **overrides):
        """Create a mock RegisterSession with numeric defaults."""
        s = MagicMock(spec=RegisterSession)
        s.opening_float = overrides.get("opening_float", Decimal("100"))
        s.total_cash_payments = overrides.get("total_cash_payments", Decimal("500"))
        s.total_refunds = overrides.get("total_refunds", Decimal("50"))
        return s

    def _side_effect(self, session, cash_in, cash_out):
        """Build side_effect for the three queries in close_session."""
        calls = iter([
            ("session", session),
            ("cash_in", cash_in),
            ("cash_out", cash_out),
        ])

        def _se(*args):
            label, value = next(calls)
            c = _chain()
            if label == "session":
                c.first.return_value = value
            else:
                c.scalar.return_value = value
            return c

        return _se

    def test_closes_session_and_calculates(self, service, db):
        """Sets expected_cash, cash_difference, status=CLOSED."""
        mock_sess = self._make_session()
        # expected = 100 + 500 - 50 + 200 - 80 = 670
        db.query.side_effect = self._side_effect(
            mock_sess, Decimal("200"), Decimal("80"),
        )
        actual_cash = Decimal("670")

        result = service.close_session(SESS_ID, BIZ_ID, USER_ID2, actual_cash)
        assert result == mock_sess
        assert mock_sess.status == RegisterStatus.CLOSED
        assert mock_sess.expected_cash == Decimal("670")
        assert mock_sess.cash_difference == Decimal("0")
        assert mock_sess.actual_cash == actual_cash
        assert mock_sess.closed_by == USER_ID2
        db.commit.assert_called_once()

    def test_cash_difference_positive_surplus(self, service, db):
        """Positive difference when actual > expected (surplus)."""
        mock_sess = self._make_session(
            opening_float=Decimal("50"),
            total_cash_payments=Decimal("200"),
            total_refunds=Decimal("0"),
        )
        # expected = 50 + 200 - 0 + 0 - 0 = 250
        db.query.side_effect = self._side_effect(mock_sess, 0, 0)

        service.close_session(SESS_ID, BIZ_ID, USER_ID2, Decimal("260"))
        assert mock_sess.cash_difference == Decimal("10")

    def test_cash_difference_negative_shortage(self, service, db):
        """Negative difference when actual < expected (shortage)."""
        mock_sess = self._make_session(
            opening_float=Decimal("100"),
            total_cash_payments=Decimal("300"),
            total_refunds=Decimal("0"),
        )
        # expected = 100 + 300 - 0 + 50 - 10 = 440
        db.query.side_effect = self._side_effect(mock_sess, Decimal("50"), Decimal("10"))

        service.close_session(SESS_ID, BIZ_ID, USER_ID2, Decimal("430"))
        assert mock_sess.cash_difference == Decimal("-10")

    def test_closes_session_with_notes(self, service, db):
        """Stores notes on the session."""
        mock_sess = self._make_session()
        db.query.side_effect = self._side_effect(mock_sess, 0, 0)

        service.close_session(
            SESS_ID, BIZ_ID, USER_ID2, Decimal("550"), notes="All good",
        )
        assert mock_sess.notes == "All good"

    def test_raises_if_not_found(self, service, db):
        """ValueError when no open session matches."""
        c = _chain()
        c.first.return_value = None
        db.query.return_value = c
        with pytest.raises(ValueError, match="Open session not found"):
            service.close_session(SESS_ID, BIZ_ID, USER_ID2, Decimal("0"))


class TestGetSession:
    def test_returns_session(self, service, db):
        """Returns session from query."""
        mock_sess = MagicMock(spec=RegisterSession)
        db.query.return_value.filter.return_value.first.return_value = mock_sess

        result = service.get_session(SESS_ID, BIZ_ID)
        assert result == mock_sess

    def test_returns_none_when_not_found(self, service, db):
        """Returns None for missing session."""
        db.query.return_value.filter.return_value.first.return_value = None
        result = service.get_session(SESS_ID, BIZ_ID)
        assert result is None


class TestGetActiveSession:
    def test_returns_open_session(self, service, db):
        """Returns the OPEN session for a register."""
        mock_sess = MagicMock(spec=RegisterSession)
        db.query.return_value.filter.return_value.first.return_value = mock_sess

        result = service.get_active_session(REG_ID, BIZ_ID)
        assert result == mock_sess

    def test_returns_none_when_no_active(self, service, db):
        """Returns None when no OPEN session exists."""
        db.query.return_value.filter.return_value.first.return_value = None
        result = service.get_active_session(REG_ID, BIZ_ID)
        assert result is None


# ---------------------------------------------------------------------------
# Session listing (pagination)
# ---------------------------------------------------------------------------


class TestListSessions:
    def test_returns_paginated(self, service, db):
        """Returns (items, total) tuple with default pagination."""
        mocks = [MagicMock(spec=RegisterSession) for _ in range(3)]
        chain = _chain()
        chain.count.return_value = 3
        chain.all.return_value = mocks
        db.query.return_value = chain

        items, total = service.list_sessions(BIZ_ID)
        assert total == 3
        assert items == mocks

    def test_filters_by_register_and_status(self, service, db):
        """Applies optional register_id and status filters."""
        chain = _chain()
        chain.count.return_value = 1
        chain.all.return_value = [MagicMock(spec=RegisterSession)]
        db.query.return_value = chain

        items, total = service.list_sessions(
            BIZ_ID,
            register_id=REG_ID,
            status=RegisterStatus.OPEN,
        )
        assert total == 1
        assert len(items) == 1
        # filter should be called multiple times (base + register + status)
        assert chain.filter.call_count >= 3

    def test_respects_page_and_per_page(self, service, db):
        """Passes correct offset and limit for page 2."""
        chain = _chain()
        chain.count.return_value = 25
        chain.all.return_value = [MagicMock(spec=RegisterSession) for _ in range(5)]
        db.query.return_value = chain

        items, total = service.list_sessions(BIZ_ID, page=2, per_page=5)
        assert total == 25
        chain.offset.assert_called_with(5)   # (2-1)*5
        chain.limit.assert_called_with(5)


# ---------------------------------------------------------------------------
# Cash movement
# ---------------------------------------------------------------------------


class TestAddCashMovement:
    def test_adds_movement(self, service, db):
        """Creates CashMovement, commits, refreshes."""
        mock_sess = MagicMock(spec=RegisterSession)
        db.query.return_value.filter.return_value.first.return_value = mock_sess

        result = service.add_cash_movement(
            SESS_ID, BIZ_ID, "cash_in", Decimal("150"), "Float top-up", USER_ID,
        )
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, CashMovement)
        assert added.movement_type == "cash_in"
        assert added.amount == Decimal("150")
        assert added.reason == "Float top-up"
        db.commit.assert_called_once()

    def test_raises_if_session_not_open(self, service, db):
        """ValueError when session is not found / not OPEN."""
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(ValueError, match="Open session not found"):
            service.add_cash_movement(
                SESS_ID, BIZ_ID, "cash_out", Decimal("50"), "Petty cash", USER_ID,
            )


# ---------------------------------------------------------------------------
# Sale recording
# ---------------------------------------------------------------------------


class TestRecordSale:
    def _open_session_mock(self):
        s = MagicMock(spec=RegisterSession)
        s.total_sales = Decimal("0")
        s.transaction_count = 0
        s.total_cash_payments = Decimal("0")
        s.total_card_payments = Decimal("0")
        return s

    def test_records_cash_sale(self, service, db):
        """Increments total_sales, transaction_count, total_cash_payments."""
        mock_sess = self._open_session_mock()
        db.query.return_value.filter.return_value.first.return_value = mock_sess

        result = service.record_sale(SESS_ID, Decimal("100"), "cash")
        assert mock_sess.total_sales == Decimal("100")
        assert mock_sess.transaction_count == 1
        assert mock_sess.total_cash_payments == Decimal("100")
        assert mock_sess.total_card_payments == Decimal("0")
        db.commit.assert_called_once()

    def test_records_card_sale(self, service, db):
        """Increments total_card_payments for card payment."""
        mock_sess = self._open_session_mock()
        db.query.return_value.filter.return_value.first.return_value = mock_sess

        service.record_sale(SESS_ID, Decimal("250"), "card")
        assert mock_sess.total_sales == Decimal("250")
        assert mock_sess.total_card_payments == Decimal("250")
        assert mock_sess.total_cash_payments == Decimal("0")

    def test_records_other_payment_method(self, service, db):
        """Other methods increment total_sales but not cash/card buckets."""
        mock_sess = self._open_session_mock()
        db.query.return_value.filter.return_value.first.return_value = mock_sess

        service.record_sale(SESS_ID, Decimal("75"), "mobile")
        assert mock_sess.total_sales == Decimal("75")
        assert mock_sess.total_cash_payments == Decimal("0")
        assert mock_sess.total_card_payments == Decimal("0")

    def test_raises_if_session_not_open(self, service, db):
        """ValueError when no open session found."""
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(ValueError, match="Open session not found"):
            service.record_sale(SESS_ID, Decimal("10"), "cash")


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


class TestGetRegisterReport:
    def _report_side_effect(
        self, total_sessions, total_sales, avg_diff, discrepancy_count,
    ):
        """Build side_effect for the four queries in get_register_report."""
        calls = iter([
            ("count", total_sessions),
            ("total_sales", total_sales),
            ("avg_diff", avg_diff),
            ("discrepancy", discrepancy_count),
        ])

        def _se(*args):
            label, value = next(calls)
            c = _chain()
            if label == "count":
                c.count.return_value = value
            else:
                c.scalar.return_value = value
            return c

        return _se

    def test_returns_aggregated_report(self, service, db):
        """Returns dict with totals and averages."""
        db.query.side_effect = self._report_side_effect(
            total_sessions=10,
            total_sales=Decimal("5000"),
            avg_diff=Decimal("-2.50"),
            discrepancy_count=3,
        )

        report = service.get_register_report(BIZ_ID)
        assert report["business_id"] == BIZ_ID
        assert report["total_sessions"] == 10
        assert report["total_sales"] == Decimal("5000")
        assert report["avg_cash_difference"] == Decimal("-2.50")
        assert report["sessions_with_discrepancy"] == 3

    def test_report_with_register_filter(self, service, db):
        """Passes register_id filter through."""
        db.query.side_effect = self._report_side_effect(5, Decimal("2000"), 0, 0)

        report = service.get_register_report(BIZ_ID, register_id=REG_ID)
        assert report["total_sessions"] == 5
        assert report["total_sales"] == Decimal("2000")

    def test_report_with_date_range(self, service, db):
        """Applies start_date and end_date filters."""
        db.query.side_effect = self._report_side_effect(2, Decimal("800"), 0, 1)
        start = datetime(2024, 1, 1, tzinfo=timezone.utc)
        end = datetime(2024, 1, 31, tzinfo=timezone.utc)

        report = service.get_register_report(
            BIZ_ID, start_date=start, end_date=end,
        )
        assert report["total_sessions"] == 2
        assert report["sessions_with_discrepancy"] == 1

    def test_report_zero_sessions(self, service, db):
        """Handles empty result set gracefully."""
        db.query.side_effect = self._report_side_effect(0, 0, 0, 0)

        report = service.get_register_report(BIZ_ID)
        assert report["total_sessions"] == 0
        assert report["total_sales"] == Decimal("0")
        assert report["avg_cash_difference"] == Decimal("0")
        assert report["sessions_with_discrepancy"] == 0
