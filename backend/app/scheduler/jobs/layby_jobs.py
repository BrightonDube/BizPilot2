"""Scheduler job for layby payment reminders and overdue checks.

Runs periodically (daily by default) and:
1. Sends payment reminders for upcoming installments.
2. Marks overdue laybys and sends overdue notices.
3. Sends collection-ready reminders for fully-paid laybys.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_

from app.core.database import SessionLocal
from app.models.layby import Layby, LaybyStatus
from app.models.layby_notification import LaybyNotification
from app.models.layby_schedule import LaybySchedule, ScheduleStatus
from app.services.layby_notification_service import LaybyNotificationService

logger = logging.getLogger(__name__)


def layby_reminders_job() -> None:
    """Send payment reminders for laybys with payments due within 3 days.

    Skips laybys that have already received a reminder for the same
    schedule entry in the last 24 hours to avoid duplicate alerts.
    """
    logger.info("Starting layby reminders job")
    db = SessionLocal()
    sent = 0
    errors = 0

    try:
        now = datetime.now(timezone.utc)
        reminder_window = now + timedelta(days=3)

        # Find upcoming scheduled payments within the reminder window
        upcoming = (
            db.query(LaybySchedule)
            .join(Layby, Layby.id == LaybySchedule.layby_id)
            .filter(
                Layby.status == LaybyStatus.ACTIVE,
                Layby.deleted_at.is_(None),
                LaybySchedule.status == ScheduleStatus.PENDING,
                LaybySchedule.due_date <= reminder_window,
                LaybySchedule.due_date >= now,
            )
            .all()
        )

        notification_service = LaybyNotificationService(db)

        for entry in upcoming:
            try:
                # Check for recent reminder (within 24h) to avoid duplicates
                recent = (
                    db.query(LaybyNotification)
                    .filter(
                        LaybyNotification.layby_id == entry.layby_id,
                        LaybyNotification.notification_type == "payment_reminder",
                        LaybyNotification.created_at >= now - timedelta(hours=24),
                    )
                    .first()
                )
                if recent:
                    continue

                layby = db.query(Layby).filter(Layby.id == entry.layby_id).first()
                if not layby:
                    continue

                notification_service.send_payment_reminder(layby, entry)
                sent += 1
            except Exception as exc:
                logger.error("Error sending reminder for schedule %s: %s", entry.id, exc)
                errors += 1

        logger.info(
            "Layby reminders job complete: %d sent, %d errors, %d upcoming checked",
            sent, errors, len(upcoming),
        )
    except Exception as exc:
        logger.error("Layby reminders job failed: %s", exc, exc_info=True)
    finally:
        db.close()


def layby_overdue_check_job() -> None:
    """Check for overdue layby payments and send notices.

    A payment is overdue when its ``due_date`` has passed and it is still
    in PENDING status.  The layby status is updated to OVERDUE if any
    installment is past due.
    """
    logger.info("Starting layby overdue check job")
    db = SessionLocal()
    updated = 0
    notices = 0
    errors = 0

    try:
        now = datetime.now(timezone.utc)

        # Find active laybys with overdue schedule entries
        overdue_entries = (
            db.query(LaybySchedule)
            .join(Layby, Layby.id == LaybySchedule.layby_id)
            .filter(
                Layby.status.in_([LaybyStatus.ACTIVE, LaybyStatus.OVERDUE]),
                Layby.deleted_at.is_(None),
                LaybySchedule.status == ScheduleStatus.PENDING,
                LaybySchedule.due_date < now,
            )
            .all()
        )

        notification_service = LaybyNotificationService(db)
        processed_laybys = set()

        for entry in overdue_entries:
            if entry.layby_id in processed_laybys:
                continue
            processed_laybys.add(entry.layby_id)

            try:
                layby = db.query(Layby).filter(Layby.id == entry.layby_id).first()
                if not layby:
                    continue

                # Update layby status to OVERDUE if currently ACTIVE
                if layby.status == LaybyStatus.ACTIVE:
                    layby.status = LaybyStatus.OVERDUE
                    db.commit()
                    updated += 1

                days_overdue = (now - entry.due_date).days

                # Only send notice once per week per layby
                recent_notice = (
                    db.query(LaybyNotification)
                    .filter(
                        LaybyNotification.layby_id == layby.id,
                        LaybyNotification.notification_type == "overdue_notice",
                        LaybyNotification.created_at >= now - timedelta(days=7),
                    )
                    .first()
                )
                if recent_notice:
                    continue

                notification_service.send_overdue_notice(
                    layby,
                    days_overdue=days_overdue,
                    overdue_amount=entry.amount_due,
                )
                notices += 1
            except Exception as exc:
                logger.error("Error processing overdue layby %s: %s", entry.layby_id, exc)
                errors += 1

        logger.info(
            "Layby overdue check complete: %d status updates, %d notices, %d errors",
            updated, notices, errors,
        )
    except Exception as exc:
        logger.error("Layby overdue check job failed: %s", exc, exc_info=True)
    finally:
        db.close()


def layby_collection_reminder_job() -> None:
    """Send reminders for laybys that are ready for collection.

    Sends a nudge once a week for any layby in READY_FOR_COLLECTION
    status that hasn't been collected and has no recent reminder.
    """
    logger.info("Starting layby collection reminder job")
    db = SessionLocal()
    sent = 0

    try:
        now = datetime.now(timezone.utc)

        ready_laybys = (
            db.query(Layby)
            .filter(
                Layby.status == LaybyStatus.READY_FOR_COLLECTION,
                Layby.deleted_at.is_(None),
            )
            .all()
        )

        notification_service = LaybyNotificationService(db)

        for layby in ready_laybys:
            try:
                recent = (
                    db.query(LaybyNotification)
                    .filter(
                        LaybyNotification.layby_id == layby.id,
                        LaybyNotification.notification_type == "collection_ready",
                        LaybyNotification.created_at >= now - timedelta(days=7),
                    )
                    .first()
                )
                if recent:
                    continue

                notification_service.send_collection_ready(layby)
                sent += 1
            except Exception as exc:
                logger.error("Error sending collection reminder for %s: %s", layby.id, exc)

        logger.info("Layby collection reminder job complete: %d sent", sent)
    except Exception as exc:
        logger.error("Layby collection reminder job failed: %s", exc, exc_info=True)
    finally:
        db.close()
