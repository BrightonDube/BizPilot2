"""Property-based tests for report scheduler.

This module contains property-based tests that validate correctness properties
of the report scheduler system using Hypothesis.

Feature: Automated Report Emails
Requirements: 3.1, 3.6
"""

from unittest.mock import Mock, MagicMock, patch
from hypothesis import given, strategies as st, settings, HealthCheck
from datetime import datetime, timedelta

from app.scheduler.jobs.report_scheduler_job import process_automated_reports_job
from app.models.report_subscription import DeliveryFrequency, ReportType, ReportSubscription
from app.services.report_generator_service import ReportData

# Strategies
@st.composite
def frequency_strategy(draw):
    return draw(st.sampled_from(['weekly', 'monthly']))

# Tests

@settings(deadline=1000)
@given(
    frequency=st.sampled_from([DeliveryFrequency.WEEKLY, DeliveryFrequency.MONTHLY]),
    active_subscriptions=st.lists(st.builds(ReportSubscription, id=st.uuids()), min_size=1, max_size=5)
)
def test_scheduler_job_execution_flow(frequency, active_subscriptions):
    """
    Property 1: Scheduler Job Execution Flow
    
    Verifies that the job fetches subscriptions, generates reports, and sends emails
    for the given frequency.
    """
    # Mock everything
    with patch('app.scheduler.jobs.report_scheduler_job.SessionLocal') as mock_session_cls, \
         patch('app.scheduler.jobs.report_scheduler_job.ReportSubscriptionService') as mock_sub_service_cls, \
         patch('app.scheduler.jobs.report_scheduler_job.ReportGeneratorService') as mock_gen_service_cls, \
         patch('app.scheduler.jobs.report_scheduler_job.ReportEmailService') as mock_email_service_cls, \
         patch('app.scheduler.jobs.report_scheduler_job.EmailService') as mock_raw_email_service_cls:
        
        mock_db = MagicMock()
        mock_session_cls.return_value = mock_db
        
        mock_sub_service = mock_sub_service_cls.return_value
        mock_gen_service = mock_gen_service_cls.return_value
        mock_email_service = mock_email_service_cls.return_value
        
        # Setup active subscriptions
        sub = Mock(spec=ReportSubscription)
        sub.id = "sub-123"
        sub.user_id = "user-123"
        sub.report_type_enum = ReportType.SALES_SUMMARY
        
        # Mock user relationship
        user = Mock()
        user.email = "test@example.com"
        sub.user = user
        
        mock_sub_service.get_active_subscriptions_by_frequency.return_value = [sub]
        
        # Setup report generation
        mock_gen_service.calculate_weekly_period.return_value = (datetime.now(), datetime.now())
        mock_gen_service.calculate_monthly_period.return_value = (datetime.now(), datetime.now())
        
        report_data = Mock(spec=ReportData)
        mock_gen_service.generate_report.return_value = report_data
        
        # Execute job
        result = process_automated_reports_job(frequency)
        
        # Verifications
        assert result.subscriptions_processed == 1
        assert result.emails_sent == 1
        assert len(result.errors) == 0
        
        # Check correct frequency was queried
        mock_sub_service.get_active_subscriptions_by_frequency.assert_called()
        args = mock_sub_service.get_active_subscriptions_by_frequency.call_args[0]
        assert args[0].value == frequency
        
        # Check report generation called
        mock_gen_service.generate_report.assert_called()
        
        # Check email sent
        mock_email_service.send_report_email.assert_called_with(report_data, include_excel=True)
        
        # Check success logged
        mock_sub_service.log_delivery.assert_called()
        mock_sub_service.update_last_sent.assert_called()

@given(frequency=st.text())
@settings(max_examples=10, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_scheduler_invalid_frequency(frequency):
    """
    Property 2: Invalid Frequency Handling
    
    Verifies that invalid frequencies are handled gracefully.
    """
    if frequency in ['weekly', 'monthly']:
        return

    result = process_automated_reports_job(frequency)
    
    assert len(result.errors) > 0
    assert "Invalid frequency" in result.errors[0]
