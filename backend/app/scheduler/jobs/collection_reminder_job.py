"""Scheduler job for customer account collection reminders.

Runs weekly (Monday 8 AM UTC) and:
1. Finds accounts with overdue balances (balance > 0 and past payment terms).
2. Sends email reminders to customers who have an email address.
3. Skips accounts that received a reminder in the last 7 days.
"""

import logging
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal

from app.core.database import SessionLocal
from app.models.customer_account import (
    CustomerAccount,
    AccountStatus,
    CollectionActivity,
    ActivityType,
)

logger = logging.getLogger(__name__)

# Only remind once per week
_REMINDER_COOLDOWN_DAYS = 7


def collection_reminder_job() -> None:
    """Send overdue payment reminders to customers with outstanding balances."""
    logger.info("Starting collection reminder job")
    db = SessionLocal()
    sent = 0
    skipped = 0
    errors = 0

    try:
        now = datetime.now(timezone.utc)
        cooldown_threshold = now - timedelta(days=_REMINDER_COOLDOWN_DAYS)

        # Find active accounts with a positive balance
        overdue_accounts = (
            db.query(CustomerAccount)
            .filter(
                CustomerAccount.status == AccountStatus.ACTIVE,
                CustomerAccount.current_balance > 0,
                CustomerAccount.deleted_at.is_(None),
            )
            .all()
        )

        logger.info("Found %d accounts with positive balances", len(overdue_accounts))

        for account in overdue_accounts:
            try:
                customer = getattr(account, "customer", None)
                recipient = getattr(customer, "email", None) if customer else None
                if not recipient:
                    skipped += 1
                    continue

                # Check payment terms — only remind if balance is past terms
                opened_at = account.opened_at
                payment_terms_days = account.payment_terms or 30
                if opened_at:
                    due_date = opened_at + timedelta(days=payment_terms_days)
                    if now < due_date.replace(tzinfo=timezone.utc):
                        skipped += 1
                        continue

                # Check cooldown: skip if already reminded recently
                recent_reminder = (
                    db.query(CollectionActivity)
                    .filter(
                        CollectionActivity.account_id == account.id,
                        CollectionActivity.activity_type == ActivityType.EMAIL,
                        CollectionActivity.created_at >= cooldown_threshold,
                    )
                    .first()
                )
                if recent_reminder:
                    skipped += 1
                    continue

                _send_collection_reminder(db, account, recipient, now)
                sent += 1

            except Exception as exc:
                logger.error("Failed to send reminder for account %s: %s", account.id, exc)
                errors += 1

        logger.info(
            "Collection reminder job complete: %d sent, %d skipped, %d errors",
            sent, skipped, errors,
        )
    except Exception as exc:
        logger.error("Collection reminder job failed: %s", exc, exc_info=True)
    finally:
        db.close()


def _send_collection_reminder(db, account, recipient: str, now: datetime) -> None:
    """Email a payment reminder and log it as a collection activity."""
    from app.core.pdf import format_currency
    from app.services.email_service import EmailService

    customer = getattr(account, "customer", None)
    customer_name = getattr(customer, "name", "Valued Customer") if customer else "Valued Customer"
    business = getattr(account, "business", None)
    business_name = getattr(business, "name", "BizPilot") if business else "BizPilot"
    balance = Decimal(str(account.current_balance))

    EmailService().send_email(
        to_email=recipient,
        subject=f"Payment Reminder – Account {account.account_number}",
        body_text=(
            f"Dear {customer_name},\n\n"
            f"This is a friendly reminder that your account ({account.account_number}) "
            f"has an outstanding balance of {format_currency(balance)}.\n\n"
            f"Please arrange payment at your earliest convenience.\n\n"
            f"If you have already made payment, please disregard this notice.\n\n"
            f"Thank you,\n{business_name}"
        ),
    )

    # Log the reminder as a collection activity
    activity = CollectionActivity(
        account_id=account.id,
        activity_type=ActivityType.EMAIL,
        notes=f"Automated payment reminder sent. Balance: {format_currency(balance)}",
        outcome="reminded",
    )
    db.add(activity)
    db.commit()
