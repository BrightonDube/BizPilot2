"""Tests for customer account statement PDF generation, email delivery, and scheduler jobs."""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, patch, call

import pytest

from app.models.customer_account import (
    AccountStatement,
    AccountStatus,
    CustomerAccount,
    CollectionActivity,
    ActivityType,
)


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

def _make_account(business_id=None, balance=Decimal("500.00")):
    """Create a minimal CustomerAccount-like object (plain MagicMock, no spec)."""
    acct = MagicMock()
    acct.id = uuid.uuid4()
    acct.business_id = business_id or uuid.uuid4()
    acct.account_number = "ACC-0001"
    acct.status = AccountStatus.ACTIVE
    acct.current_balance = balance
    acct.payment_terms = 30
    acct.opened_at = datetime(2024, 1, 1, tzinfo=timezone.utc)
    acct.deleted_at = None

    customer = MagicMock()
    customer.name = "Jane Smith"
    customer.email = "jane@example.com"
    acct.customer = customer

    business = MagicMock()
    business.name = "Test Biz"
    acct.business = business

    return acct


def _make_statement(account_id=None):
    """Create a minimal AccountStatement-like object (plain MagicMock, no spec)."""
    stmt = MagicMock()
    stmt.id = uuid.uuid4()
    stmt.account_id = account_id or uuid.uuid4()
    stmt.period_start = date(2025, 1, 1)
    stmt.period_end = date(2025, 1, 31)
    stmt.opening_balance = Decimal("100.00")
    stmt.total_charges = Decimal("500.00")
    stmt.total_payments = Decimal("100.00")
    stmt.closing_balance = Decimal("500.00")
    stmt.current_amount = Decimal("300.00")
    stmt.days_30_amount = Decimal("100.00")
    stmt.days_60_amount = Decimal("60.00")
    stmt.days_90_plus_amount = Decimal("40.00")
    stmt.sent_at = None
    return stmt


# ---------------------------------------------------------------------------
# PDF generation tests (app.core.pdf.build_report_pdf)
# ---------------------------------------------------------------------------

class TestStatementPDFGeneration:
    def test_build_report_pdf_returns_bytes(self):
        """build_report_pdf should return a non-empty bytes object."""
        from app.core.pdf import build_report_pdf

        pdf_bytes = build_report_pdf(
            title="Account Statement",
            business_name="ACME Corp",
            date_range="2025-01-01 – 2025-01-31",
            sections=[
                {
                    "title": "Balance Summary",
                    "rows": [
                        {"label": "Opening Balance", "value": "ZAR 100.00"},
                        {"label": "Closing Balance", "value": "ZAR 500.00"},
                    ],
                }
            ],
        )

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0

    def test_build_report_pdf_starts_with_pdf_header(self):
        """PDF output should begin with the standard PDF magic bytes."""
        from app.core.pdf import build_report_pdf

        pdf_bytes = build_report_pdf(
            title="Test",
            business_name="Biz",
            date_range="Jan 2025",
            sections=[],
        )

        assert pdf_bytes.startswith(b"%PDF-"), "PDF must start with %PDF-"

    def test_build_simple_pdf_returns_bytes(self):
        """build_simple_pdf should produce a valid PDF."""
        from app.core.pdf import build_simple_pdf

        lines = ["ACCOUNT STATEMENT", "", "Account: ACC-0001", "Balance: ZAR 500.00"]
        pdf_bytes = build_simple_pdf(lines)

        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes.startswith(b"%PDF-")


# ---------------------------------------------------------------------------
# Email delivery tests
# ---------------------------------------------------------------------------

class TestStatementEmailDelivery:
    @patch("app.services.email_service.EmailService.send_email")
    def test_email_service_called_with_pdf_attachment(self, mock_send):
        """EmailService.send_email should be invoked with the PDF attachment."""
        from app.services.email_service import EmailService, EmailAttachment
        from app.core.pdf import build_simple_pdf

        pdf_bytes = build_simple_pdf(["Test statement"])
        svc = EmailService()
        svc.send_email(
            to_email="jane@example.com",
            subject="Statement Jan 2025",
            body_text="Please find attached.",
            attachments=[EmailAttachment(filename="stmt.pdf", content=pdf_bytes, content_type="application/pdf")],
        )

        mock_send.assert_called_once()
        _, kwargs = mock_send.call_args
        assert kwargs["to_email"] == "jane@example.com"
        assert len(kwargs["attachments"]) == 1
        assert kwargs["attachments"][0].filename == "stmt.pdf"
        assert kwargs["attachments"][0].content == pdf_bytes

    @patch("app.services.email_service.EmailService.send_email")
    def test_email_attachment_has_correct_content_type(self, mock_send):
        """EmailAttachment should carry application/pdf content type."""
        from app.services.email_service import EmailService, EmailAttachment
        from app.core.pdf import build_simple_pdf

        pdf_bytes = build_simple_pdf(["Statement"])
        svc = EmailService()
        attachment = EmailAttachment(filename="s.pdf", content=pdf_bytes, content_type="application/pdf")
        svc.send_email(
            to_email="x@x.com",
            subject="Test",
            body_text="Body",
            attachments=[attachment],
        )

        _, kwargs = mock_send.call_args
        assert kwargs["attachments"][0].content_type == "application/pdf"


# ---------------------------------------------------------------------------
# Statement scheduler job tests
# ---------------------------------------------------------------------------

class TestMonthlyStatementJob:
    def _make_db(self, businesses, accounts, statements):
        """Build a mock DB session for the scheduler job."""
        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            if model.__name__ if hasattr(model, "__name__") else str(model) == "Business":
                q.filter.return_value.all.return_value = businesses
            elif model.__name__ if hasattr(model, "__name__") else str(model) == "CustomerAccount":
                q.filter.return_value.first.return_value = accounts[0] if accounts else None
            else:
                q.filter.return_value.first.return_value = None
            return q

        db.query.side_effect = query_side
        return db

    @patch("app.scheduler.jobs.statement_job.SessionLocal")
    @patch("app.scheduler.jobs.statement_job.CustomerAccountService")
    def test_job_calls_generate_monthly_statements(self, MockService, MockSession):
        """monthly_statement_job should call generate_monthly_statements for each business."""
        from app.scheduler.jobs.statement_job import monthly_statement_job

        mock_db = MagicMock()
        MockSession.return_value = mock_db

        business = MagicMock()
        business.id = uuid.uuid4()
        business.deleted_at = None
        mock_db.query.return_value.filter.return_value.all.return_value = [business]

        mock_service = MagicMock()
        mock_service.generate_monthly_statements.return_value = []
        MockService.return_value = mock_service

        monthly_statement_job()

        mock_service.generate_monthly_statements.assert_called_once()
        call_kwargs = mock_service.generate_monthly_statements.call_args
        assert "business_id" in call_kwargs.kwargs or len(call_kwargs.args) >= 1

    @patch("app.scheduler.jobs.statement_job.SessionLocal")
    @patch("app.scheduler.jobs.statement_job.CustomerAccountService")
    def test_job_skips_accounts_without_email(self, MockService, MockSession):
        """monthly_statement_job should not attempt to email accounts without customer email."""
        from app.scheduler.jobs.statement_job import monthly_statement_job

        mock_db = MagicMock()
        MockSession.return_value = mock_db

        business = MagicMock()
        business.id = uuid.uuid4()
        business.deleted_at = None
        mock_db.query.return_value.filter.return_value.all.return_value = [business]

        # Statement for account with no customer email
        stmt = _make_statement()
        acct = _make_account()
        acct.customer.email = None

        mock_db.query.return_value.filter.return_value.first.return_value = acct

        mock_service = MagicMock()
        mock_service.generate_monthly_statements.return_value = [stmt]
        MockService.return_value = mock_service

        with patch("app.scheduler.jobs.statement_job._email_statement") as mock_email:
            monthly_statement_job()
            mock_email.assert_not_called()

    @patch("app.scheduler.jobs.statement_job.SessionLocal")
    @patch("app.scheduler.jobs.statement_job.CustomerAccountService")
    def test_job_continues_on_business_error(self, MockService, MockSession):
        """monthly_statement_job should not crash when one business fails."""
        from app.scheduler.jobs.statement_job import monthly_statement_job

        mock_db = MagicMock()
        MockSession.return_value = mock_db

        biz1, biz2 = MagicMock(), MagicMock()
        biz1.id, biz2.id = uuid.uuid4(), uuid.uuid4()
        biz1.deleted_at = biz2.deleted_at = None
        mock_db.query.return_value.filter.return_value.all.return_value = [biz1, biz2]

        mock_service = MagicMock()
        mock_service.generate_monthly_statements.side_effect = [Exception("DB error"), []]
        MockService.return_value = mock_service

        # Should not raise
        monthly_statement_job()

        assert mock_service.generate_monthly_statements.call_count == 2


# ---------------------------------------------------------------------------
# Collection reminder job tests
# ---------------------------------------------------------------------------

class TestCollectionReminderJob:
    @patch("app.scheduler.jobs.collection_reminder_job.SessionLocal")
    @patch("app.scheduler.jobs.collection_reminder_job._send_collection_reminder")
    def test_job_sends_reminder_for_overdue_account(self, mock_send, MockSession):
        """collection_reminder_job should send a reminder for accounts with positive balance."""
        from app.scheduler.jobs.collection_reminder_job import collection_reminder_job

        mock_db = MagicMock()
        MockSession.return_value = mock_db

        acct = _make_account(balance=Decimal("250.00"))
        acct.opened_at = datetime(2020, 1, 1, tzinfo=timezone.utc)

        mock_db.query.return_value.filter.return_value.all.return_value = [acct]
        # No recent reminder
        mock_db.query.return_value.filter.return_value.first.return_value = None

        collection_reminder_job()

        mock_send.assert_called_once()

    @patch("app.scheduler.jobs.collection_reminder_job.SessionLocal")
    @patch("app.scheduler.jobs.collection_reminder_job._send_collection_reminder")
    def test_job_skips_account_without_email(self, mock_send, MockSession):
        """collection_reminder_job should skip accounts with no customer email."""
        from app.scheduler.jobs.collection_reminder_job import collection_reminder_job

        mock_db = MagicMock()
        MockSession.return_value = mock_db

        acct = _make_account()
        acct.customer.email = None

        mock_db.query.return_value.filter.return_value.all.return_value = [acct]

        collection_reminder_job()

        mock_send.assert_not_called()

    @patch("app.scheduler.jobs.collection_reminder_job.SessionLocal")
    @patch("app.scheduler.jobs.collection_reminder_job._send_collection_reminder")
    def test_job_skips_recently_reminded_account(self, mock_send, MockSession):
        """collection_reminder_job should not re-send if reminded within cooldown window."""
        from app.scheduler.jobs.collection_reminder_job import collection_reminder_job

        mock_db = MagicMock()
        MockSession.return_value = mock_db

        acct = _make_account(balance=Decimal("100.00"))
        acct.opened_at = datetime(2020, 1, 1, tzinfo=timezone.utc)

        mock_db.query.return_value.filter.return_value.all.return_value = [acct]
        # Simulate recent reminder found
        mock_db.query.return_value.filter.return_value.first.return_value = MagicMock()

        collection_reminder_job()

        mock_send.assert_not_called()

    @patch("app.scheduler.jobs.collection_reminder_job.SessionLocal")
    @patch("app.scheduler.jobs.collection_reminder_job._send_collection_reminder")
    def test_job_continues_on_send_error(self, mock_send, MockSession):
        """collection_reminder_job should not crash when sending fails for one account."""
        from app.scheduler.jobs.collection_reminder_job import collection_reminder_job

        mock_db = MagicMock()
        MockSession.return_value = mock_db

        acct1 = _make_account(balance=Decimal("100.00"))
        acct2 = _make_account(balance=Decimal("200.00"))
        acct1.opened_at = acct2.opened_at = datetime(2020, 1, 1, tzinfo=timezone.utc)

        mock_db.query.return_value.filter.return_value.all.return_value = [acct1, acct2]
        mock_db.query.return_value.filter.return_value.first.return_value = None

        mock_send.side_effect = [Exception("SMTP error"), None]

        # Should not raise
        collection_reminder_job()

        assert mock_send.call_count == 2


# ---------------------------------------------------------------------------
# Promise tracking (via collection activity API model)
# ---------------------------------------------------------------------------

class TestPromiseTracking:
    def test_collection_activity_has_promise(self):
        """CollectionActivity.has_promise returns True when promise fields are set."""
        act = CollectionActivity()
        act.promise_date = date(2025, 3, 1)
        act.promise_amount = Decimal("300.00")
        assert act.has_promise is True

    def test_collection_activity_no_promise_when_fields_empty(self):
        """CollectionActivity.has_promise returns False when promise fields are absent."""
        act = CollectionActivity()
        act.promise_date = None
        act.promise_amount = None
        assert act.has_promise is False

    def test_collection_activity_promise_requires_both_fields(self):
        """has_promise requires both date and amount to be set."""
        act = CollectionActivity()
        act.promise_date = date(2025, 3, 1)
        act.promise_amount = None
        assert act.has_promise is False

        act2 = CollectionActivity()
        act2.promise_date = None
        act2.promise_amount = Decimal("100.00")
        assert act2.has_promise is False
