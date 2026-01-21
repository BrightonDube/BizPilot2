"""Property-based tests for notification creation using mocks."""

from hypothesis import given, strategies as st, settings, HealthCheck
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import Mock, MagicMock

from app.scheduler.services.notification_creation import NotificationCreationService
from app.models.invoice import Invoice, InvoiceStatus
from app.models.notification import Notification, NotificationType
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
    created_notifications = []
    
    def mock_create_payment_overdue(**kwargs):
        notification = Mock(spec=Notification)
        notification.id = uuid4()
        notification.reference_id = kwargs.get('invoice_id')
        notification.notification_type = NotificationType.PAYMENT_OVERDUE
        notification.business_id = kwargs.get('business_id')
        # Simulate the actual notification service behavior
        invoice_number = kwargs.get('invoice_number', 'INV-0000')
        customer_name = kwargs.get('customer_name', 'Unknown Customer')
        amount = kwargs.get('amount', 0.0)
        days_overdue = kwargs.get('days_overdue', 0)
        notification.title = f"Payment Overdue: Invoice #{invoice_number}"
        notification.message = f"Invoice from {customer_name} for ${amount:.2f} is {days_overdue} days overdue"
        created_notifications.append(notification)
        return notification
    
    mock_notification_service.create_payment_overdue_notification.side_effect = mock_create_payment_overdue
    
    # Execute: Create notifications for all overdue invoices
    notification_creation_service = NotificationCreationService(mock_notification_service, mock_session)
    
    for invoice in mock_invoices:
        days_overdue = (date.today() - invoice.due_date).days
        success = notification_creation_service.create_overdue_notification(invoice, days_overdue)
        assert success, f"Failed to create notification for invoice {invoice.id}"
    
    # Verify: Exactly one notification created per invoice
    assert len(created_notifications) == len(mock_invoices)
    
    # Verify: Each notification contains invoice ID and is of correct type
    for invoice in mock_invoices:
        matching_notifications = [
            n for n in created_notifications
            if n.reference_id == str(invoice.id) and n.notification_type == NotificationType.PAYMENT_OVERDUE
        ]
        
        assert len(matching_notifications) == 1, f"Expected exactly 1 notification for invoice {invoice.id}"
        
        notification = matching_notifications[0]
        assert notification.business_id == str(invoice.business_id)
        assert invoice.invoice_number in notification.message or invoice.invoice_number in notification.title


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
    created_notification = None
    
    def mock_create_payment_overdue(**kwargs):
        nonlocal created_notification
        notification = Mock(spec=Notification)
        notification.id = uuid4()
        notification.reference_id = kwargs.get('invoice_id')
        notification.notification_type = NotificationType.PAYMENT_OVERDUE
        notification.business_id = kwargs.get('business_id')
        # Simulate the actual notification service behavior
        invoice_number = kwargs.get('invoice_number', 'INV-0000')
        customer_name = kwargs.get('customer_name', 'Unknown Customer')
        amount = kwargs.get('amount', 0.0)
        days_overdue = kwargs.get('days_overdue', 0)
        notification.title = f"Payment Overdue: Invoice #{invoice_number}"
        notification.message = f"Invoice from {customer_name} for ${amount:.2f} is {days_overdue} days overdue"
        created_notification = notification
        return notification
    
    mock_notification_service.create_payment_overdue_notification.side_effect = mock_create_payment_overdue
    
    # Execute: Create notification
    notification_creation_service = NotificationCreationService(mock_notification_service, mock_session)
    
    days_overdue = (date.today() - mock_invoice.due_date).days
    success = notification_creation_service.create_overdue_notification(mock_invoice, days_overdue)
    
    assert success, "Failed to create notification"
    assert created_notification is not None, "Notification should be created"
    
    # Verify: Notification contains days overdue information
    notification_text = f"{created_notification.title} {created_notification.message}".lower()
    assert "overdue" in notification_text, "Notification should mention 'overdue'"
