"""Property-based tests for notification deduplication."""

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import Mock, patch, call

from app.scheduler.services.invoice_query import InvoiceQueryService
from app.scheduler.services.notification_creation import NotificationCreationService
from app.models.invoice import Invoice, InvoiceStatus
from app.models.notification import Notification, NotificationType
from app.services.notification_service import NotificationService
from app.core.database import SessionLocal


def get_test_db_session():
    """Get a database session for testing."""
    session = SessionLocal()
    return session


def cleanup_test_data(session):
    """Clean up test data from the database."""
    try:
        # Delete in order to respect foreign key constraints
        try:
            session.query(Notification).delete()
        except:
            pass
        try:
            session.query(Invoice).delete()
        except:
            pass
        session.commit()
    except Exception as e:
        session.rollback()
        raise e


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


# Feature: overdue-invoice-scheduler, Property 5: Notification Deduplication
@given(
    invoices_with_notifications=st.lists(
        overdue_invoice_strategy(),
        min_size=0,
        max_size=10,
    ),
    invoices_without_notifications=st.lists(
        overdue_invoice_strategy(),
        min_size=0,
        max_size=10,
    )
)
@settings(
    max_examples=100,  # Full coverage as specified in design
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_notification_deduplication(invoices_with_notifications, invoices_without_notifications):
    """
    Property: For any overdue invoice that already has a payment overdue notification,
    the scheduler should skip creating a duplicate notification and should not call
    the NotificationService for that invoice.
    
    **Validates: Requirements 3.1, 3.4**
    """
    # Get a fresh database session
    db_session = get_test_db_session()
    
    try:
        # Clean up any existing test data
        cleanup_test_data(db_session)
        
        # Setup: Create invoices with existing notifications
        invoices_with_notif_objects = []
        for invoice_data in invoices_with_notifications:
            invoice = Invoice(**invoice_data)
            db_session.add(invoice)
            invoices_with_notif_objects.append(invoice)
        
        # Setup: Create invoices without notifications
        invoices_without_notif_objects = []
        for invoice_data in invoices_without_notifications:
            invoice = Invoice(**invoice_data)
            db_session.add(invoice)
            invoices_without_notif_objects.append(invoice)
        
        db_session.commit()
        
        # Create notifications for the first set of invoices
        for invoice in invoices_with_notif_objects:
            notification = Notification(
                business_id=invoice.business_id,
                user_id=None,  # Broadcast notification
                notification_type=NotificationType.PAYMENT_OVERDUE,
                priority="high",
                title=f"Payment Overdue: Invoice #{invoice.invoice_number}",
                message=f"Invoice {invoice.invoice_number} is overdue",
                reference_type="invoice",
                reference_id=invoice.id,
                is_read=False,
            )
            db_session.add(notification)
        
        db_session.commit()
        
        # Execute: Get all overdue invoices
        invoice_query_service = InvoiceQueryService(db_session)
        all_overdue_invoices = invoice_query_service.get_overdue_invoices()
        
        # Mock the NotificationService to track calls
        with patch.object(NotificationService, 'create_notification') as mock_create:
            # Execute: Create notifications for overdue invoices
            notification_service = NotificationCreationService(db_session)
            notification_service.create_overdue_invoice_notifications(all_overdue_invoices)
            
            # Verify: NotificationService should only be called for invoices without existing notifications
            expected_calls = len(invoices_without_notif_objects)
            actual_calls = mock_create.call_count
            
            # Property: No duplicate notifications should be created
            assert actual_calls == expected_calls, (
                f"Expected {expected_calls} notification calls for invoices without notifications, "
                f"but got {actual_calls} calls"
            )
            
            # Verify: All calls should be for invoices without existing notifications
            if expected_calls > 0:
                called_invoice_ids = {call_args[1]['reference_id'] for call_args in mock_create.call_args_list}
                expected_invoice_ids = {inv.id for inv in invoices_without_notif_objects}
                
                # All called IDs should be in the expected set
                assert called_invoice_ids.issubset(expected_invoice_ids), (
                    f"Notification service was called for unexpected invoices"
                )
    
    finally:
        # Cleanup
        cleanup_test_data(db_session)
        db_session.close()
