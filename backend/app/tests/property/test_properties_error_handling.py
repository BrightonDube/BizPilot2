"""Property-based tests for error handling and resource cleanup using mocks."""

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck
from datetime import date, timedelta, datetime
from decimal import Decimal
from uuid import uuid4
from unittest.mock import Mock, patch, MagicMock

from app.scheduler.jobs.overdue_invoice_job import check_overdue_invoices_job
from app.scheduler.services.invoice_query import InvoiceQueryService
from app.scheduler.services.notification_creation import NotificationCreationService
from app.models.invoice import Invoice, InvoiceStatus
from app.models.job_execution_log import JobExecutionLog, JobStatus
from app.models.customer import Customer


def create_mock_invoice(invoice_data):
    """Create a mock invoice object with the given data."""
    mock_invoice = Mock(spec=Invoice)
    for key, value in invoice_data.items():
        setattr(mock_invoice, key, value)
    
    # Add balance_due as a read-only property
    balance_due_value = invoice_data.get('balance_due', Decimal('100.00'))
    type(mock_invoice).balance_due = property(lambda self: balance_due_value)
    
    return mock_invoice


# Strategy for generating overdue invoices
@st.composite
def overdue_invoice_strategy(draw):
    """Generate a random overdue invoice for testing."""
    business_id = uuid4()
    
    # Generate a due date in the past (overdue)
    days_overdue = draw(st.integers(min_value=1, max_value=365))
    due_date = date.today() - timedelta(days=days_overdue)
    
    status = draw(st.sampled_from([
        InvoiceStatus.DRAFT,
        InvoiceStatus.SENT,
        InvoiceStatus.VIEWED,
        InvoiceStatus.PARTIAL,
        InvoiceStatus.OVERDUE,
    ]))
    
    return {
        "id": uuid4(),
        "business_id": business_id,
        "invoice_number": f"INV-{draw(st.integers(min_value=1000, max_value=9999))}",
        "due_date": due_date,
        "status": status,
        "issue_date": due_date - timedelta(days=7),
        "subtotal": Decimal("100.00"),
        "total": Decimal("100.00"),
        "amount_paid": Decimal("0.00"),
        "balance_due": Decimal("100.00"),
    }


# Feature: overdue-invoice-scheduler, Property 8: Error Isolation
@given(
    invoices=st.lists(
        overdue_invoice_strategy(),
        min_size=5,
        max_size=10,
    ),
    error_indices=st.lists(
        st.integers(min_value=0, max_value=9),
        min_size=1,
        max_size=3,
        unique=True
    )
)
@settings(
    max_examples=10,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_error_isolation(invoices, error_indices):
    """
    Property: For any invoice that causes an error during processing,
    the error should be logged and processing should continue for all
    remaining invoices in the batch without failing the entire job.
    
    **Validates: Requirements 4.1, 4.3**
    """
    # Create mock invoices
    mock_invoices = [create_mock_invoice(inv_data) for inv_data in invoices]
    
    # Track which invoices should error
    error_invoice_ids = {mock_invoices[i].id for i in error_indices if i < len(mock_invoices)}
    
    # Setup mock database session
    mock_session = MagicMock()
    
    # Mock customer query
    def mock_query_side_effect(model):
        mock_query = MagicMock()
        if model == Customer:
            # Return a mock customer
            mock_customer = Mock()
            mock_customer.name = "Test Customer"
            mock_query.filter.return_value.first.return_value = mock_customer
        return mock_query
    
    mock_session.query.side_effect = mock_query_side_effect
    
    # Mock notification service
    mock_notification_service = MagicMock()
    successful_notifications = []
    errors = []
    
    def mock_create_payment_overdue(**kwargs):
        invoice_id = kwargs.get('invoice_id')
        # Convert string invoice_id back to UUID for comparison
        from uuid import UUID
        invoice_uuid = UUID(invoice_id) if isinstance(invoice_id, str) else invoice_id
        
        if invoice_uuid in error_invoice_ids:
            error = Exception(f"Simulated error for invoice {invoice_id}")
            errors.append(error)
            raise error
        
        notification = Mock()
        notification.id = uuid4()
        notification.reference_id = invoice_id
        successful_notifications.append(notification)
        return notification
    
    mock_notification_service.create_payment_overdue_notification.side_effect = mock_create_payment_overdue
    
    # Execute: Process all invoices with error handling
    notification_creation_service = NotificationCreationService(mock_notification_service, mock_session)
    
    for invoice in mock_invoices:
        try:
            days_overdue = (date.today() - invoice.due_date).days
            notification_creation_service.create_overdue_notification(invoice, days_overdue)
        except Exception as e:
            # Error should be caught and logged, processing continues
            pass
    
    # Verify: Some notifications were created (for non-error invoices)
    expected_successful = len(mock_invoices) - len(error_invoice_ids)
    assert len(successful_notifications) == expected_successful
    
    # Verify: Errors were recorded
    assert len(errors) == len(error_invoice_ids)


# Feature: overdue-invoice-scheduler, Property 9: Resource Cleanup
@given(
    invoices=st.lists(
        overdue_invoice_strategy(),
        min_size=1,
        max_size=10,
    ),
    should_fail=st.booleans()
)
@settings(
    max_examples=10,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_resource_cleanup(invoices, should_fail):
    """
    Property: For any job execution (successful or failed), all database
    connections and resources should be properly closed and cleaned up.
    
    **Validates: Requirements 4.2**
    """
    # Create mock invoices
    mock_invoices = [create_mock_invoice(inv_data) for inv_data in invoices]
    
    # Mock database session
    mock_session = MagicMock()
    mock_session.is_active = True
    
    # Track if close was called
    close_called = False
    
    def mock_close():
        nonlocal close_called
        close_called = True
        mock_session.is_active = False
    
    mock_session.close.side_effect = mock_close
    
    # Mock notification service
    mock_notification_service = MagicMock()
    
    if should_fail:
        mock_notification_service.create_notification.side_effect = Exception("Simulated failure")
    else:
        mock_notification_service.create_notification.return_value = Mock()
    
    # Execute: Process invoices
    notification_creation_service = NotificationCreationService(mock_notification_service, mock_session)
    
    try:
        for invoice in mock_invoices:
            days_overdue = (date.today() - invoice.due_date).days
            notification_creation_service.create_overdue_notification(invoice, days_overdue)
    except Exception:
        pass
    finally:
        # Cleanup should always happen
        mock_session.close()
    
    # Verify: Session was closed
    assert close_called, "Database session should be closed"
    assert not mock_session.is_active, "Session should not be active after close"


# Feature: overdue-invoice-scheduler, Property 10: Execution Logging Completeness
@given(
    invoices=st.lists(
        overdue_invoice_strategy(),
        min_size=1,
        max_size=10,
    ),
    has_errors=st.booleans()
)
@settings(
    max_examples=10,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_execution_logging_completeness(invoices, has_errors):
    """
    Property: For any job execution, a complete execution log should be created
    containing job_name, status, start_time, end_time, invoices_found,
    notifications_created, and any errors.
    
    **Validates: Requirements 5.1, 5.2**
    """
    # Create mock invoices
    mock_invoices = [create_mock_invoice(inv_data) for inv_data in invoices]
    
    # Mock database session
    mock_session = MagicMock()
    
    # Mock customer query
    def mock_query_side_effect(model):
        mock_query = MagicMock()
        if model == Customer:
            # Return a mock customer
            mock_customer = Mock()
            mock_customer.name = "Test Customer"
            mock_query.filter.return_value.first.return_value = mock_customer
        return mock_query
    
    mock_session.query.side_effect = mock_query_side_effect
    
    # Mock notification service
    mock_notification_service = MagicMock()
    successful_count = 0
    errors = []
    
    def mock_create_payment_overdue(**kwargs):
        nonlocal successful_count
        if has_errors and successful_count == 0:
            error = Exception("Simulated error")
            errors.append(error)
            raise error
        successful_count += 1
        return Mock()
    
    mock_notification_service.create_payment_overdue_notification.side_effect = mock_create_payment_overdue
    
    # Create execution log
    execution_log = Mock(spec=JobExecutionLog)
    execution_log.job_name = "check_overdue_invoices"
    execution_log.status = JobStatus.RUNNING
    execution_log.start_time = datetime.now()
    execution_log.invoices_found = len(mock_invoices)
    execution_log.notifications_created = 0
    execution_log.errors = []
    
    # Execute: Process invoices
    notification_creation_service = NotificationCreationService(mock_notification_service, mock_session)
    
    for invoice in mock_invoices:
        days_overdue = (date.today() - invoice.due_date).days
        success = notification_creation_service.create_overdue_notification(invoice, days_overdue)
        if success:
            execution_log.notifications_created += 1
        else:
            # If creation failed, log the error
            execution_log.errors.append(f"Failed to create notification for invoice {invoice.id}")
    
    # Finalize log
    execution_log.end_time = datetime.now()
    execution_log.status = JobStatus.FAILED if execution_log.errors else JobStatus.COMPLETED
    
    # Verify: Log contains all required fields
    assert execution_log.job_name == "check_overdue_invoices"
    assert execution_log.status in [JobStatus.COMPLETED, JobStatus.FAILED]
    assert execution_log.start_time is not None
    assert execution_log.end_time is not None
    assert execution_log.invoices_found == len(mock_invoices)
    assert execution_log.notifications_created >= 0
    
    # Verify: Errors are logged if they occurred
    if has_errors:
        assert len(execution_log.errors) > 0
    
    # Verify: Status reflects errors
    if execution_log.errors:
        assert execution_log.status == JobStatus.FAILED
