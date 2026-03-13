"""Unit tests for DeliveryTrackingService.

Covers driver shift CRUD, delivery tracking updates/history,
proof-of-delivery validation, and ETA calculation.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")

import uuid
from datetime import date, time
from unittest.mock import MagicMock, patch

import pytest

from app.models.delivery_tracking import (
    DriverShift,
    DriverShiftStatus,
    DeliveryTracking,
    DeliveryProof,
)
from app.services.delivery_tracking_service import DeliveryTrackingService


DRIVER_ID = uuid.uuid4()
SHIFT_ID = uuid.uuid4()
DELIVERY_ID = uuid.uuid4()


def _chain(first=None, rows=None, count=0):
    """Reusable mock that supports the common SQLAlchemy chained-call pattern."""
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.order_by = MagicMock(return_value=q)
    q.offset = MagicMock(return_value=q)
    q.limit = MagicMock(return_value=q)
    q.all = MagicMock(return_value=rows or [])
    q.first = MagicMock(return_value=first)
    q.count = MagicMock(return_value=count)
    return q


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def svc(db):
    return DeliveryTrackingService(db)


# ── Driver Shifts ────────────────────────────────────────────────


class TestCreateShift:
    @patch("app.services.delivery_tracking_service.DriverShift")
    def test_creates_shift_successfully(self, MockShift, svc, db):
        sentinel = MagicMock()
        MockShift.return_value = sentinel

        result = svc.create_shift(
            DRIVER_ID,
            shift_date=date(2025, 7, 1),
            start_time=time(8, 0),
            end_time=time(16, 0),
        )

        MockShift.assert_called_once()
        kwargs = MockShift.call_args[1]
        assert kwargs["driver_id"] == DRIVER_ID
        assert kwargs["shift_date"] == date(2025, 7, 1)
        assert kwargs["start_time"] == time(8, 0)
        assert kwargs["end_time"] == time(16, 0)
        assert kwargs["status"] == DriverShiftStatus.SCHEDULED.value

        db.add.assert_called_once_with(sentinel)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(sentinel)
        assert result is sentinel

    def test_raises_when_end_before_start(self, svc):
        with pytest.raises(ValueError, match="end_time must be after start_time"):
            svc.create_shift(
                DRIVER_ID,
                shift_date=date(2025, 7, 1),
                start_time=time(16, 0),
                end_time=time(8, 0),
            )

    def test_raises_when_end_equals_start(self, svc):
        with pytest.raises(ValueError, match="end_time must be after start_time"):
            svc.create_shift(
                DRIVER_ID,
                shift_date=date(2025, 7, 1),
                start_time=time(12, 0),
                end_time=time(12, 0),
            )


class TestStartShift:
    def test_starts_shift_successfully(self, svc, db):
        mock_shift = MagicMock()
        db.query.return_value = _chain(first=mock_shift)

        result = svc.start_shift(SHIFT_ID)

        assert result is mock_shift
        assert mock_shift.status == DriverShiftStatus.STARTED.value
        assert mock_shift.actual_start is not None
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(mock_shift)

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.start_shift(SHIFT_ID)

        assert result is None
        db.commit.assert_not_called()


class TestEndShift:
    def test_ends_shift_successfully(self, svc, db):
        mock_shift = MagicMock()
        db.query.return_value = _chain(first=mock_shift)

        result = svc.end_shift(SHIFT_ID)

        assert result is mock_shift
        assert mock_shift.status == DriverShiftStatus.COMPLETED.value
        assert mock_shift.actual_end is not None
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(mock_shift)

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.end_shift(SHIFT_ID)

        assert result is None
        db.commit.assert_not_called()


class TestListShifts:
    def test_basic_list(self, svc, db):
        rows = [MagicMock(), MagicMock()]
        db.query.return_value = _chain(rows=rows, count=2)

        items, total = svc.list_shifts(DRIVER_ID)

        assert items == rows
        assert total == 2
        db.query.assert_called_once_with(DriverShift)

    def test_with_date_filters(self, svc, db):
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_shifts(
            DRIVER_ID,
            from_date=date(2025, 1, 1),
            to_date=date(2025, 12, 31),
        )

        # Initial filter + from_date filter + to_date filter = 3 calls
        assert chain.filter.call_count == 3

    def test_with_from_date_only(self, svc, db):
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_shifts(DRIVER_ID, from_date=date(2025, 6, 1))

        # Initial filter + from_date filter = 2 calls
        assert chain.filter.call_count == 2

    def test_with_to_date_only(self, svc, db):
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_shifts(DRIVER_ID, to_date=date(2025, 6, 30))

        # Initial filter + to_date filter = 2 calls
        assert chain.filter.call_count == 2

    def test_pagination(self, svc, db):
        chain = _chain(rows=[], count=50)
        db.query.return_value = chain

        items, total = svc.list_shifts(DRIVER_ID, page=3, per_page=10)

        assert total == 50
        # offset should be (3-1)*10 = 20
        chain.offset.assert_called_once_with(20)
        chain.limit.assert_called_once_with(10)

    def test_empty_result(self, svc, db):
        db.query.return_value = _chain(rows=[], count=0)

        items, total = svc.list_shifts(DRIVER_ID)

        assert items == []
        assert total == 0


# ── Delivery Tracking ────────────────────────────────────────────


class TestAddTrackingUpdate:
    @patch("app.services.delivery_tracking_service.DeliveryTracking")
    def test_with_all_params(self, MockTracking, svc, db):
        sentinel = MagicMock()
        MockTracking.return_value = sentinel
        location = {"lat": -33.9, "lng": 18.4}

        result = svc.add_tracking_update(
            DELIVERY_ID,
            status="in_transit",
            location=location,
            eta_minutes=15,
            notes="Driver en route",
        )

        MockTracking.assert_called_once()
        kwargs = MockTracking.call_args[1]
        assert kwargs["delivery_id"] == DELIVERY_ID
        assert kwargs["status"] == "in_transit"
        assert kwargs["location"] == location
        assert kwargs["eta_minutes"] == 15
        assert kwargs["notes"] == "Driver en route"
        assert kwargs["recorded_at"] is not None

        db.add.assert_called_once_with(sentinel)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(sentinel)
        assert result is sentinel

    @patch("app.services.delivery_tracking_service.DeliveryTracking")
    def test_with_minimal_params(self, MockTracking, svc, db):
        sentinel = MagicMock()
        MockTracking.return_value = sentinel

        result = svc.add_tracking_update(
            DELIVERY_ID,
            status="picked_up",
        )

        kwargs = MockTracking.call_args[1]
        assert kwargs["status"] == "picked_up"
        assert kwargs["location"] is None
        assert kwargs["eta_minutes"] is None
        assert kwargs["notes"] is None
        assert result is sentinel


class TestGetTrackingHistory:
    def test_returns_ordered_results(self, svc, db):
        rows = [MagicMock(), MagicMock(), MagicMock()]
        db.query.return_value = _chain(rows=rows)

        result = svc.get_tracking_history(DELIVERY_ID)

        assert result == rows
        assert len(result) == 3
        db.query.assert_called_once_with(DeliveryTracking)

    def test_returns_empty_list(self, svc, db):
        db.query.return_value = _chain(rows=[])

        result = svc.get_tracking_history(DELIVERY_ID)

        assert result == []


class TestGetLatestTracking:
    def test_returns_latest_when_found(self, svc, db):
        mock_tracking = MagicMock()
        db.query.return_value = _chain(first=mock_tracking)

        result = svc.get_latest_tracking(DELIVERY_ID)

        assert result is mock_tracking
        db.query.assert_called_once_with(DeliveryTracking)

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.get_latest_tracking(DELIVERY_ID)

        assert result is None


# ── Delivery Proofs ──────────────────────────────────────────────


class TestAddProof:
    @patch("app.services.delivery_tracking_service.DeliveryProof")
    def test_signature_proof(self, MockProof, svc, db):
        sentinel = MagicMock()
        MockProof.return_value = sentinel

        result = svc.add_proof(
            DELIVERY_ID,
            proof_type="signature",
            signature_url="https://storage.example.com/sig.png",
            recipient_name="John Doe",
        )

        kwargs = MockProof.call_args[1]
        assert kwargs["proof_type"] == "signature"
        assert kwargs["signature_url"] == "https://storage.example.com/sig.png"
        assert kwargs["recipient_name"] == "John Doe"
        db.add.assert_called_once_with(sentinel)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(sentinel)
        assert result is sentinel

    @patch("app.services.delivery_tracking_service.DeliveryProof")
    def test_photo_proof(self, MockProof, svc, db):
        sentinel = MagicMock()
        MockProof.return_value = sentinel

        result = svc.add_proof(
            DELIVERY_ID,
            proof_type="photo",
            photo_url="https://storage.example.com/photo.jpg",
        )

        kwargs = MockProof.call_args[1]
        assert kwargs["proof_type"] == "photo"
        assert kwargs["photo_url"] == "https://storage.example.com/photo.jpg"
        assert result is sentinel

    @patch("app.services.delivery_tracking_service.DeliveryProof")
    def test_both_proof(self, MockProof, svc, db):
        sentinel = MagicMock()
        MockProof.return_value = sentinel

        result = svc.add_proof(
            DELIVERY_ID,
            proof_type="both",
            signature_url="https://storage.example.com/sig.png",
            photo_url="https://storage.example.com/photo.jpg",
            recipient_name="Jane Doe",
        )

        kwargs = MockProof.call_args[1]
        assert kwargs["proof_type"] == "both"
        assert kwargs["signature_url"] == "https://storage.example.com/sig.png"
        assert kwargs["photo_url"] == "https://storage.example.com/photo.jpg"
        assert result is sentinel

    def test_signature_missing_url_raises(self, svc):
        with pytest.raises(ValueError, match="signature_url required"):
            svc.add_proof(DELIVERY_ID, proof_type="signature")

    def test_photo_missing_url_raises(self, svc):
        with pytest.raises(ValueError, match="photo_url required"):
            svc.add_proof(DELIVERY_ID, proof_type="photo")

    def test_both_missing_signature_raises(self, svc):
        with pytest.raises(ValueError, match="Both signature_url and photo_url"):
            svc.add_proof(
                DELIVERY_ID,
                proof_type="both",
                photo_url="https://storage.example.com/photo.jpg",
            )

    def test_both_missing_photo_raises(self, svc):
        with pytest.raises(ValueError, match="Both signature_url and photo_url"):
            svc.add_proof(
                DELIVERY_ID,
                proof_type="both",
                signature_url="https://storage.example.com/sig.png",
            )

    def test_both_missing_all_raises(self, svc):
        with pytest.raises(ValueError, match="Both signature_url and photo_url"):
            svc.add_proof(DELIVERY_ID, proof_type="both")


class TestGetProof:
    def test_returns_proof_when_found(self, svc, db):
        mock_proof = MagicMock()
        db.query.return_value = _chain(first=mock_proof)

        result = svc.get_proof(DELIVERY_ID)

        assert result is mock_proof
        db.query.assert_called_once_with(DeliveryProof)

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.get_proof(DELIVERY_ID)

        assert result is None


# ── ETA Calculation ──────────────────────────────────────────────


class TestEstimateEta:
    def test_normal_distance(self):
        # 15 km at 30 km/h = 30 min travel + 10 min prep = 40
        result = DeliveryTrackingService.estimate_eta_minutes(15.0)
        assert result == 40

    def test_zero_distance(self):
        result = DeliveryTrackingService.estimate_eta_minutes(0.0)
        assert result == 10

    def test_negative_distance(self):
        result = DeliveryTrackingService.estimate_eta_minutes(-5.0)
        assert result == 10

    def test_custom_speed(self):
        # 60 km at 60 km/h = 60 min travel + 10 min prep = 70
        result = DeliveryTrackingService.estimate_eta_minutes(60.0, avg_speed_kmh=60.0)
        assert result == 70

    def test_custom_prep_minutes(self):
        # 15 km at 30 km/h = 30 min travel + 5 min prep = 35
        result = DeliveryTrackingService.estimate_eta_minutes(
            15.0, prep_minutes=5
        )
        assert result == 35

    def test_fractional_result_rounds(self):
        # 10 km at 30 km/h = 20 min travel + 10 min prep = 30
        result = DeliveryTrackingService.estimate_eta_minutes(10.0)
        assert result == 30
        assert isinstance(result, int)

    def test_small_distance(self):
        # 1 km at 30 km/h = 2.0 min travel + 10 prep = 12
        result = DeliveryTrackingService.estimate_eta_minutes(1.0)
        assert result == 12

    def test_zero_distance_with_custom_prep(self):
        result = DeliveryTrackingService.estimate_eta_minutes(0.0, prep_minutes=20)
        assert result == 20
