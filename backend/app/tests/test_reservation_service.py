"""Unit tests for ReservationService.

Tests cover CRUD, status transitions, conflict detection,
upcoming-reservation queries, and edge cases.
"""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch, call

import pytest

from app.models.restaurant_table import (
    Reservation,
    ReservationStatus,
    RestaurantTable,
    TableStatus,
)
from app.services.reservation_service import ReservationService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

BIZ_ID = str(uuid.uuid4())
TABLE_ID = str(uuid.uuid4())
RES_ID = str(uuid.uuid4())


@pytest.fixture
def db():
    """Create a mock database session."""
    return MagicMock()


@pytest.fixture
def service(db):
    """Create a ReservationService with mocked DB."""
    return ReservationService(db)


def _mock_reservation(
    *,
    res_id=None,
    status=ReservationStatus.CONFIRMED.value,
    date_time=None,
    duration=90,
    table_id=None,
    party_size=4,
):
    """Helper to create a mock Reservation."""
    r = MagicMock(spec=Reservation)
    r.id = res_id or str(uuid.uuid4())
    r.business_id = BIZ_ID
    r.table_id = table_id or TABLE_ID
    r.guest_name = "Test Guest"
    r.phone = "0821234567"
    r.email = "guest@test.com"
    r.party_size = party_size
    r.date_time = date_time or datetime(2025, 7, 20, 18, 0, tzinfo=timezone.utc)
    r.duration = duration
    r.status = status
    r.notes = None
    r.customer_id = None
    r.created_by_id = None
    r.deleted_at = None
    r.created_at = datetime.now(timezone.utc)
    r.updated_at = datetime.now(timezone.utc)
    return r


# ---------------------------------------------------------------------------
# create_reservation
# ---------------------------------------------------------------------------

class TestCreateReservation:
    """Tests for ReservationService.create_reservation."""

    def test_create_without_table(self, service, db):
        """Creates a reservation without a table assignment."""
        result = service.create_reservation(
            business_id=BIZ_ID,
            guest_name="Alice",
            party_size=2,
            date_time=datetime(2025, 7, 25, 19, 0, tzinfo=timezone.utc),
        )
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.guest_name == "Alice"
        assert added.party_size == 2
        assert added.status == ReservationStatus.CONFIRMED.value

    def test_create_with_valid_table(self, service, db):
        """Creates a reservation linked to a table."""
        mock_table = MagicMock(spec=RestaurantTable)
        db.query.return_value.filter.return_value.first.return_value = mock_table

        result = service.create_reservation(
            business_id=BIZ_ID,
            guest_name="Bob",
            party_size=3,
            date_time=datetime(2025, 7, 25, 20, 0, tzinfo=timezone.utc),
            table_id=TABLE_ID,
        )
        db.add.assert_called_once()

    def test_create_with_invalid_table_raises(self, service, db):
        """Raises ValueError if table doesn't exist."""
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(ValueError, match="Table not found"):
            service.create_reservation(
                business_id=BIZ_ID,
                guest_name="Charlie",
                party_size=2,
                date_time=datetime(2025, 7, 25, 19, 0, tzinfo=timezone.utc),
                table_id=TABLE_ID,
            )

    def test_create_sets_default_duration(self, service, db):
        """Default duration is 90 minutes."""
        result = service.create_reservation(
            business_id=BIZ_ID,
            guest_name="Dave",
            party_size=1,
            date_time=datetime(2025, 7, 25, 19, 0, tzinfo=timezone.utc),
        )
        added = db.add.call_args[0][0]
        assert added.duration == 90


# ---------------------------------------------------------------------------
# get_reservation
# ---------------------------------------------------------------------------

class TestGetReservation:
    """Tests for ReservationService.get_reservation."""

    def test_get_found(self, service, db):
        """Returns the reservation when found."""
        mock_r = _mock_reservation(res_id=RES_ID)
        db.query.return_value.filter.return_value.first.return_value = mock_r
        result = service.get_reservation(RES_ID, BIZ_ID)
        assert result == mock_r

    def test_get_not_found(self, service, db):
        """Returns None when reservation doesn't exist."""
        db.query.return_value.filter.return_value.first.return_value = None
        result = service.get_reservation("nonexistent", BIZ_ID)
        assert result is None


# ---------------------------------------------------------------------------
# list_reservations
# ---------------------------------------------------------------------------

class TestListReservations:
    """Tests for ReservationService.list_reservations."""

    def test_list_basic(self, service, db):
        """Returns (items, total) tuple."""
        chain = db.query.return_value.filter.return_value
        chain.count.return_value = 2
        mock_items = [_mock_reservation(), _mock_reservation()]
        chain.order_by.return_value.offset.return_value.limit.return_value.all.return_value = mock_items

        items, total = service.list_reservations(BIZ_ID)
        assert total == 2
        assert len(items) == 2

    def test_list_with_date_filter(self, service, db):
        """Applies date_from and date_to filters."""
        chain = db.query.return_value.filter.return_value
        chain.filter.return_value = chain  # chained filters
        chain.count.return_value = 0
        chain.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []

        items, total = service.list_reservations(
            BIZ_ID,
            date_from=datetime(2025, 7, 20, tzinfo=timezone.utc),
            date_to=datetime(2025, 7, 21, tzinfo=timezone.utc),
        )
        assert total == 0

    def test_list_with_status_filter(self, service, db):
        """Applies status filter."""
        chain = db.query.return_value.filter.return_value
        chain.filter.return_value = chain
        chain.count.return_value = 0
        chain.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []

        items, total = service.list_reservations(
            BIZ_ID, status=ReservationStatus.CONFIRMED.value,
        )
        assert total == 0


# ---------------------------------------------------------------------------
# update_reservation
# ---------------------------------------------------------------------------

class TestUpdateReservation:
    """Tests for ReservationService.update_reservation."""

    def test_update_fields(self, service, db):
        """Updates allowed fields."""
        mock_r = _mock_reservation(res_id=RES_ID)
        db.query.return_value.filter.return_value.first.return_value = mock_r

        result = service.update_reservation(
            RES_ID, BIZ_ID,
            guest_name="Updated Name", party_size=6,
        )
        assert mock_r.guest_name == "Updated Name"
        assert mock_r.party_size == 6
        db.commit.assert_called()

    def test_update_not_found(self, service, db):
        """Returns None if reservation doesn't exist."""
        db.query.return_value.filter.return_value.first.return_value = None
        result = service.update_reservation("nonexistent", BIZ_ID, guest_name="New")
        assert result is None

    def test_update_ignores_disallowed_fields(self, service, db):
        """Fields not in allowed_fields are ignored."""
        mock_r = _mock_reservation(res_id=RES_ID)
        db.query.return_value.filter.return_value.first.return_value = mock_r

        service.update_reservation(RES_ID, BIZ_ID, hacker_field="malicious")
        # No attribute set
        assert not hasattr(mock_r, "hacker_field") or mock_r.hacker_field != "malicious"


# ---------------------------------------------------------------------------
# cancel_reservation
# ---------------------------------------------------------------------------

class TestCancelReservation:
    """Tests for ReservationService.cancel_reservation."""

    def test_cancel_confirmed(self, service, db):
        """Cancels a confirmed reservation."""
        mock_r = _mock_reservation(res_id=RES_ID, status=ReservationStatus.CONFIRMED.value)
        db.query.return_value.filter.return_value.first.return_value = mock_r

        result = service.cancel_reservation(RES_ID, BIZ_ID)
        assert mock_r.status == ReservationStatus.CANCELLED.value
        db.commit.assert_called()

    def test_cancel_seated_raises(self, service, db):
        """Cannot cancel a seated reservation."""
        mock_r = _mock_reservation(res_id=RES_ID, status=ReservationStatus.SEATED.value)
        db.query.return_value.filter.return_value.first.return_value = mock_r

        with pytest.raises(ValueError, match="Cannot cancel"):
            service.cancel_reservation(RES_ID, BIZ_ID)

    def test_cancel_completed_raises(self, service, db):
        """Cannot cancel a completed reservation."""
        mock_r = _mock_reservation(res_id=RES_ID, status=ReservationStatus.COMPLETED.value)
        db.query.return_value.filter.return_value.first.return_value = mock_r

        with pytest.raises(ValueError, match="Cannot cancel"):
            service.cancel_reservation(RES_ID, BIZ_ID)

    def test_cancel_not_found(self, service, db):
        """Returns None when reservation doesn't exist."""
        db.query.return_value.filter.return_value.first.return_value = None
        result = service.cancel_reservation("nonexistent", BIZ_ID)
        assert result is None


# ---------------------------------------------------------------------------
# seat_reservation
# ---------------------------------------------------------------------------

class TestSeatReservation:
    """Tests for ReservationService.seat_reservation."""

    def test_seat_confirmed_reservation(self, service, db):
        """Seats a confirmed reservation and updates table status."""
        mock_r = _mock_reservation(
            res_id=RES_ID, status=ReservationStatus.CONFIRMED.value, table_id=TABLE_ID,
        )
        mock_table = MagicMock(spec=RestaurantTable)
        mock_table.status = TableStatus.AVAILABLE

        # get_reservation
        db.query.return_value.filter.return_value.first.return_value = mock_r
        # db.query(RestaurantTable).get(table_id) for table lookup
        db.query.return_value.get.return_value = mock_table

        result = service.seat_reservation(RES_ID, BIZ_ID)
        assert mock_r.status == ReservationStatus.SEATED.value
        assert mock_table.status == TableStatus.OCCUPIED
        db.commit.assert_called()

    def test_seat_non_confirmed_raises(self, service, db):
        """Cannot seat a reservation that isn't confirmed."""
        mock_r = _mock_reservation(
            res_id=RES_ID, status=ReservationStatus.CANCELLED.value,
        )
        db.query.return_value.filter.return_value.first.return_value = mock_r

        with pytest.raises(ValueError, match="Cannot seat"):
            service.seat_reservation(RES_ID, BIZ_ID)

    def test_seat_not_found(self, service, db):
        """Returns None when reservation doesn't exist."""
        db.query.return_value.filter.return_value.first.return_value = None
        result = service.seat_reservation("nonexistent", BIZ_ID)
        assert result is None


# ---------------------------------------------------------------------------
# mark_no_show
# ---------------------------------------------------------------------------

class TestMarkNoShow:
    """Tests for ReservationService.mark_no_show."""

    def test_no_show_confirmed(self, service, db):
        """Marks confirmed reservation as no-show."""
        mock_r = _mock_reservation(
            res_id=RES_ID, status=ReservationStatus.CONFIRMED.value,
        )
        db.query.return_value.filter.return_value.first.return_value = mock_r

        result = service.mark_no_show(RES_ID, BIZ_ID)
        assert mock_r.status == ReservationStatus.NO_SHOW.value
        db.commit.assert_called()

    def test_no_show_seated_raises(self, service, db):
        """Cannot mark a seated reservation as no-show."""
        mock_r = _mock_reservation(
            res_id=RES_ID, status=ReservationStatus.SEATED.value,
        )
        db.query.return_value.filter.return_value.first.return_value = mock_r

        with pytest.raises(ValueError, match="Only confirmed"):
            service.mark_no_show(RES_ID, BIZ_ID)

    def test_no_show_not_found(self, service, db):
        """Returns None when reservation doesn't exist."""
        db.query.return_value.filter.return_value.first.return_value = None
        result = service.mark_no_show("nonexistent", BIZ_ID)
        assert result is None


# ---------------------------------------------------------------------------
# check_conflicts
# ---------------------------------------------------------------------------

class TestCheckConflicts:
    """Tests for ReservationService.check_conflicts."""

    def test_no_conflicts(self, service, db):
        """Returns empty list when no overlap."""
        db.query.return_value.filter.return_value.filter.return_value = (
            db.query.return_value.filter.return_value
        )
        db.query.return_value.filter.return_value.all.return_value = []

        conflicts = service.check_conflicts(
            BIZ_ID, TABLE_ID,
            datetime(2025, 7, 25, 19, 0, tzinfo=timezone.utc),
            duration=90,
        )
        assert conflicts == []

    def test_detects_overlap(self, service, db):
        """Detects overlapping reservation."""
        # Existing reservation: 18:00 to 19:30
        existing = _mock_reservation(
            date_time=datetime(2025, 7, 25, 18, 0, tzinfo=timezone.utc),
            duration=90,
        )

        db.query.return_value.filter.return_value.all.return_value = [existing]

        # Proposed: 19:00 to 20:30 (overlaps with existing 18:00-19:30)
        conflicts = service.check_conflicts(
            BIZ_ID, TABLE_ID,
            datetime(2025, 7, 25, 19, 0, tzinfo=timezone.utc),
            duration=90,
        )
        assert len(conflicts) == 1
        assert conflicts[0] == existing

    def test_no_overlap_adjacent_slots(self, service, db):
        """Back-to-back slots don't conflict (end == start)."""
        # Existing: 18:00-19:30
        existing = _mock_reservation(
            date_time=datetime(2025, 7, 25, 18, 0, tzinfo=timezone.utc),
            duration=90,
        )

        db.query.return_value.filter.return_value.all.return_value = [existing]

        # Proposed: 19:30-21:00 (starts exactly when existing ends)
        conflicts = service.check_conflicts(
            BIZ_ID, TABLE_ID,
            datetime(2025, 7, 25, 19, 30, tzinfo=timezone.utc),
            duration=90,
        )
        assert len(conflicts) == 0

    def test_exclude_self_on_update(self, service, db):
        """Excludes the reservation being updated from conflict check."""
        db.query.return_value.filter.return_value.filter.return_value = (
            db.query.return_value.filter.return_value
        )
        db.query.return_value.filter.return_value.all.return_value = []

        conflicts = service.check_conflicts(
            BIZ_ID, TABLE_ID,
            datetime(2025, 7, 25, 19, 0, tzinfo=timezone.utc),
            duration=90,
            exclude_id=RES_ID,
        )
        assert conflicts == []


# ---------------------------------------------------------------------------
# get_upcoming
# ---------------------------------------------------------------------------

class TestGetUpcoming:
    """Tests for ReservationService.get_upcoming."""

    def test_returns_upcoming(self, service, db):
        """Returns confirmed reservations within time window."""
        mock_list = [_mock_reservation(), _mock_reservation()]
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = mock_list

        result = service.get_upcoming(BIZ_ID, hours=24)
        assert len(result) == 2

    def test_returns_empty_when_none(self, service, db):
        """Returns empty list when no upcoming reservations."""
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []

        result = service.get_upcoming(BIZ_ID, hours=4)
        assert result == []
