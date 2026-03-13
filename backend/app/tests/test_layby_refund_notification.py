"""Unit tests for LaybyService.refund_payment and LaybyNotificationService."""

import os
import uuid
from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests")

from app.models.layby import Layby, LaybyStatus
from app.models.layby_payment import LaybyPayment, PaymentStatus
from app.models.layby_notification import (
    LaybyNotification,
    NotificationChannel,
    NotificationStatus,
)
from app.services.layby_service import LaybyService
from app.services.layby_notification_service import LaybyNotificationService


# ── Refund Tests ──────────────────────────────────────────────────────────


class TestRefundPayment:
    """Tests for LaybyService.refund_payment."""

    def _make_service(self):
        db = MagicMock()
        service = LaybyService(db)
        return service, db

    def _make_layby(self, status=LaybyStatus.ACTIVE, balance=Decimal("500.00"), paid=Decimal("500.00")):
        layby = MagicMock(spec=Layby)
        layby.id = uuid.uuid4()
        layby.business_id = uuid.uuid4()
        layby.reference_number = "LB-001"
        layby.status = status
        layby.balance_due = balance
        layby.amount_paid = paid
        return layby

    def _make_payment(self, amount=Decimal("200.00"), status=PaymentStatus.COMPLETED):
        payment = MagicMock(spec=LaybyPayment)
        payment.id = uuid.uuid4()
        payment.layby_id = uuid.uuid4()
        payment.amount = amount
        payment.status = status
        payment.is_refunded = False
        payment.refund_amount = None
        return payment

    def test_full_refund_updates_payment_and_layby(self):
        service, db = self._make_service()
        layby = self._make_layby()
        payment = self._make_payment(amount=Decimal("200.00"))
        payment.layby_id = str(layby.id)

        service.get_layby = MagicMock(return_value=layby)
        db.query.return_value.filter.return_value.first.return_value = payment

        result = service.refund_payment(
            business_id=layby.business_id,
            layby_id=layby.id,
            payment_id=payment.id,
            reason="Customer request",
            refunded_by=uuid.uuid4(),
        )

        assert result == payment
        assert payment.refund_amount == Decimal("200.00")
        assert payment.status == PaymentStatus.REFUNDED
        assert payment.refund_reason == "Customer request"

    def test_partial_refund(self):
        service, db = self._make_service()
        layby = self._make_layby()
        payment = self._make_payment(amount=Decimal("200.00"))
        payment.layby_id = str(layby.id)

        service.get_layby = MagicMock(return_value=layby)
        db.query.return_value.filter.return_value.first.return_value = payment

        service.refund_payment(
            business_id=layby.business_id,
            layby_id=layby.id,
            payment_id=payment.id,
            reason="Partial refund",
            refunded_by=uuid.uuid4(),
            refund_amount=Decimal("50.00"),
        )

        assert payment.refund_amount == Decimal("50.00")
        # Partial refund keeps COMPLETED status
        assert payment.status == PaymentStatus.COMPLETED

    def test_cannot_refund_already_refunded(self):
        service, db = self._make_service()
        layby = self._make_layby()
        payment = self._make_payment()
        payment.is_refunded = True

        service.get_layby = MagicMock(return_value=layby)
        db.query.return_value.filter.return_value.first.return_value = payment

        try:
            service.refund_payment(
                business_id=layby.business_id,
                layby_id=layby.id,
                payment_id=payment.id,
                reason="test",
                refunded_by=uuid.uuid4(),
            )
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "already been refunded" in str(e)

    def test_cannot_refund_pending_payment(self):
        service, db = self._make_service()
        layby = self._make_layby()
        payment = self._make_payment(status=PaymentStatus.PENDING)

        service.get_layby = MagicMock(return_value=layby)
        db.query.return_value.filter.return_value.first.return_value = payment

        try:
            service.refund_payment(
                business_id=layby.business_id,
                layby_id=layby.id,
                payment_id=payment.id,
                reason="test",
                refunded_by=uuid.uuid4(),
            )
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Only completed" in str(e)

    def test_refund_exceeding_amount_raises_error(self):
        service, db = self._make_service()
        layby = self._make_layby()
        payment = self._make_payment(amount=Decimal("100.00"))
        payment.layby_id = str(layby.id)

        service.get_layby = MagicMock(return_value=layby)
        db.query.return_value.filter.return_value.first.return_value = payment

        try:
            service.refund_payment(
                business_id=layby.business_id,
                layby_id=layby.id,
                payment_id=payment.id,
                reason="too much",
                refunded_by=uuid.uuid4(),
                refund_amount=Decimal("200.00"),
            )
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "exceeds" in str(e)

    def test_refund_reverts_ready_layby_to_active(self):
        service, db = self._make_service()
        layby = self._make_layby(
            status=LaybyStatus.READY_FOR_COLLECTION,
            balance=Decimal("0.00"),
            paid=Decimal("1000.00"),
        )
        payment = self._make_payment(amount=Decimal("200.00"))
        payment.layby_id = str(layby.id)

        service.get_layby = MagicMock(return_value=layby)
        db.query.return_value.filter.return_value.first.return_value = payment

        service.refund_payment(
            business_id=layby.business_id,
            layby_id=layby.id,
            payment_id=payment.id,
            reason="change of mind",
            refunded_by=uuid.uuid4(),
        )

        assert layby.status == LaybyStatus.ACTIVE


# ── Notification Tests ────────────────────────────────────────────────────


class TestLaybyNotificationService:
    """Tests for LaybyNotificationService."""

    def _make_service(self):
        db = MagicMock()
        service = LaybyNotificationService(db)
        return service, db

    def _make_layby(self):
        layby = MagicMock(spec=Layby)
        layby.id = uuid.uuid4()
        layby.business_id = uuid.uuid4()
        layby.created_by = uuid.uuid4()
        layby.reference_number = "LB-TEST"
        layby.balance_due = Decimal("500.00")
        layby.customer = MagicMock()
        layby.customer.first_name = "John"
        layby.customer.last_name = "Doe"
        layby.customer.email = "john@example.com"
        return layby

    def test_send_payment_reminder_creates_record(self):
        service, db = self._make_service()
        layby = self._make_layby()
        schedule = MagicMock()
        schedule.due_date = datetime(2025, 2, 1)
        schedule.amount_due = Decimal("250.00")

        service.send_payment_reminder(layby, schedule)

        assert db.add.called
        db.commit.assert_called()
        # Find the LaybyNotification among the add calls
        notification_records = [
            call[0][0] for call in db.add.call_args_list
            if isinstance(call[0][0], LaybyNotification)
        ]
        assert len(notification_records) == 1
        assert notification_records[0].notification_type == "payment_reminder"

    def test_send_overdue_notice(self):
        service, db = self._make_service()
        layby = self._make_layby()

        service.send_overdue_notice(
            layby, days_overdue=5, overdue_amount=Decimal("100.00")
        )

        notification_records = [
            call[0][0] for call in db.add.call_args_list
            if isinstance(call[0][0], LaybyNotification)
        ]
        assert len(notification_records) == 1
        assert notification_records[0].notification_type == "overdue_notice"
        assert "5 day(s) overdue" in notification_records[0].message

    def test_send_collection_ready(self):
        service, db = self._make_service()
        layby = self._make_layby()

        service.send_collection_ready(layby)

        notification_records = [
            call[0][0] for call in db.add.call_args_list
            if isinstance(call[0][0], LaybyNotification)
        ]
        assert len(notification_records) == 1
        assert notification_records[0].notification_type == "collection_ready"
        assert "fully paid" in notification_records[0].message

    def test_send_cancellation_confirmation(self):
        service, db = self._make_service()
        layby = self._make_layby()

        service.send_cancellation_confirmation(layby, reason="Customer request")

        notification_records = [
            call[0][0] for call in db.add.call_args_list
            if isinstance(call[0][0], LaybyNotification)
        ]
        assert len(notification_records) == 1
        assert notification_records[0].notification_type == "cancellation"
        assert "Customer request" in notification_records[0].message

    def test_email_channel_calls_email_service(self):
        service, db = self._make_service()
        layby = self._make_layby()

        with patch.object(service.email_service, "send_email") as mock_email:
            service.send_collection_ready(
                layby, channel=NotificationChannel.EMAIL
            )
            mock_email.assert_called_once()
            call_kwargs = mock_email.call_args
            assert "john@example.com" in str(call_kwargs)

    def test_failed_email_marks_record_as_failed(self):
        service, db = self._make_service()
        layby = self._make_layby()

        with patch.object(
            service.email_service, "send_email", side_effect=Exception("SMTP error")
        ):
            service.send_collection_ready(
                layby, channel=NotificationChannel.EMAIL
            )

        added = db.add.call_args[0][0]
        assert added.status == NotificationStatus.FAILED
        assert "SMTP error" in (added.error_message or "")

    def test_customer_name_fallback(self):
        service, _ = self._make_service()
        layby = MagicMock(spec=Layby)
        layby.customer = None
        assert service._customer_name(layby) == "Valued Customer"

    def test_format_currency(self):
        assert LaybyNotificationService._format_currency(Decimal("1234.50")) == "R1,234.50"
        assert LaybyNotificationService._format_currency(None) == "R0.00"
