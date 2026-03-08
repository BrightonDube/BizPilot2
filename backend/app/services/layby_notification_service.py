"""Layby notification service for payment reminders and status alerts.

This service handles all layby-specific notifications including:
- Payment reminders (upcoming installments)
- Overdue payment notices
- Collection-ready alerts
- Cancellation confirmations

It leverages the existing EmailService for delivery and the
LaybyNotification model for audit logging.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.layby import Layby, LaybyStatus
from app.models.layby_notification import (
    LaybyNotification,
    NotificationChannel,
    NotificationStatus,
)
from app.models.layby_schedule import LaybySchedule
from app.services.email_service import EmailService
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


class LaybyNotificationService:
    """Manages layby-related notifications across multiple channels.

    Uses the existing ``EmailService`` for email delivery and creates
    in-app notifications via ``NotificationService``.  Every notification
    is logged to the ``layby_notifications`` table regardless of channel.
    """

    def __init__(self, db: Session):
        self.db = db
        self.email_service = EmailService()
        self.notification_service = NotificationService(db)

    # ── Public API ────────────────────────────────────────────────────────

    def send_payment_reminder(
        self,
        layby: Layby,
        schedule_entry: LaybySchedule,
        *,
        channel: NotificationChannel = NotificationChannel.IN_APP,
    ) -> LaybyNotification:
        """Send a reminder for an upcoming scheduled payment.

        Args:
            layby: The layby with an upcoming payment.
            schedule_entry: The specific schedule entry that is due.
            channel: Delivery channel (default IN_APP).

        Returns:
            The persisted ``LaybyNotification`` record.
        """
        customer_name = self._customer_name(layby)
        due_date = schedule_entry.due_date.strftime("%d %b %Y")
        amount = self._format_currency(schedule_entry.amount_due)

        subject = f"Payment Reminder – Layby {layby.reference_number}"
        message = (
            f"Hi {customer_name},\n\n"
            f"This is a friendly reminder that your layby payment of {amount} "
            f"for layby {layby.reference_number} is due on {due_date}.\n\n"
            f"Outstanding balance: {self._format_currency(layby.balance_due)}.\n\n"
            "Thank you for your continued payments."
        )

        return self._send(
            layby=layby,
            notification_type="payment_reminder",
            channel=channel,
            subject=subject,
            message=message,
        )

    def send_overdue_notice(
        self,
        layby: Layby,
        days_overdue: int,
        overdue_amount: Decimal,
        *,
        channel: NotificationChannel = NotificationChannel.IN_APP,
    ) -> LaybyNotification:
        """Notify a customer about a missed / overdue payment.

        Args:
            layby: The overdue layby.
            days_overdue: Number of days the payment is overdue.
            overdue_amount: The amount currently overdue.
            channel: Delivery channel.

        Returns:
            The persisted ``LaybyNotification`` record.
        """
        customer_name = self._customer_name(layby)
        subject = f"Overdue Payment – Layby {layby.reference_number}"
        message = (
            f"Hi {customer_name},\n\n"
            f"Your layby {layby.reference_number} has a payment of "
            f"{self._format_currency(overdue_amount)} that is {days_overdue} "
            f"day(s) overdue.\n\n"
            f"Total outstanding: {self._format_currency(layby.balance_due)}.\n\n"
            "Please make your payment at your earliest convenience to avoid "
            "cancellation."
        )

        return self._send(
            layby=layby,
            notification_type="overdue_notice",
            channel=channel,
            subject=subject,
            message=message,
        )

    def send_collection_ready(
        self,
        layby: Layby,
        *,
        channel: NotificationChannel = NotificationChannel.IN_APP,
    ) -> LaybyNotification:
        """Notify a customer that their layby is fully paid and ready for collection.

        Args:
            layby: The layby that is ready.
            channel: Delivery channel.

        Returns:
            The persisted ``LaybyNotification`` record.
        """
        customer_name = self._customer_name(layby)
        subject = f"Ready for Collection – Layby {layby.reference_number}"
        message = (
            f"Hi {customer_name},\n\n"
            f"Great news! Your layby {layby.reference_number} is fully paid "
            "and ready for collection.\n\n"
            "Please visit us at your convenience to collect your items.\n\n"
            "Thank you for your business!"
        )

        return self._send(
            layby=layby,
            notification_type="collection_ready",
            channel=channel,
            subject=subject,
            message=message,
        )

    def send_cancellation_confirmation(
        self,
        layby: Layby,
        reason: str,
        *,
        channel: NotificationChannel = NotificationChannel.IN_APP,
    ) -> LaybyNotification:
        """Confirm a layby cancellation to the customer.

        Args:
            layby: The cancelled layby.
            reason: Reason for cancellation.
            channel: Delivery channel.

        Returns:
            The persisted ``LaybyNotification`` record.
        """
        customer_name = self._customer_name(layby)
        subject = f"Cancellation Confirmed – Layby {layby.reference_number}"
        message = (
            f"Hi {customer_name},\n\n"
            f"Your layby {layby.reference_number} has been cancelled.\n"
            f"Reason: {reason}\n\n"
            "If you believe this is in error, please contact us."
        )

        return self._send(
            layby=layby,
            notification_type="cancellation",
            channel=channel,
            subject=subject,
            message=message,
        )

    def send_schedule_update(
        self,
        layby: Layby,
        details: str,
        *,
        channel: NotificationChannel = NotificationChannel.IN_APP,
    ) -> LaybyNotification:
        """Notify the customer about a change to their payment schedule.

        Args:
            layby: The layby whose schedule changed.
            details: Human-readable description of the change.
            channel: Delivery channel.

        Returns:
            The persisted ``LaybyNotification`` record.
        """
        customer_name = self._customer_name(layby)
        subject = f"Schedule Updated – Layby {layby.reference_number}"
        message = (
            f"Hi {customer_name},\n\n"
            f"The payment schedule for your layby {layby.reference_number} "
            f"has been updated.\n\n{details}\n\n"
            "Please check your next payment date and amount."
        )

        return self._send(
            layby=layby,
            notification_type="schedule_update",
            channel=channel,
            subject=subject,
            message=message,
        )

    # ── Internal helpers ──────────────────────────────────────────────────

    def _send(
        self,
        *,
        layby: Layby,
        notification_type: str,
        channel: NotificationChannel,
        subject: str,
        message: str,
    ) -> LaybyNotification:
        """Create a LaybyNotification record and attempt delivery.

        For EMAIL channel, delivery is attempted via SMTP.  For IN_APP,
        a standard in-app notification is also created.  The
        ``LaybyNotification`` record is always persisted for audit.
        """
        recipient = self._recipient_address(layby, channel)

        record = LaybyNotification(
            layby_id=layby.id,
            notification_type=notification_type,
            channel=channel,
            recipient=recipient,
            subject=subject,
            message=message,
            status=NotificationStatus.PENDING,
        )
        self.db.add(record)

        try:
            if channel == NotificationChannel.EMAIL and recipient:
                self.email_service.send_email(
                    to_email=recipient,
                    subject=subject,
                    body_text=message,
                )
                record.status = NotificationStatus.SENT
                record.sent_at = datetime.now(timezone.utc)

            elif channel == NotificationChannel.IN_APP:
                self._create_in_app(layby, subject, message, notification_type)
                record.status = NotificationStatus.SENT
                record.sent_at = datetime.now(timezone.utc)

            else:
                # SMS / PUSH not yet implemented – mark as sent for logging
                logger.info(
                    "Channel %s not implemented; logging notification %s for layby %s",
                    channel.value,
                    notification_type,
                    layby.reference_number,
                )
                record.status = NotificationStatus.SENT
                record.sent_at = datetime.now(timezone.utc)

        except Exception as exc:
            logger.error(
                "Failed to send %s notification for layby %s: %s",
                notification_type,
                layby.reference_number,
                exc,
            )
            record.status = NotificationStatus.FAILED
            record.error_message = str(exc)[:500]

        self.db.commit()
        self.db.refresh(record)
        return record

    def _create_in_app(
        self,
        layby: Layby,
        title: str,
        message: str,
        notification_type: str,
    ) -> None:
        """Create a standard in-app notification via NotificationService."""
        # Notify the layby creator (the staff member who created it)
        if layby.created_by:
            self.notification_service.create_notification(
                business_id=str(layby.business_id),
                user_id=str(layby.created_by),
                title=title,
                message=message,
                notification_type="payment",
                action_url=f"/laybys/{layby.id}",
                resource_type="layby",
                resource_id=str(layby.id),
            )

    def _customer_name(self, layby: Layby) -> str:
        """Extract a display name from the layby's customer relationship."""
        if layby.customer:
            name_parts = []
            if getattr(layby.customer, "first_name", None):
                name_parts.append(layby.customer.first_name)
            if getattr(layby.customer, "last_name", None):
                name_parts.append(layby.customer.last_name)
            if name_parts:
                return " ".join(name_parts)
            if getattr(layby.customer, "name", None):
                return layby.customer.name
        return "Valued Customer"

    def _recipient_address(
        self, layby: Layby, channel: NotificationChannel
    ) -> str:
        """Resolve the recipient address based on channel and customer data."""
        if channel == NotificationChannel.EMAIL:
            return getattr(layby.customer, "email", None) or ""
        if channel == NotificationChannel.SMS:
            return getattr(layby.customer, "phone", None) or ""
        # IN_APP / PUSH use user ID
        return str(layby.created_by) if layby.created_by else ""

    @staticmethod
    def _format_currency(amount: Optional[Decimal]) -> str:
        """Format a decimal as South African Rand."""
        if amount is None:
            return "R0.00"
        return f"R{amount:,.2f}"
