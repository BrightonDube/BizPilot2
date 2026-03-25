"""Property-based tests for notification creation using mocks."""

from hypothesis import given, strategies as st, settings, HealthCheck
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import Mock, MagicMock

from app.scheduler.services.notification_creation import NotificationCreationService
from app.models.invoice import Invoice, InvoiceStatus

from app.models.customer import Customer


def create_mock_invoice(invoice_data):
    """Create a mock invoice object with the given data."""
    mock_invoice = Mock(spec=Invoice)
    for key, value in invoice_data.items():
        setattr(mock_invoice, key, value)
    
    # Add balance_due property
    mock_invoice.balance_due = invoice_data.get('balance_due', Decimal('100.00'))
    
    return mock_invoice


def create_mock_customer(customer_data):
    """Create a mock customer object with the given data."""
    mock_customer = Mock(spec=Customer)
    for key, value in customer_data.items():
        setattr(mock_customer, key, value)
    
    # Add display_name property and name attribute
    mock_customer.display_name = customer_data.get('first_name', 'Test Customer')
    mock_customer.name = customer_data.get('first_name', 'Test Customer')
    
    return mock_customer


# Strategy for generating overdue invoices
@st.composite
def overdue_invoice_strategy(draw):
    """Generate a random overdue invoice for testing."""
    business_id = uuid4()
    customer_id = uuid4()
    
    # Generate a due date in the past (overdue)
    days_overdue = draw(st.integers(min_value=1, max_value=365))
    due_date = date.today() - timedelta(days=days_overdue)
    
    # Only use statuses that make invoices overdue (not PAID or CANCELLED)
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
        "customer_id": customer_id,
        "invoice_number": f"INV-{draw(st.integers(min_value=1000, max_value=9999))}",
        "due_date": due_date,
        "status": status,
        "issue_date": due_date - timedelta(days=7),
        "subtotal": Decimal("100.00"),
        "total": Decimal("100.00"),
        "amount_paid": Decimal("0.00"),
        "balance_due": Decimal("100.00"),
    }


# Feature: overdue-invoice-scheduler, Property 6: Notification Creation for New Overdue Invoices
@given(
    invoices=st.lists(
        overdue_invoice_strategy(),
        min_size=1,
        max_size=10,
    )
)
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_notification_creation_for_new_overdue_invoices(invoices):
    """
    Property: For any overdue invoice without an existing payment overdue notification,
    the scheduler should create exactly one new notification containing the invoice
    identifier and days overdue.
    
    **Validates: Requirements 3.2, 3.3**
    """
    # Create mock invoices
    mock_invoices = [create_mock_invoice(inv_data) for inv_data in invoices]
    
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
    notify_calls = []

    def mock_notify_business_users(**kwargs):
        notify_calls.append(kwargs)

    mock_notification_service.notify_business_users.side_effect = mock_notify_business_users

    # Execute: Create notifications for all overdue invoices
    notification_creation_service = NotificationCreationService(mock_notification_service, mock_session)

    for invoice in mock_invoices:
        days_overdue = (date.today() - invoice.due_date).days
        success = notification_creation_service.create_overdue_notification(invoice, days_overdue)
        assert success, f"Failed to create notification for invoice {invoice.id}"

    # Verify: Exactly one notify_business_users call per invoice
    assert len(notify_calls) == len(mock_invoices)

    # Verify: Each call contains the invoice number in title or message
    for i, invoice in enumerate(mock_invoices):
        call = notify_calls[i]
        title = call.get('title', '')
        message = call.get('message', '')
        assert invoice.invoice_number in title or invoice.invoice_number in message, \
            f"Invoice number {invoice.invoice_number} not found in notification"


@given(
    invoice_data=overdue_invoice_strategy()
)
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_notification_contains_days_overdue(invoice_data):
    """
    Property: Notifications should contain information about days overdue.
    
    **Validates: Requirements 3.3**
    """
    # Create mock invoice
    mock_invoice = create_mock_invoice(invoice_data)
    
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
    notify_call_kwargs = {}

    def mock_notify_business_users(**kwargs):
        notify_call_kwargs.update(kwargs)

    mock_notification_service.notify_business_users.side_effect = mock_notify_business_users

    # Execute: Create notification
    notification_creation_service = NotificationCreationService(mock_notification_service, mock_session)

    days_overdue = (date.today() - mock_invoice.due_date).days
    success = notification_creation_service.create_overdue_notification(mock_invoice, days_overdue)

    assert success, "Failed to create notification"
    assert notify_call_kwargs, "Notification should be created"

    # Verify: Notification contains days overdue information
    title = notify_call_kwargs.get('title', '')
    message = notify_call_kwargs.get('message', '')
    notification_text = f"{title} {message}".lower()
    assert "overdue" in notification_text, "Notification should mention 'overdue'"
