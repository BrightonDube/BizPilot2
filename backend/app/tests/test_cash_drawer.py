"""Tests for cash drawer session management."""

import uuid
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.models.payment import CashDrawerSession, CashDrawerStatus
from app.services.payment_service import PaymentService


def _make_db():
    """Return a minimal mock DB session."""
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    db.query.return_value.filter.return_value.scalar.return_value = Decimal(0)
    return db


def _make_ids():
    return uuid.uuid4(), uuid.uuid4()


# ---------------------------------------------------------------------------
# open_cash_drawer
# ---------------------------------------------------------------------------


def test_open_cash_drawer_creates_session():
    db = _make_db()
    svc = PaymentService(db)
    business_id, user_id = _make_ids()

    session = svc.open_cash_drawer(
        business_id=business_id,
        opened_by_id=user_id,
        opening_float=Decimal("500.00"),
    )

    assert isinstance(session, CashDrawerSession)
    assert session.opening_float == Decimal("500.00")
    assert session.status == CashDrawerStatus.OPEN.value
    assert session.opened_at is not None
    db.add.assert_called_once_with(session)
    db.flush.assert_called_once()


def test_open_cash_drawer_raises_if_already_open():
    db = _make_db()
    existing = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = existing
    svc = PaymentService(db)
    business_id, user_id = _make_ids()

    with pytest.raises(ValueError, match="already open"):
        svc.open_cash_drawer(
            business_id=business_id,
            opened_by_id=user_id,
            opening_float=Decimal("100.00"),
        )


def test_open_cash_drawer_stores_notes():
    db = _make_db()
    svc = PaymentService(db)
    business_id, user_id = _make_ids()

    session = svc.open_cash_drawer(
        business_id=business_id,
        opened_by_id=user_id,
        opening_float=Decimal("200.00"),
        notes="Morning shift",
    )

    assert session.notes == "Morning shift"


# ---------------------------------------------------------------------------
# close_cash_drawer
# ---------------------------------------------------------------------------


def _make_open_session(business_id, opened_by_id, opening_float="500.00"):
    session = MagicMock(spec=CashDrawerSession)
    session.id = uuid.uuid4()
    session.business_id = business_id
    session.opened_by_id = opened_by_id
    session.opening_float = Decimal(opening_float)
    session.status = CashDrawerStatus.OPEN.value
    from datetime import datetime, timezone
    session.opened_at = datetime.now(timezone.utc)
    return session


def test_close_cash_drawer_sets_status_closed():
    db = _make_db()
    business_id, user_id = _make_ids()
    open_session = _make_open_session(business_id, user_id)
    db.query.return_value.filter.return_value.first.return_value = open_session
    db.query.return_value.filter.return_value.scalar.return_value = Decimal(0)

    svc = PaymentService(db)
    result = svc.close_cash_drawer(
        session_id=open_session.id,
        business_id=business_id,
        closed_by_id=user_id,
        closing_float=Decimal("480.00"),
    )

    assert result.status == CashDrawerStatus.CLOSED.value
    assert result.closing_float == Decimal("480.00")
    assert result.closed_at is not None


def test_close_cash_drawer_calculates_variance():
    db = _make_db()
    business_id, user_id = _make_ids()
    open_session = _make_open_session(business_id, user_id, "500.00")
    db.query.return_value.filter.return_value.first.return_value = open_session
    # Simulate R100 cash sales during session
    db.query.return_value.filter.return_value.scalar.return_value = Decimal("100.00")

    svc = PaymentService(db)
    result = svc.close_cash_drawer(
        session_id=open_session.id,
        business_id=business_id,
        closed_by_id=user_id,
        closing_float=Decimal("580.00"),  # exact match → variance 0
    )

    # expected = 500 + 100 = 600; closing = 580 → variance = -20
    assert result.expected_float == Decimal("600.00")
    assert result.variance == Decimal("-20.00")


def test_close_cash_drawer_raises_if_session_not_found():
    db = _make_db()
    db.query.return_value.filter.return_value.first.return_value = None
    svc = PaymentService(db)
    business_id, user_id = _make_ids()

    with pytest.raises(ValueError, match="not found"):
        svc.close_cash_drawer(
            session_id=uuid.uuid4(),
            business_id=business_id,
            closed_by_id=user_id,
            closing_float=Decimal("500.00"),
        )


# ---------------------------------------------------------------------------
# get_active_session
# ---------------------------------------------------------------------------


def test_get_active_session_returns_open_session():
    db = _make_db()
    business_id, _ = _make_ids()
    mock_session = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = mock_session

    svc = PaymentService(db)
    result = svc.get_active_session(business_id)

    assert result is mock_session


def test_get_active_session_returns_none_when_no_open_session():
    db = _make_db()
    business_id, _ = _make_ids()
    db.query.return_value.filter.return_value.first.return_value = None

    svc = PaymentService(db)
    result = svc.get_active_session(business_id)

    assert result is None
