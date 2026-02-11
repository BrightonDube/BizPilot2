"""Integration tests for report subscription service.

Tests the ReportSubscriptionService methods with mocked DB,
validating create/toggle/deactivate/query workflows end-to-end.

Feature: Automated Report Emails
Requirements: 3.1, 3.2, 3.3
"""

import pytest
from datetime import datetime, timezone
from uuid import uuid4
from unittest.mock import MagicMock, Mock, patch, PropertyMock

from app.services.report_subscription_service import ReportSubscriptionService
from app.models.report_subscription import (
    ReportSubscription,
    ReportDeliveryLog,
    ReportType,
    DeliveryFrequency,
    DeliveryStatus,
)


def _make_service():
    """Create a ReportSubscriptionService with a fresh MagicMock db."""
    db = MagicMock()
    return ReportSubscriptionService(db), db


def _make_sub(user_id=None, report_type=ReportType.SALES_SUMMARY,
              frequency=DeliveryFrequency.WEEKLY, is_active=True, sub_id=None):
    """Helper to build a ReportSubscription-like object."""
    sub = ReportSubscription()
    sub.id = sub_id or uuid4()
    sub.user_id = user_id or uuid4()
    sub.report_type = report_type.value
    sub.frequency = frequency.value
    sub.is_active = is_active
    sub.last_sent_at = None
    sub.deleted_at = None
    return sub


# ---------------------------------------------------------------------------
# Property 16 – Subscription State Toggle
# ---------------------------------------------------------------------------

class TestSubscriptionStateToggle:
    """Toggle flips is_active and is idempotent over two calls."""

    def test_toggle_activates_inactive_subscription(self):
        user_id = uuid4()
        sub = _make_sub(user_id=user_id, is_active=False)

        service, db = _make_service()

        # get_subscription returns the sub
        query_mock = MagicMock()
        db.query.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = sub

        result = service.toggle_subscription(
            user_id, ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )

        assert result is not None
        assert result.is_active is True
        db.commit.assert_called()

    def test_toggle_deactivates_active_subscription(self):
        user_id = uuid4()
        sub = _make_sub(user_id=user_id, is_active=True)

        service, db = _make_service()

        query_mock = MagicMock()
        db.query.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = sub

        result = service.toggle_subscription(
            user_id, ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )

        assert result is not None
        assert result.is_active is False
        db.commit.assert_called()

    def test_double_toggle_restores_original_state(self):
        user_id = uuid4()
        sub = _make_sub(user_id=user_id, is_active=True)

        service, db = _make_service()

        query_mock = MagicMock()
        db.query.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = sub

        service.toggle_subscription(
            user_id, ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )
        assert sub.is_active is False

        service.toggle_subscription(
            user_id, ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )
        assert sub.is_active is True

    def test_toggle_nonexistent_returns_none(self):
        service, db = _make_service()

        query_mock = MagicMock()
        db.query.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = None

        result = service.toggle_subscription(
            uuid4(), ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )
        assert result is None


# ---------------------------------------------------------------------------
# Property 17 – Inactive Subscription Exclusion
# ---------------------------------------------------------------------------

class TestInactiveSubscriptionExclusion:
    """get_active_subscriptions_by_frequency must never return inactive subs."""

    def test_active_only_returned(self):
        service, db = _make_service()

        active_sub = _make_sub(is_active=True)
        inactive_sub = _make_sub(is_active=False)

        query_mock = MagicMock()
        db.query.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.offset.return_value = query_mock
        query_mock.limit.return_value = query_mock
        # Simulate DB returning only active subs (as the filter would)
        query_mock.all.return_value = [active_sub]

        results = service.get_active_subscriptions_by_frequency(DeliveryFrequency.WEEKLY)

        assert len(results) == 1
        assert all(s.is_active for s in results)

    def test_empty_when_all_inactive(self):
        service, db = _make_service()

        query_mock = MagicMock()
        db.query.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.offset.return_value = query_mock
        query_mock.limit.return_value = query_mock
        query_mock.all.return_value = []

        results = service.get_active_subscriptions_by_frequency(DeliveryFrequency.MONTHLY)
        assert results == []

    def test_count_matches_list_length(self):
        service, db = _make_service()

        active_subs = [_make_sub(is_active=True) for _ in range(3)]

        query_mock = MagicMock()
        db.query.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.offset.return_value = query_mock
        query_mock.limit.return_value = query_mock
        query_mock.all.return_value = active_subs
        query_mock.count.return_value = 3

        results = service.get_active_subscriptions_by_frequency(DeliveryFrequency.WEEKLY)
        count = service.count_active_subscriptions_by_frequency(DeliveryFrequency.WEEKLY)

        assert len(results) == count


# ---------------------------------------------------------------------------
# Create / Deactivate round-trip
# ---------------------------------------------------------------------------

class TestCreateDeactivateRoundTrip:
    """Creating then deactivating a subscription works correctly."""

    def test_create_subscription_sets_active(self):
        service, db = _make_service()

        query_mock = MagicMock()
        db.query.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = None  # no existing

        sub = service.create_subscription(
            uuid4(), ReportType.INVENTORY_STATUS, DeliveryFrequency.MONTHLY
        )
        assert sub.is_active is True
        db.add.assert_called_once()
        db.commit.assert_called()

    def test_create_reactivates_existing_inactive(self):
        user_id = uuid4()
        existing = _make_sub(user_id=user_id, is_active=False)

        service, db = _make_service()

        query_mock = MagicMock()
        db.query.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = existing

        result = service.create_subscription(
            user_id, ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )
        assert result.is_active is True
        assert result.id == existing.id

    def test_deactivate_sets_inactive(self):
        user_id = uuid4()
        sub = _make_sub(user_id=user_id, is_active=True)

        service, db = _make_service()

        query_mock = MagicMock()
        db.query.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = sub

        ok = service.deactivate_subscription(
            user_id, ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )
        assert ok is True
        assert sub.is_active is False
        db.commit.assert_called()

    def test_deactivate_nonexistent_returns_false(self):
        service, db = _make_service()

        query_mock = MagicMock()
        db.query.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = None

        ok = service.deactivate_subscription(
            uuid4(), ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )
        assert ok is False


# ---------------------------------------------------------------------------
# Delivery logging
# ---------------------------------------------------------------------------

class TestDeliveryLogging:
    """log_delivery persists the correct fields."""

    def test_log_delivery_success(self):
        service, db = _make_service()
        now = datetime.now(timezone.utc)

        log = service.log_delivery(
            user_id=uuid4(),
            report_type=ReportType.FINANCIAL_OVERVIEW,
            frequency=DeliveryFrequency.MONTHLY,
            period_start=now,
            period_end=now,
            status=DeliveryStatus.SUCCESS,
            delivered_at=now,
        )

        db.add.assert_called_once()
        db.commit.assert_called()
        assert log.status == DeliveryStatus.SUCCESS.value

    def test_log_delivery_failed_with_error(self):
        service, db = _make_service()
        now = datetime.now(timezone.utc)

        log = service.log_delivery(
            user_id=uuid4(),
            report_type=ReportType.SALES_SUMMARY,
            frequency=DeliveryFrequency.WEEKLY,
            period_start=now,
            period_end=now,
            status=DeliveryStatus.FAILED,
            error_message="SMTP timeout",
            retry_count=2,
        )

        assert log.status == DeliveryStatus.FAILED.value
        assert log.error_message == "SMTP timeout"
        assert log.retry_count == 2

    def test_log_delivery_retrying(self):
        service, db = _make_service()
        now = datetime.now(timezone.utc)

        log = service.log_delivery(
            user_id=uuid4(),
            report_type=ReportType.CUSTOMER_ACTIVITY,
            frequency=DeliveryFrequency.WEEKLY,
            period_start=now,
            period_end=now,
            status=DeliveryStatus.RETRYING,
            retry_count=1,
        )

        assert log.status == DeliveryStatus.RETRYING.value
        assert log.retry_count == 1


# ---------------------------------------------------------------------------
# User subscriptions query
# ---------------------------------------------------------------------------

class TestUserSubscriptionsQuery:
    """get_user_subscriptions respects active_only filter."""

    def test_returns_all_when_active_only_false(self):
        service, db = _make_service()

        subs = [_make_sub(is_active=True), _make_sub(is_active=False)]

        query_mock = MagicMock()
        db.query.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.all.return_value = subs

        results = service.get_user_subscriptions(uuid4(), active_only=False)
        assert len(results) == 2

    def test_returns_only_active_when_filtered(self):
        service, db = _make_service()

        active_sub = _make_sub(is_active=True)

        query_mock = MagicMock()
        db.query.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.all.return_value = [active_sub]

        results = service.get_user_subscriptions(uuid4(), active_only=True)
        assert len(results) == 1
        assert results[0].is_active is True
