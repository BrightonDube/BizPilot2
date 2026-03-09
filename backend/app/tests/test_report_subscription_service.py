"""Unit tests for ReportSubscriptionService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import datetime
from unittest.mock import MagicMock, call
from uuid import uuid4

import pytest

from app.services.report_subscription_service import ReportSubscriptionService
from app.models.report_subscription import (
    ReportSubscription,
    ReportDeliveryLog,
    ReportType,
    DeliveryFrequency,
    DeliveryStatus,
)


USER_ID = uuid4()
SUB_ID = uuid4()


def _svc():
    db = MagicMock()
    return ReportSubscriptionService(db), db


def _chain(first=None, count=0, rows=None):
    chain = MagicMock()
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.offset.return_value = chain
    chain.limit.return_value = chain
    chain.all.return_value = rows if rows is not None else []
    chain.first.return_value = first
    chain.count.return_value = count
    return chain


def _sub(active=True, **overrides):
    sub = MagicMock(spec=ReportSubscription)
    sub.id = overrides.get("id", SUB_ID)
    sub.user_id = overrides.get("user_id", USER_ID)
    sub.report_type = overrides.get("report_type", ReportType.SALES_SUMMARY.value)
    sub.frequency = overrides.get("frequency", DeliveryFrequency.WEEKLY.value)
    sub.is_active = active
    sub.last_sent_at = overrides.get("last_sent_at", None)
    return sub


# ── create_subscription ─────────────────────────────────────────────


class TestCreateSubscription:
    def test_creates_new_subscription(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.create_subscription(
            USER_ID, ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, ReportSubscription)
        assert added.report_type == ReportType.SALES_SUMMARY.value
        assert added.frequency == DeliveryFrequency.WEEKLY.value
        assert added.is_active is True

    def test_reactivates_inactive_subscription(self):
        svc, db = _svc()
        existing = _sub(active=False)
        chain = _chain(first=existing)
        db.query.return_value = chain

        result = svc.create_subscription(
            USER_ID, ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )

        assert existing.is_active is True
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(existing)
        assert result is existing

    def test_returns_existing_active_subscription(self):
        svc, db = _svc()
        existing = _sub(active=True)
        chain = _chain(first=existing)
        db.query.return_value = chain

        result = svc.create_subscription(
            USER_ID, ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )

        db.add.assert_not_called()
        db.commit.assert_not_called()
        assert result is existing


# ── deactivate_subscription ──────────────────────────────────────────


class TestDeactivateSubscription:
    def test_deactivates_existing_subscription(self):
        svc, db = _svc()
        existing = _sub(active=True)
        chain = _chain(first=existing)
        db.query.return_value = chain

        result = svc.deactivate_subscription(
            USER_ID, ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )

        assert result is True
        assert existing.is_active is False
        db.commit.assert_called_once()

    def test_returns_false_when_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.deactivate_subscription(
            USER_ID, ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )

        assert result is False
        db.commit.assert_not_called()


# ── get_user_subscriptions ───────────────────────────────────────────


class TestGetUserSubscriptions:
    def test_returns_all_subscriptions(self):
        svc, db = _svc()
        subs = [_sub(), _sub(active=False)]
        chain = _chain(rows=subs)
        db.query.return_value = chain

        result = svc.get_user_subscriptions(USER_ID)

        assert result == subs
        # filter called once (no active_only filter)
        assert chain.filter.call_count == 1

    def test_active_only_adds_extra_filter(self):
        svc, db = _svc()
        active_sub = _sub(active=True)
        chain = _chain(rows=[active_sub])
        db.query.return_value = chain

        result = svc.get_user_subscriptions(USER_ID, active_only=True)

        assert result == [active_sub]
        # filter called twice: base + is_active
        assert chain.filter.call_count == 2

    def test_returns_empty_list(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        result = svc.get_user_subscriptions(USER_ID)

        assert result == []


# ── get_subscription ─────────────────────────────────────────────────


class TestGetSubscription:
    def test_returns_subscription_when_found(self):
        svc, db = _svc()
        existing = _sub()
        chain = _chain(first=existing)
        db.query.return_value = chain

        result = svc.get_subscription(
            USER_ID, ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )

        assert result is existing

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.get_subscription(
            USER_ID, ReportType.INVENTORY_STATUS, DeliveryFrequency.MONTHLY
        )

        assert result is None


# ── get_active_subscriptions_by_frequency ────────────────────────────


class TestGetActiveSubscriptionsByFrequency:
    def test_returns_paginated_results(self):
        svc, db = _svc()
        subs = [_sub() for _ in range(3)]
        chain = _chain(rows=subs)
        db.query.return_value = chain

        result = svc.get_active_subscriptions_by_frequency(
            DeliveryFrequency.WEEKLY, batch_size=10, offset=0
        )

        assert result == subs
        chain.offset.assert_called_once_with(0)
        chain.limit.assert_called_once_with(10)

    def test_uses_default_batch_size(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.get_active_subscriptions_by_frequency(DeliveryFrequency.MONTHLY)

        chain.offset.assert_called_once_with(0)
        chain.limit.assert_called_once_with(50)


# ── count_active_subscriptions_by_frequency ──────────────────────────


class TestCountActiveSubscriptionsByFrequency:
    def test_returns_count(self):
        svc, db = _svc()
        chain = _chain(count=42)
        db.query.return_value = chain

        result = svc.count_active_subscriptions_by_frequency(DeliveryFrequency.WEEKLY)

        assert result == 42

    def test_returns_zero(self):
        svc, db = _svc()
        chain = _chain(count=0)
        db.query.return_value = chain

        result = svc.count_active_subscriptions_by_frequency(DeliveryFrequency.MONTHLY)

        assert result == 0


# ── update_last_sent ─────────────────────────────────────────────────


class TestUpdateLastSent:
    def test_updates_timestamp(self):
        svc, db = _svc()
        existing = _sub()
        chain = _chain(first=existing)
        db.query.return_value = chain
        now = datetime(2025, 6, 1, 12, 0, 0)

        svc.update_last_sent(SUB_ID, now)

        assert existing.last_sent_at == now
        db.commit.assert_called_once()

    def test_noop_when_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        svc.update_last_sent(uuid4(), datetime.now())

        db.commit.assert_not_called()


# ── log_delivery ─────────────────────────────────────────────────────


class TestLogDelivery:
    def test_creates_delivery_log(self):
        svc, db = _svc()
        start = datetime(2025, 1, 1)
        end = datetime(2025, 1, 31)

        result = svc.log_delivery(
            user_id=USER_ID,
            report_type=ReportType.SALES_SUMMARY,
            frequency=DeliveryFrequency.WEEKLY,
            period_start=start,
            period_end=end,
            status=DeliveryStatus.SUCCESS,
        )

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        log = db.add.call_args[0][0]
        assert isinstance(log, ReportDeliveryLog)
        assert log.user_id == USER_ID
        assert log.report_type == ReportType.SALES_SUMMARY.value
        assert log.status == DeliveryStatus.SUCCESS.value
        assert log.error_message is None
        assert log.retry_count == 0

    def test_creates_failed_delivery_log(self):
        svc, db = _svc()
        start = datetime(2025, 1, 1)
        end = datetime(2025, 1, 31)

        svc.log_delivery(
            user_id=USER_ID,
            report_type=ReportType.FINANCIAL_OVERVIEW,
            frequency=DeliveryFrequency.MONTHLY,
            period_start=start,
            period_end=end,
            status=DeliveryStatus.FAILED,
            error_message="SMTP connection refused",
            retry_count=3,
        )

        log = db.add.call_args[0][0]
        assert log.status == DeliveryStatus.FAILED.value
        assert log.error_message == "SMTP connection refused"
        assert log.retry_count == 3


# ── get_delivery_logs ────────────────────────────────────────────────


class TestGetDeliveryLogs:
    def test_returns_logs_ordered(self):
        svc, db = _svc()
        logs = [MagicMock(spec=ReportDeliveryLog) for _ in range(3)]
        chain = _chain(rows=logs)
        db.query.return_value = chain

        result = svc.get_delivery_logs(USER_ID)

        assert result == logs
        chain.order_by.assert_called_once()
        chain.limit.assert_called_once_with(50)

    def test_custom_limit(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.get_delivery_logs(USER_ID, limit=10)

        chain.limit.assert_called_once_with(10)


# ── toggle_subscription ─────────────────────────────────────────────


class TestToggleSubscription:
    def test_toggles_active_to_inactive(self):
        svc, db = _svc()
        existing = _sub(active=True)
        chain = _chain(first=existing)
        db.query.return_value = chain

        result = svc.toggle_subscription(
            USER_ID, ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )

        assert result is existing
        assert existing.is_active is False
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(existing)

    def test_toggles_inactive_to_active(self):
        svc, db = _svc()
        existing = _sub(active=False)
        chain = _chain(first=existing)
        db.query.return_value = chain

        result = svc.toggle_subscription(
            USER_ID, ReportType.SALES_SUMMARY, DeliveryFrequency.WEEKLY
        )

        assert result is existing
        assert existing.is_active is True
        db.commit.assert_called_once()

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.toggle_subscription(
            USER_ID, ReportType.INVENTORY_STATUS, DeliveryFrequency.MONTHLY
        )

        assert result is None
        db.commit.assert_not_called()
