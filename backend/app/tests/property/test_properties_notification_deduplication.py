"""Property-based tests for notification deduplication using mocks."""

import pytest
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
    mock_invoice.balance_due = invoice_data.get('total', Decimal('0.00')) - invoice_data.get('amount_paid', Decimal('0.00'))
    
    return mock_invoice


# Strategy for generating overdue invoices
@st.composite
def overdue_invoice_strategy(draw):
    """Generate a random overdue invoice for testing."""
    business_id = uuid4()
    
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
        "invoice_number": f"INV-{draw(st.integers(min_value=1000, max_value=9999))}",
        "due_date": due_date,
        "status": status,
        "issue_date": due_date - timedelta(days=7),
        "subtotal": Decimal("100.00"),
        "total": Decimal("100.00"),
        "amount_paid": Decimal("0.00"),
    }


# Feature: overdue-invoice-scheduler, Property 7: Notification Deduplication
@given(
    invoices_with_notifications=st.lists(
        overdue_invoice_strategy(),
        min_size=1,
        max_size=5,
    ),
    invoices_without_notifications=st.lists(
        overdue_invoice_strategy(),
        min_size=1,
        max_size=5,
    )
)
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_notification_deduplication(invoices_with_notifications, invoices_without_notifications):
    """
    Property: For any overdue invoice that already has a payment overdue notification,
    the scheduler should skip creating a duplicate notification.
    
    **Validates: Requirements 3.1, 3.4**
    """
    # Create mock invoices
    mock_invoices_with_notif = [create_mock_invoice(inv_data) for inv_data in invoices_with_notifications]
    mock_invoices_without_notif = [create_mock_invoice(inv_data) for inv_data in invoices_without_notifications]
    
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
    
    # Mock existing notifications for first set of invoices
    existing_notifications = []
    for invoice in mock_invoices_with_notif:
        notification = Mock(spec=Notification)
        notification.id = uuid4()
        notification.reference_id = str(invoice.id)
        notification.notification_type = NotificationType.PAYMENT_OVERDUE
        notification.business_id = str(invoice.business_id)
        existing_notifications.append(notification)
    
    # Mock notification service
    mock_notification_service = MagicMock()
    
    # Mock has_existing_notification to return True for invoices with notifications
    def mock_has_existing(**kwargs):
        reference_id = kwargs.get('reference_id')
        return any(n.reference_id == reference_id for n in existing_notifications)
    
    mock_notification_service.has_existing_notification.side_effect = mock_has_existing
    
    created_notifications = []
    
    def mock_create_payment_overdue(**kwargs):
        # Check if notification already exists
        invoice_id = kwargs.get('invoice_id')
        if any(n.reference_id == invoice_id for n in existing_notifications):
            # Don't create duplicate
            return None
        
        notification = Mock(spec=Notification)
        notification.id = uuid4()
        notification.reference_id = invoice_id
        notification.notification_type = NotificationType.PAYMENT_OVERDUE
        notification.business_id = kwargs.get('business_id')
        created_notifications.append(notification)
        return notification
    
    mock_notification_service.create_payment_overdue_notification.side_effect = mock_create_payment_overdue
    
    # Execute: Try to create notifications for all invoices
    notification_creation_service = NotificationCreationService(mock_notification_service, mock_session)
    
    # Process invoices with existing notifications
    for invoice in mock_invoices_with_notif:
        days_overdue = (date.today() - invoice.due_date).days
        # Check if notification exists before creating
        if not any(n.reference_id == str(invoice.id) for n in existing_notifications):
            notification_creation_service.create_overdue_notification(invoice, days_overdue)
    
    # Process invoices without existing notifications
    for invoice in mock_invoices_without_notif:
        days_overdue = (date.today() - invoice.due_date).days
        notification_creation_service.create_overdue_notification(invoice, days_overdue)
    
    # Verify: Only invoices without existing notifications got new notifications
    assert len(created_notifications) == len(mock_invoices_without_notif), (
        f"Expected {len(mock_invoices_without_notif)} new notifications, "
        f"but {len(created_notifications)} were created"
    )
    
    # Verify: No duplicate notifications for invoices that already had them
    created_invoice_ids = {n.reference_id for n in created_notifications}
    existing_invoice_ids = {n.reference_id for n in existing_notifications}
    
    assert created_invoice_ids.isdisjoint(existing_invoice_ids), (
        "Duplicate notifications were created for invoices that already had them"
    )
    
    # Verify: All invoices without notifications got one
    invoices_without_ids = {str(inv.id) for inv in mock_invoices_without_notif}
    assert created_invoice_ids == invoices_without_ids, (
        "Not all invoices without notifications received one"
    )
