"""Tests for NotificationService."""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from unittest.mock import MagicMock, call

import pytest

from app.services.notification_service import NotificationService
from app.models.notification import Notification, NotificationPreference
from app.models.business_user import BusinessUser, BusinessUserStatus


# ── helpers ──────────────────────────────────────────────────────

BIZ_ID = str(uuid.uuid4())
USER_ID = str(uuid.uuid4())
USER_ID_2 = str(uuid.uuid4())
NOTIF_ID = str(uuid.uuid4())


def _chain(first=None, rows=None, count=0, scalar=0, update=0):
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
    c.update.return_value = update
    return c


def _make_notification(**overrides):
    n = MagicMock(spec=Notification)
    n.id = uuid.uuid4()
    n.business_id = UUID(BIZ_ID)
    n.user_id = UUID(USER_ID)
    n.title = "Test Title"
    n.message = "Test message"
    n.notification_type = "info"
    n.channel = "in_app"
    n.is_read = False
    n.action_url = None
    n.resource_type = None
    n.resource_id = None
    for k, v in overrides.items():
        setattr(n, k, v)
    return n


def UUID(s):
    """Shortcut – accepts str or uuid, always returns uuid.UUID."""
    return uuid.UUID(s) if isinstance(s, str) else s


def _make_bu(user_id):
    bu = MagicMock(spec=BusinessUser)
    bu.user_id = UUID(user_id)
    bu.business_id = UUID(BIZ_ID)
    bu.status = BusinessUserStatus.ACTIVE
    return bu


# ── create_notification ──────────────────────────────────────────

class TestCreateNotification:
    def test_creates_with_defaults(self):
        db = MagicMock()
        svc = NotificationService(db)

        result = svc.create_notification(BIZ_ID, USER_ID, "Title", "Msg")

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, Notification)
        assert added.title == "Title"
        assert added.message == "Msg"
        assert added.notification_type == "info"
        assert added.channel == "in_app"

    def test_creates_with_optional_fields(self):
        db = MagicMock()
        svc = NotificationService(db)

        result = svc.create_notification(
            BIZ_ID, USER_ID, "T", "M",
            notification_type="warning",
            channel="email",
            action_url="/orders/1",
            resource_type="order",
            resource_id="abc-123",
        )

        added = db.add.call_args[0][0]
        assert added.notification_type == "warning"
        assert added.channel == "email"
        assert added.action_url == "/orders/1"
        assert added.resource_type == "order"
        assert added.resource_id == "abc-123"


# ── notify_business_users ────────────────────────────────────────

class TestNotifyBusinessUsers:
    def test_notifies_all_active_users(self):
        db = MagicMock()
        bu1 = _make_bu(USER_ID)
        bu2 = _make_bu(USER_ID_2)
        db.query.return_value = _chain(rows=[bu1, bu2])
        svc = NotificationService(db)

        result = svc.notify_business_users(BIZ_ID, "Alert", "Something happened")

        assert db.add.call_count == 2
        assert db.commit.call_count == 1
        assert db.refresh.call_count == 2
        assert len(result) == 2

    def test_excludes_specified_user(self):
        db = MagicMock()
        chain = _chain(rows=[_make_bu(USER_ID_2)])
        db.query.return_value = chain
        svc = NotificationService(db)

        result = svc.notify_business_users(
            BIZ_ID, "Alert", "Msg", exclude_user_id=USER_ID
        )

        # filter called twice: initial filter + exclude filter
        assert chain.filter.call_count == 2
        assert len(result) == 1

    def test_returns_empty_when_no_active_users(self):
        db = MagicMock()
        db.query.return_value = _chain(rows=[])
        svc = NotificationService(db)

        result = svc.notify_business_users(BIZ_ID, "T", "M")

        assert result == []
        db.add.assert_not_called()


# ── list_notifications ───────────────────────────────────────────

class TestListNotifications:
    def test_default_pagination(self):
        db = MagicMock()
        n1 = _make_notification()
        chain = _chain(rows=[n1], count=1)
        db.query.return_value = chain
        svc = NotificationService(db)

        items, total = svc.list_notifications(USER_ID)

        assert total == 1
        assert items == [n1]
        chain.offset.assert_called_once_with(0)
        chain.limit.assert_called_once_with(20)

    def test_page_two(self):
        db = MagicMock()
        chain = _chain(rows=[], count=25)
        db.query.return_value = chain
        svc = NotificationService(db)

        items, total = svc.list_notifications(USER_ID, page=2, per_page=10)

        assert total == 25
        chain.offset.assert_called_once_with(10)
        chain.limit.assert_called_once_with(10)

    def test_filter_by_is_read(self):
        db = MagicMock()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc = NotificationService(db)

        svc.list_notifications(USER_ID, is_read=True)

        # base filter + is_read filter
        assert chain.filter.call_count == 2

    def test_filter_by_notification_type(self):
        db = MagicMock()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc = NotificationService(db)

        svc.list_notifications(USER_ID, notification_type="warning")

        assert chain.filter.call_count == 2


# ── get_unread_count ─────────────────────────────────────────────

class TestGetUnreadCount:
    def test_returns_count(self):
        db = MagicMock()
        db.query.return_value = _chain(scalar=5)
        svc = NotificationService(db)

        assert svc.get_unread_count(USER_ID) == 5

    def test_returns_zero_when_scalar_is_none(self):
        db = MagicMock()
        db.query.return_value = _chain(scalar=None)
        svc = NotificationService(db)

        assert svc.get_unread_count(USER_ID) == 0


# ── mark_as_read ─────────────────────────────────────────────────

class TestMarkAsRead:
    def test_marks_notification_as_read(self):
        db = MagicMock()
        notif = _make_notification()
        db.query.return_value = _chain(first=notif)
        svc = NotificationService(db)

        result = svc.mark_as_read(NOTIF_ID, USER_ID)

        assert result is notif
        assert notif.is_read is True
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(notif)

    def test_returns_none_when_not_found(self):
        db = MagicMock()
        db.query.return_value = _chain(first=None)
        svc = NotificationService(db)

        result = svc.mark_as_read(NOTIF_ID, USER_ID)

        assert result is None
        db.commit.assert_not_called()


# ── mark_all_as_read ─────────────────────────────────────────────

class TestMarkAllAsRead:
    def test_updates_and_returns_count(self):
        db = MagicMock()
        db.query.return_value = _chain(update=3)
        svc = NotificationService(db)

        result = svc.mark_all_as_read(USER_ID)

        assert result == 3
        db.commit.assert_called_once()


# ── delete_notification ──────────────────────────────────────────

class TestDeleteNotification:
    def test_soft_deletes_notification(self):
        db = MagicMock()
        notif = _make_notification()
        db.query.return_value = _chain(first=notif)
        svc = NotificationService(db)

        result = svc.delete_notification(NOTIF_ID, USER_ID)

        assert result is True
        notif.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_returns_false_when_not_found(self):
        db = MagicMock()
        db.query.return_value = _chain(first=None)
        svc = NotificationService(db)

        result = svc.delete_notification(NOTIF_ID, USER_ID)

        assert result is False
        db.commit.assert_not_called()


# ── get_preferences ──────────────────────────────────────────────

class TestGetPreferences:
    def test_returns_existing_preference(self):
        db = MagicMock()
        pref = MagicMock(spec=NotificationPreference)
        db.query.return_value = _chain(first=pref)
        svc = NotificationService(db)

        result = svc.get_preferences(USER_ID)

        assert result is pref
        db.add.assert_not_called()

    def test_creates_default_when_none_exists(self):
        db = MagicMock()
        db.query.return_value = _chain(first=None)
        svc = NotificationService(db)

        result = svc.get_preferences(USER_ID)

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, NotificationPreference)


# ── update_preferences ───────────────────────────────────────────

class TestUpdatePreferences:
    def test_updates_allowed_fields(self):
        db = MagicMock()
        pref = MagicMock(spec=NotificationPreference)
        db.query.return_value = _chain(first=pref)
        svc = NotificationService(db)

        result = svc.update_preferences(
            USER_ID,
            email_enabled=False,
            push_enabled=True,
        )

        assert result is pref
        pref.__setattr__("email_enabled", False)
        pref.__setattr__("push_enabled", True)

    def test_ignores_disallowed_fields(self):
        db = MagicMock()
        pref = MagicMock(spec=NotificationPreference)
        pref.email_enabled = True
        db.query.return_value = _chain(first=pref)
        svc = NotificationService(db)

        svc.update_preferences(USER_ID, hacker_field="evil")

        # Only commit/refresh should happen, no setattr for unknown field
        db.commit.assert_called()

    def test_skips_none_values(self):
        db = MagicMock()
        pref = MagicMock(spec=NotificationPreference)
        db.query.return_value = _chain(first=pref)
        svc = NotificationService(db)

        svc.update_preferences(USER_ID, email_enabled=None)

        db.commit.assert_called()
