"""Scheduler job for monthly account statement generation.

Runs on the 1st of each month at 3 AM UTC and:
1. Generates statements for all active customer accounts across all businesses.
2. Emails each statement to the customer if they have an email address.
"""

import logging
from datetime import datetime, timezone
from calendar import monthrange
from uuid import UUID

from app.core.database import SessionLocal
from app.models.customer_account import CustomerAccount, AccountStatus, AccountStatement
from app.models.business import Business
from app.services.customer_account_service import CustomerAccountService

logger = logging.getLogger(__name__)


def monthly_statement_job() -> None:
    """Generate and email monthly account statements for all businesses.

    Triggered on the 1st of each month. Generates statements for the
    previous calendar month so the full period is available.
    """
    logger.info("Starting monthly statement job")
    db = SessionLocal()
    generated = 0
    emailed = 0
    errors = 0

    try:
        now = datetime.now(timezone.utc)

        # Target: previous month
        if now.month == 1:
            target_month = 12
            target_year = now.year - 1
        else:
            target_month = now.month - 1
            target_year = now.year

        businesses = db.query(Business).filter(Business.deleted_at.is_(None)).all()
        logger.info("Generating statements for %d businesses (month=%d/%d)", len(businesses), target_month, target_year)

        for business in businesses:
            try:
                service = CustomerAccountService(db)
                statements = service.generate_monthly_statements(
                    business_id=business.id,
                    month=target_month,
                    year=target_year,
                )
                generated += len(statements)

                # Email each statement to the customer
                for statement in statements:
                    try:
                        account = db.query(CustomerAccount).filter(
                            CustomerAccount.id == statement.account_id
                        ).first()
                        if not account:
                            continue

                        customer = getattr(account, "customer", None)
                        recipient = getattr(customer, "email", None) if customer else None
                        if not recipient:
                            continue

                        _email_statement(db, statement, account, recipient, target_month, target_year)
                        emailed += 1
                    except Exception as exc:
                        logger.error("Failed to email statement %s: %s", statement.id, exc)
                        errors += 1

            except Exception as exc:
                logger.error("Failed to generate statements for business %s: %s", business.id, exc)
                errors += 1

        logger.info(
            "Monthly statement job complete: %d generated, %d emailed, %d errors",
            generated, emailed, errors,
        )
    except Exception as exc:
        logger.error("Monthly statement job failed: %s", exc, exc_info=True)
    finally:
        db.close()


def _email_statement(db, statement, account, recipient: str, month: int, year: int) -> None:
    """Build a PDF for the statement and email it to the recipient."""
    from app.core.pdf import build_report_pdf, format_currency, format_date
    from app.services.email_service import EmailService, EmailAttachment

    customer = getattr(account, "customer", None)
    customer_name = getattr(customer, "name", "") if customer else ""
    business = getattr(account, "business", None)
    business_name = getattr(business, "name", "BizPilot") if business else "BizPilot"

    sections = [
        {
            "title": "Account Details",
            "rows": [
                {"label": "Account Number", "value": account.account_number},
                {"label": "Customer", "value": customer_name or "—"},
                {
                    "label": "Period",
                    "value": f"{format_date(statement.period_start)} – {format_date(statement.period_end)}",
                },
            ],
        },
        {
            "title": "Balance Summary",
            "rows": [
                {"label": "Opening Balance", "value": format_currency(statement.opening_balance)},
                {"label": "Total Charges", "value": format_currency(statement.total_charges)},
                {"label": "Total Payments", "value": format_currency(statement.total_payments)},
                {"label": "Closing Balance", "value": format_currency(statement.closing_balance)},
            ],
        },
        {
            "title": "Aging Breakdown",
            "rows": [
                {"label": "Current", "value": format_currency(statement.current_amount)},
                {"label": "30 Days", "value": format_currency(statement.days_30_amount)},
                {"label": "60 Days", "value": format_currency(statement.days_60_amount)},
                {"label": "90+ Days", "value": format_currency(statement.days_90_plus_amount)},
            ],
        },
    ]

    pdf_bytes = build_report_pdf(
        title="Account Statement",
        business_name=business_name,
        date_range=f"{format_date(statement.period_start)} – {format_date(statement.period_end)}",
        sections=sections,
    )

    period_label = f"{year}-{month:02d}"
    filename = f"statement_{account.account_number}_{period_label}.pdf"

    EmailService().send_email(
        to_email=recipient,
        subject=f"Account Statement – {account.account_number} ({period_label})",
        body_text=(
            f"Dear {customer_name or 'Valued Customer'},\n\n"
            f"Please find your account statement for {period_label} attached.\n\n"
            f"Closing Balance: {format_currency(statement.closing_balance)}\n\n"
            f"Thank you for your business."
        ),
        attachments=[EmailAttachment(filename=filename, content=pdf_bytes, content_type="application/pdf")],
    )

    # Mark as sent
    from datetime import datetime as dt, timezone as tz
    statement.sent_at = dt.now(tz.utc)
    db.commit()
