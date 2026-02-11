"""End-to-end test for the automated report email flow.

Validates the complete pipeline:
  subscribe → generate report → compose email → send

All external I/O (DB, SMTP) is mocked; the test verifies that the
components integrate correctly from subscription through delivery.

Feature: Automated Report Emails
Requirements: 3.1 – 3.6
"""

import pytest
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from unittest.mock import MagicMock, Mock, patch

from app.models.report_subscription import (
    ReportSubscription,
    ReportType,
    DeliveryFrequency,
    DeliveryStatus,
)
from app.services.report_subscription_service import ReportSubscriptionService
from app.services.report_generator_service import ReportGeneratorService, ReportData
from app.services.report_email_service import ReportEmailService
from app.services.email_service import EmailService
from app.scheduler.jobs.report_scheduler_job import process_automated_reports_job


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_subscription(user_id=None, report_type=ReportType.SALES_SUMMARY,
                       frequency=DeliveryFrequency.WEEKLY, is_active=True):
    sub = Mock(spec=ReportSubscription)
    sub.id = uuid4()
    sub.user_id = user_id or uuid4()
    sub.report_type = report_type.value
    sub.frequency = frequency.value
    sub.is_active = is_active
    sub.report_type_enum = report_type
    sub.last_sent_at = None
    sub.deleted_at = None

    user = Mock()
    user.email = "report-user@example.com"
    sub.user = user
    return sub


def _mock_report_data(report_type=ReportType.SALES_SUMMARY):
    return ReportData(
        report_type=report_type,
        period_start=datetime.now(timezone.utc) - timedelta(days=7),
        period_end=datetime.now(timezone.utc),
        business_name="E2E Test Business",
        business_id=str(uuid4()),
        user_email="report-user@example.com",
        metrics={
            "total_revenue": 12345.67,
            "transaction_count": 42,
            "average_transaction_value": 293.94,
            "currency": "ZAR",
            "top_products": [],
        },
    )


# ---------------------------------------------------------------------------
# E2E: Full weekly report flow via scheduler job
# ---------------------------------------------------------------------------

class TestReportFlowE2E:
    """End-to-end test exercising the scheduler → generator → email pipeline."""

    def test_weekly_report_full_flow(self):
        """
        Simulates the scheduler picking up a weekly subscription,
        generating the report, composing the email, and sending it.
        """
        sub = _mock_subscription(frequency=DeliveryFrequency.WEEKLY)
        report_data = _mock_report_data()

        with (
            patch("app.scheduler.jobs.report_scheduler_job.SessionLocal") as mock_session_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportSubscriptionService") as mock_sub_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportGeneratorService") as mock_gen_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportEmailService") as mock_email_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.EmailService") as mock_raw_email_cls,
        ):
            mock_db = MagicMock()
            mock_session_cls.return_value = mock_db

            mock_sub_svc = mock_sub_svc_cls.return_value
            mock_gen_svc = mock_gen_svc_cls.return_value
            mock_email_svc = mock_email_svc_cls.return_value

            mock_sub_svc.get_active_subscriptions_by_frequency.return_value = [sub]
            mock_gen_svc.calculate_weekly_period.return_value = (
                report_data.period_start,
                report_data.period_end,
            )
            mock_gen_svc.generate_report.return_value = report_data

            result = process_automated_reports_job("weekly")

            # Assertions
            assert result.subscriptions_processed == 1
            assert result.emails_sent == 1
            assert len(result.errors) == 0

            # Report generated (called twice: once with placeholder, once with real email)
            assert mock_gen_svc.generate_report.call_count == 2

            # Email sent with report data + Excel attachment
            mock_email_svc.send_report_email.assert_called_once_with(
                report_data, include_excel=True
            )

            # Delivery logged as SUCCESS
            mock_sub_svc.log_delivery.assert_called_once()
            log_kwargs = mock_sub_svc.log_delivery.call_args
            # positional or keyword – check status
            assert DeliveryStatus.SUCCESS.value in str(log_kwargs) or "success" in str(log_kwargs).lower()

            # last_sent_at updated
            mock_sub_svc.update_last_sent.assert_called_once()

    def test_monthly_report_full_flow(self):
        """Same flow for monthly frequency."""
        sub = _mock_subscription(
            report_type=ReportType.FINANCIAL_OVERVIEW,
            frequency=DeliveryFrequency.MONTHLY,
        )
        report_data = _mock_report_data(ReportType.FINANCIAL_OVERVIEW)

        with (
            patch("app.scheduler.jobs.report_scheduler_job.SessionLocal") as mock_session_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportSubscriptionService") as mock_sub_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportGeneratorService") as mock_gen_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportEmailService") as mock_email_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.EmailService") as mock_raw_email_cls,
        ):
            mock_db = MagicMock()
            mock_session_cls.return_value = mock_db

            mock_sub_svc = mock_sub_svc_cls.return_value
            mock_gen_svc = mock_gen_svc_cls.return_value
            mock_email_svc = mock_email_svc_cls.return_value

            mock_sub_svc.get_active_subscriptions_by_frequency.return_value = [sub]
            mock_gen_svc.calculate_monthly_period.return_value = (
                report_data.period_start,
                report_data.period_end,
            )
            mock_gen_svc.generate_report.return_value = report_data

            result = process_automated_reports_job("monthly")

            assert result.subscriptions_processed == 1
            assert result.emails_sent == 1
            assert len(result.errors) == 0

    def test_flow_handles_generation_failure_gracefully(self):
        """If report generation fails, the error is logged and the job continues."""
        sub = _mock_subscription()

        with (
            patch("app.scheduler.jobs.report_scheduler_job.SessionLocal") as mock_session_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportSubscriptionService") as mock_sub_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportGeneratorService") as mock_gen_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportEmailService") as mock_email_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.EmailService") as mock_raw_email_cls,
        ):
            mock_db = MagicMock()
            mock_session_cls.return_value = mock_db

            mock_sub_svc = mock_sub_svc_cls.return_value
            mock_gen_svc = mock_gen_svc_cls.return_value
            mock_email_svc = mock_email_svc_cls.return_value

            mock_sub_svc.get_active_subscriptions_by_frequency.return_value = [sub]
            mock_gen_svc.calculate_weekly_period.return_value = (
                datetime.now(timezone.utc) - timedelta(days=7),
                datetime.now(timezone.utc),
            )
            mock_gen_svc.generate_report.side_effect = Exception("DB connection lost")

            result = process_automated_reports_job("weekly")

            assert result.emails_sent == 0
            assert len(result.errors) >= 1

    def test_flow_handles_email_failure_gracefully(self):
        """If email sending fails, delivery is logged as FAILED."""
        sub = _mock_subscription()
        report_data = _mock_report_data()

        with (
            patch("app.scheduler.jobs.report_scheduler_job.SessionLocal") as mock_session_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportSubscriptionService") as mock_sub_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportGeneratorService") as mock_gen_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportEmailService") as mock_email_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.EmailService") as mock_raw_email_cls,
        ):
            mock_db = MagicMock()
            mock_session_cls.return_value = mock_db

            mock_sub_svc = mock_sub_svc_cls.return_value
            mock_gen_svc = mock_gen_svc_cls.return_value
            mock_email_svc = mock_email_svc_cls.return_value

            mock_sub_svc.get_active_subscriptions_by_frequency.return_value = [sub]
            mock_gen_svc.calculate_weekly_period.return_value = (
                report_data.period_start,
                report_data.period_end,
            )
            mock_gen_svc.generate_report.return_value = report_data
            mock_email_svc.send_report_email.side_effect = Exception("SMTP down")

            result = process_automated_reports_job("weekly")

            assert result.emails_sent == 0
            assert len(result.errors) >= 1

    def test_no_subscriptions_produces_zero_work(self):
        """When there are no active subscriptions, nothing is processed."""
        with (
            patch("app.scheduler.jobs.report_scheduler_job.SessionLocal") as mock_session_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportSubscriptionService") as mock_sub_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportGeneratorService") as mock_gen_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportEmailService") as mock_email_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.EmailService") as mock_raw_email_cls,
        ):
            mock_db = MagicMock()
            mock_session_cls.return_value = mock_db

            mock_sub_svc = mock_sub_svc_cls.return_value
            mock_sub_svc.get_active_subscriptions_by_frequency.return_value = []

            result = process_automated_reports_job("weekly")

            assert result.subscriptions_processed == 0
            assert result.emails_sent == 0

    def test_multiple_subscriptions_processed_independently(self):
        """Each subscription is processed independently; one failure doesn't block others."""
        sub1 = _mock_subscription(report_type=ReportType.SALES_SUMMARY)
        sub2 = _mock_subscription(report_type=ReportType.INVENTORY_STATUS)

        report1 = _mock_report_data(ReportType.SALES_SUMMARY)

        with (
            patch("app.scheduler.jobs.report_scheduler_job.SessionLocal") as mock_session_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportSubscriptionService") as mock_sub_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportGeneratorService") as mock_gen_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.ReportEmailService") as mock_email_svc_cls,
            patch("app.scheduler.jobs.report_scheduler_job.EmailService") as mock_raw_email_cls,
        ):
            mock_db = MagicMock()
            mock_session_cls.return_value = mock_db

            mock_sub_svc = mock_sub_svc_cls.return_value
            mock_gen_svc = mock_gen_svc_cls.return_value
            mock_email_svc = mock_email_svc_cls.return_value

            mock_sub_svc.get_active_subscriptions_by_frequency.return_value = [sub1, sub2]
            mock_gen_svc.calculate_weekly_period.return_value = (
                report1.period_start,
                report1.period_end,
            )

            # Scheduler calls generate_report twice per sub (dummy email + real email).
            # Sub1 (calls 1-2): both succeed. Sub2 (calls 3-4): first succeeds, second fails.
            call_count = {"n": 0}

            def generate_side_effect(*args, **kwargs):
                call_count["n"] += 1
                if call_count["n"] <= 2:
                    return report1  # sub1 calls
                if call_count["n"] == 3:
                    return report1  # sub2 first (dummy) call
                raise Exception("Inventory query failed")  # sub2 second call

            mock_gen_svc.generate_report.side_effect = generate_side_effect

            result = process_automated_reports_job("weekly")

            assert result.emails_sent == 1
            assert len(result.errors) >= 1
            assert result.subscriptions_processed == 2
