"""Tests for time tracking service."""

import pytest
from datetime import datetime, time, timezone, timedelta
from decimal import Decimal
from unittest.mock import MagicMock

from app.services.time_tracking_service import TimeTrackingService
from app.models.time_entry import TimeEntry, TimeEntryStatus
from app.models.business_time_settings import BusinessTimeSettings

class TestTimeTrackingService:
    """Tests for TimeTrackingService logic."""

    @pytest.fixture
    def mock_db(self):
        return MagicMock()

    @pytest.fixture
    def service(self, mock_db):
        return TimeTrackingService(mock_db)

    def test_auto_clock_out_exceeds_paid_limit(self, service, mock_db):
        """Test auto clock out when actual hours exceed paid limit."""
        # Setup mock settings
        mock_settings = BusinessTimeSettings(
            business_id="b1",
            day_end_time=time(5, 0),
            auto_clock_out_penalty_hours=Decimal("4.00")
        )
        service.get_or_create_business_settings = MagicMock(return_value=mock_settings)

        # Setup mock active entry
        now = datetime.now(timezone.utc)
        clock_in = now - timedelta(hours=10) # 10 hours ago
        active_entry = TimeEntry(
            id="e1",
            business_id="b1",
            user_id="u1",
            clock_in=clock_in,
            status=TimeEntryStatus.ACTIVE
        )
        
        mock_db.query().filter().first.return_value = active_entry

        # Act
        result = service.clock_out(business_id="b1", user_id="u1", auto_clock_out=True)

        # Assert
        assert result.is_auto_clocked_out is True
        assert result.hours_worked == Decimal("10.00")
        assert result.net_hours == Decimal("4.00")
        assert result.penalty_hours == Decimal("6.00")
        assert mock_db.commit.called

    def test_auto_clock_out_below_paid_limit(self, service, mock_db):
        """Test auto clock out when actual hours are below paid limit."""
        # Setup mock settings
        mock_settings = BusinessTimeSettings(
            business_id="b1",
            day_end_time=time(5, 0),
            auto_clock_out_penalty_hours=Decimal("4.00")
        )
        service.get_or_create_business_settings = MagicMock(return_value=mock_settings)

        # Setup mock active entry
        now = datetime.now(timezone.utc)
        clock_in = now - timedelta(hours=3) # 3 hours ago
        active_entry = TimeEntry(
            id="e2",
            business_id="b1",
            user_id="u1",
            clock_in=clock_in,
            status=TimeEntryStatus.ACTIVE
        )
        
        mock_db.query().filter().first.return_value = active_entry

        # Act
        result = service.clock_out(business_id="b1", user_id="u1", auto_clock_out=True)

        # Assert
        assert result.is_auto_clocked_out is True
        assert result.hours_worked == Decimal("3.00")
        assert result.net_hours == Decimal("3.00")
        assert result.penalty_hours == Decimal("0.00")
        assert mock_db.commit.called
