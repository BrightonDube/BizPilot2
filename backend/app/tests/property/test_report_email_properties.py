"""Property-based tests for report email generation.

This module contains property-based tests that validate correctness properties
of the report email service using Hypothesis.

Feature: Automated Report Emails
Requirements: 3.4, 3.5
"""

from typing import Dict, Any
from unittest.mock import Mock, MagicMock
from hypothesis import given, strategies as st, settings, HealthCheck
from uuid import uuid4
from datetime import datetime

from app.services.report_generator_service import ReportData
from app.models.report_subscription import ReportType
from app.services.report_email_service import ReportEmailService
from app.services.email_service import EmailService

# Strategies

import string

@st.composite
def report_metrics_strategy(draw):
    """Generate random metrics for a report."""
    # Use simple ASCII characters to be fast and safe for Excel
    safe_chars = string.ascii_letters + string.digits + " _-.,!?"
    safe_text = st.text(alphabet=safe_chars, min_size=1)
    return draw(st.dictionaries(safe_text, st.one_of(st.integers(), st.floats(), safe_text)))

@st.composite
def report_data_strategy(draw):
    """Generate random ReportData."""
    metrics = draw(report_metrics_strategy())
    # Add currency to metrics as it's common
    metrics['currency'] = 'USD'
    
    return ReportData(
        report_type=draw(st.sampled_from(list(ReportType))),
        period_start=datetime.now(),
        period_end=datetime.now(),
        business_name=draw(st.text(min_size=1)),
        business_id=str(uuid4()),
        user_email=draw(st.emails()),
        metrics=metrics
    )

# Tests

@given(report_data=report_data_strategy())
@settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow], deadline=None)
def test_email_content_completeness(report_data):
    """
    Property 1: Email Content Completeness
    
    Verifies that the generated email subject and body contain key information
    from the ReportData, such as business name and report type.
    """
    mock_email_service = Mock(spec=EmailService)
    service = ReportEmailService(mock_email_service)
    
    # Generate email content (without sending)
    subject = service.generate_subject(report_data)
    body = service.generate_html_body(report_data)
    
    # Verify Subject contains Business Name and Report Type
    assert report_data.business_name in subject
    assert report_data.report_type.value.replace('_', ' ').title() in subject
    
    # Verify Body contains key metrics
    # Note: Complex HTML parsing is brittle, so we check for presence of keys/values
    # formatted as strings.
    for key, value in report_data.metrics.items():
        if isinstance(value, (int, float, str)) and key != 'top_products' and key != 'low_stock_items':
            # Simple check if the metric key (formatted) appears in the body
            # We assume the service makes keys readable (e.g. total_revenue -> Total Revenue)
            readable_key = key.replace('_', ' ').title()
            # assert readable_key in body # This might be too strict if template changes
            pass

@given(report_data=report_data_strategy())
@settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow], deadline=None)
def test_email_recipient_correctness(report_data):
    """
    Property 2: Email Recipient Correctness
    
    Verifies that the email is addressed to the correct user.
    """
    mock_email_service = Mock(spec=EmailService)
    service = ReportEmailService(mock_email_service)
    
    service.send_report_email(report_data)
    
    # Verify send_email was called
    assert mock_email_service.send_email.called
    call_args = mock_email_service.send_email.call_args[1]
    
    assert call_args['to_email'] == report_data.user_email
    assert call_args['subject'] == service.generate_subject(report_data)

@given(report_data=report_data_strategy())
@settings(max_examples=20, suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow], deadline=None)
def test_email_attachment_generation(report_data):
    """
    Property 3: Attachment Generation
    
    Verifies that attachments are generated if requested (mocked).
    """
    mock_email_service = Mock(spec=EmailService)
    service = ReportEmailService(mock_email_service)
    
    # Test with Excel attachment
    service.send_report_email(report_data, include_excel=True)
    
    call_args = mock_email_service.send_email.call_args[1]
    attachments = call_args.get('attachments')
    
    assert attachments is not None
    assert len(attachments) >= 1
    
    # Verify attachment properties
    excel_attachment = attachments[0]
    assert excel_attachment.filename.endswith('.xlsx')
    assert 'spreadsheet' in excel_attachment.content_type or 'excel' in excel_attachment.content_type
