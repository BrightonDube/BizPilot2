"""Unit tests for LaybyNotificationService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4


from app.models.layby_notification import (
    NotificationChannel,
    NotificationStatus,
)
from app.services.layby_notification_service import LaybyNotificationService


BIZ_ID = uuid4()
USR_ID = uuid4()
CUST_ID = uuid4()
LAYBY_ID = uuid4()
REF = "LBY-001"


def _svc():
    """Create a service with a mocked DB and patched collaborators."""
    db = MagicMock()
    with patch(
        "app.services.layby_notification_service.EmailService"
    ) as MockEmail, patch(
        "app.services.layby_notification_service.NotificationService"
    ) as MockNotif:
        svc = LaybyNotificationService(db)
    # Replace with fresh mocks so callers can assert on them
    svc.email_service = MockEmail.return_value
    svc.notification_service = MockNotif.return_value
    return svc, db


def _layby(
    *,
    first_name="John",
    last_name="Doe",
    name=None,
    email="john@example.com",
    phone="0821234567",
    customer=True,
    created_by=USR_ID,
    balance_due=Decimal("500.00"),
):
    """Build a mock Layby with optional customer attributes."""
    layby = MagicMock()
    layby.id = LAYBY_ID
    layby.reference_number = REF
    layby.business_id = BIZ_ID
    layby.created_by = created_by
    layby.balance_due = balance_due

    if customer:
        cust = MagicMock()
        cust.first_name = first_name
        cust.last_name = last_name
        cust.name = name
        cust.email = email
        cust.phone = phone
        layby.customer = cust
    else:
        layby.customer = None

    return layby


def _schedule(due_date=None, amount_due=None):
    entry = MagicMock()
    entry.due_date = due_date or date(2025, 7, 15)
    entry.amount_due = amount_due or Decimal("250.00")
    return entry


# ── Constructor ──────────────────────────────────────────────────────


class TestConstructor:
    def test_creates_email_and_notification_services(self):
        db = MagicMock()
        with patch(
            "app.services.layby_notification_service.EmailService"
        ) as MockEmail, patch(
            "app.services.layby_notification_service.NotificationService"
        ) as MockNotif:
            svc = LaybyNotificationService(db)

        MockEmail.assert_called_once()
        MockNotif.assert_called_once_with(db)
        assert svc.db is db


# ── _format_currency ─────────────────────────────────────────────────


class TestFormatCurrency:
    def test_formats_decimal(self):
        assert LaybyNotificationService._format_currency(Decimal("1234.50")) == "R1,234.50"

    def test_formats_zero(self):
        assert LaybyNotificationService._format_currency(Decimal("0")) == "R0.00"

    def test_formats_none(self):
        assert LaybyNotificationService._format_currency(None) == "R0.00"

    def test_formats_large_amount(self):
        assert LaybyNotificationService._format_currency(Decimal("1000000.99")) == "R1,000,000.99"


# ── _customer_name ───────────────────────────────────────────────────


class TestCustomerName:
    def test_first_and_last(self):
        svc, _ = _svc()
        layby = _layby(first_name="Jane", last_name="Smith")
        assert svc._customer_name(layby) == "Jane Smith"

    def test_first_name_only(self):
        svc, _ = _svc()
        layby = _layby(first_name="Jane", last_name=None)
        assert svc._customer_name(layby) == "Jane"

    def test_falls_back_to_name_attr(self):
        svc, _ = _svc()
        layby = _layby(first_name=None, last_name=None, name="Acme Corp")
        assert svc._customer_name(layby) == "Acme Corp"

    def test_no_customer(self):
        svc, _ = _svc()
        layby = _layby(customer=False)
        assert svc._customer_name(layby) == "Valued Customer"

    def test_customer_no_names(self):
        svc, _ = _svc()
        layby = _layby(first_name=None, last_name=None, name=None)
        assert svc._customer_name(layby) == "Valued Customer"


# ── _recipient_address ───────────────────────────────────────────────


class TestRecipientAddress:
    def test_email_channel(self):
        svc, _ = _svc()
        layby = _layby(email="a@b.com")
        assert svc._recipient_address(layby, NotificationChannel.EMAIL) == "a@b.com"

    def test_sms_channel(self):
        svc, _ = _svc()
        layby = _layby(phone="0821111111")
        assert svc._recipient_address(layby, NotificationChannel.SMS) == "0821111111"

    def test_in_app_channel(self):
        svc, _ = _svc()
        uid = uuid4()
        layby = _layby(created_by=uid)
        assert svc._recipient_address(layby, NotificationChannel.IN_APP) == str(uid)

    def test_email_no_customer(self):
        svc, _ = _svc()
        layby = _layby(customer=False)
        assert svc._recipient_address(layby, NotificationChannel.EMAIL) == ""

    def test_in_app_no_created_by(self):
        svc, _ = _svc()
        layby = _layby(created_by=None)
        assert svc._recipient_address(layby, NotificationChannel.IN_APP) == ""


# ── _send (core helper) ─────────────────────────────────────────────


class TestSend:
    def test_in_app_creates_record_and_in_app_notification(self):
        svc, db = _svc()
        layby = _layby()

        svc._send(
            layby=layby,
            notification_type="test_type",
            channel=NotificationChannel.IN_APP,
            subject="Subj",
            message="Body",
        )

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.notification_type == "test_type"
        assert added.channel == NotificationChannel.IN_APP
        assert added.subject == "Subj"
        assert added.message == "Body"
        assert added.status == NotificationStatus.SENT
        assert added.sent_at is not None

    def test_email_calls_email_service(self):
        svc, db = _svc()
        layby = _layby(email="x@y.com")

        svc._send(
            layby=layby,
            notification_type="reminder",
            channel=NotificationChannel.EMAIL,
            subject="S",
            message="M",
        )

        svc.email_service.send_email.assert_called_once_with(
            to_email="x@y.com", subject="S", body_text="M"
        )
        added = db.add.call_args[0][0]
        assert added.status == NotificationStatus.SENT

    def test_email_failure_marks_failed(self):
        svc, db = _svc()
        svc.email_service.send_email.side_effect = RuntimeError("SMTP down")
        layby = _layby(email="x@y.com")

        svc._send(
            layby=layby,
            notification_type="reminder",
            channel=NotificationChannel.EMAIL,
            subject="S",
            message="M",
        )

        added = db.add.call_args[0][0]
        assert added.status == NotificationStatus.FAILED
        assert "SMTP down" in added.error_message
        db.commit.assert_called_once()

    def test_in_app_failure_marks_failed(self):
        svc, db = _svc()
        svc.notification_service.create_notification.side_effect = ValueError("boom")
        layby = _layby()

        svc._send(
            layby=layby,
            notification_type="t",
            channel=NotificationChannel.IN_APP,
            subject="S",
            message="M",
        )

        added = db.add.call_args[0][0]
        assert added.status == NotificationStatus.FAILED
        assert "boom" in added.error_message

    def test_unimplemented_channel_still_marks_sent(self):
        svc, db = _svc()
        layby = _layby()

        svc._send(
            layby=layby,
            notification_type="t",
            channel=NotificationChannel.SMS,
            subject="S",
            message="M",
        )

        added = db.add.call_args[0][0]
        assert added.status == NotificationStatus.SENT

    def test_in_app_skips_if_no_created_by(self):
        svc, db = _svc()
        layby = _layby(created_by=None)

        svc._send(
            layby=layby,
            notification_type="t",
            channel=NotificationChannel.IN_APP,
            subject="S",
            message="M",
        )

        # _create_in_app checks layby.created_by; no notification created
        svc.notification_service.create_notification.assert_not_called()
        added = db.add.call_args[0][0]
        assert added.status == NotificationStatus.SENT

    def test_error_message_truncated_to_500(self):
        svc, db = _svc()
        svc.email_service.send_email.side_effect = RuntimeError("x" * 1000)
        layby = _layby(email="x@y.com")

        svc._send(
            layby=layby,
            notification_type="t",
            channel=NotificationChannel.EMAIL,
            subject="S",
            message="M",
        )

        added = db.add.call_args[0][0]
        assert len(added.error_message) == 500


# ── Public methods ───────────────────────────────────────────────────


class TestSendPaymentReminder:
    def test_creates_notification_with_correct_content(self):
        svc, db = _svc()
        layby = _layby(balance_due=Decimal("750.00"))
        entry = _schedule(due_date=date(2025, 8, 1), amount_due=Decimal("250.00"))

        svc.send_payment_reminder(layby, entry)

        added = db.add.call_args[0][0]
        assert added.notification_type == "payment_reminder"
        assert "R250.00" in added.message
        assert "01 Aug 2025" in added.message
        assert "R750.00" in added.message
        assert REF in added.subject

    def test_defaults_to_in_app_channel(self):
        svc, db = _svc()
        svc.send_payment_reminder(_layby(), _schedule())
        added = db.add.call_args[0][0]
        assert added.channel == NotificationChannel.IN_APP

    def test_can_override_channel_to_email(self):
        svc, db = _svc()
        svc.send_payment_reminder(
            _layby(), _schedule(), channel=NotificationChannel.EMAIL
        )
        svc.email_service.send_email.assert_called_once()


class TestSendOverdueNotice:
    def test_creates_notification_with_overdue_details(self):
        svc, db = _svc()
        layby = _layby(balance_due=Decimal("600.00"))

        svc.send_overdue_notice(layby, days_overdue=5, overdue_amount=Decimal("200.00"))

        added = db.add.call_args[0][0]
        assert added.notification_type == "overdue_notice"
        assert "5 day(s) overdue" in added.message
        assert "R200.00" in added.message
        assert "R600.00" in added.message


class TestSendCollectionReady:
    def test_creates_notification(self):
        svc, db = _svc()
        layby = _layby()

        svc.send_collection_ready(layby)

        added = db.add.call_args[0][0]
        assert added.notification_type == "collection_ready"
        assert "fully paid" in added.message
        assert "collection" in added.message.lower()


class TestSendCancellationConfirmation:
    def test_creates_notification_with_reason(self):
        svc, db = _svc()
        layby = _layby()

        svc.send_cancellation_confirmation(layby, reason="Customer request")

        added = db.add.call_args[0][0]
        assert added.notification_type == "cancellation"
        assert "Customer request" in added.message
        assert "cancelled" in added.message.lower()


class TestSendScheduleUpdate:
    def test_creates_notification_with_details(self):
        svc, db = _svc()
        layby = _layby()

        svc.send_schedule_update(layby, details="Extended by 2 weeks")

        added = db.add.call_args[0][0]
        assert added.notification_type == "schedule_update"
        assert "Extended by 2 weeks" in added.message
        assert "updated" in added.message.lower()
