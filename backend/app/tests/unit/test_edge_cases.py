"""Unit tests for edge cases in overdue invoice scheduler."""

from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import patch, MagicMock, Mock

from app.scheduler.jobs.overdue_invoice_job import check_overdue_invoices_job
from app.scheduler.services.invoice_query import InvoiceQueryService
from app.models.invoice import Invoice, InvoiceStatus
from app.models.job_execution_log import JobExecutionLog


def create_mock_invoice(
    invoice_id=None,
    business_id=None,
    invoice_number="INV-001",
    due_date=None,
    status=InvoiceStatus.SENT,
    total=Decimal("100.00"),
    amount_paid=Decimal("0.00")
):
    """Create a mock invoice for testing."""
    invoice = Mock(spec=Invoice)
    invoice.id = invoice_id or uuid4()
    invoice.business_id = business_id or uuid4()
    invoice.invoice_number = invoice_number
    invoice.due_date = due_date or date.today() - timedelta(days=1)
    invoice.status = status
    invoice.issue_date = date.today() - timedelta(days=8)
    invoice.total = total
    invoice.amount_paid = amount_paid
    invoice.customer_id = uuid4()
    # Mock the balance_due property
    invoice.balance_due = total - amount_paid
    return invoice


class TestEmptyInvoiceList:
    """Test handling of empty invoice lists."""
    
    @patch('app.scheduler.jobs.overdue_invoice_job.SessionLocal')
    @patch('app.scheduler.jobs.overdue_invoice_job.InvoiceQueryService')
    def test_job_completes_successfully_with_no_overdue_invoices(
        self,
        mock_invoice_service_class,
        mock_session_local
    ):
        """
        Test that job completes successfully when no overdue invoices exist.
        
        Requirements: 2.5, 5.3
        """
        # Setup: Mock database session
        mock_session = MagicMock()
        mock_session_local.return_value = mock_session
        
        # Setup: Mock job execution log
        mock_job_log = MagicMock(spec=JobExecutionLog)
        mock_session.add.return_value = None
        mock_session.commit.return_value = None
        
        # Setup: Mock invoice query service to return no invoices
        mock_invoice_service = MagicMock()
        mock_invoice_service.get_overdue_invoices_count.return_value = 0
        mock_invoice_service.get_overdue_invoices.return_value = []
        mock_invoice_service_class.return_value = mock_invoice_service
        
        # Execute: Run the job with no overdue invoices
        result = check_overdue_invoices_job()
        
        # Verify: Job completed successfully
        assert result is not None, "Job should return a result"
        assert result.invoices_found == 0, "Should find 0 overdue invoices"
        assert result.notifications_created == 0, "Should create 0 notifications"
        assert len(result.errors) == 0, "Should have no errors"
        
        # Verify: Database session was closed
        mock_session.close.assert_called_once()


class TestInvoicesDueToday:
    """Test handling of invoices with due_date equal to today."""
    
    def test_invoices_due_today_not_considered_overdue(self):
        """
        Test that invoices due today are not considered overdue.
        
        Requirements: 2.1, 2.5
        """
        # Setup: Mock database session
        mock_session = MagicMock()
        
        # Setup: Create invoice due today
        invoice = create_mock_invoice(
            invoice_number="INV-DUE-TODAY",
            due_date=date.today(),
            status=InvoiceStatus.SENT
        )
        
        # Setup: Mock query to return no invoices (since due today is not overdue)
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = []
        mock_session.query.return_value = mock_query
        
        # Execute: Query overdue invoices
        service = InvoiceQueryService(mock_session)
        overdue_invoices = service.get_overdue_invoices()
        
        # Verify: Invoice due today is not returned
        assert len(overdue_invoices) == 0, (
            "Invoices due today should not be considered overdue"
        )
        
        # Verify: Days overdue is 0
        days_overdue = service.calculate_days_overdue(invoice)
        assert days_overdue == 0, (
            "Days overdue should be 0 for invoice due today"
        )
    
    def test_invoice_due_tomorrow_not_overdue(self):
        """
        Test that invoices due in the future are not considered overdue.
        
        Requirements: 2.1, 2.5
        """
        # Setup: Mock database session
        mock_session = MagicMock()
        
        # Setup: Create invoice due tomorrow
        invoice = create_mock_invoice(
            invoice_number="INV-DUE-TOMORROW",
            due_date=date.today() + timedelta(days=1),
            status=InvoiceStatus.SENT
        )
        
        # Setup: Mock query to return no invoices (since due tomorrow is not overdue)
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = []
        mock_session.query.return_value = mock_query
        
        # Execute: Query overdue invoices
        service = InvoiceQueryService(mock_session)
        overdue_invoices = service.get_overdue_invoices()
        
        # Verify: Invoice due tomorrow is not returned
        assert len(overdue_invoices) == 0, (
            "Invoices due in the future should not be considered overdue"
        )
        
        # Verify: Days overdue is 0
        days_overdue = service.calculate_days_overdue(invoice)
        assert days_overdue == 0, (
            "Days overdue should be 0 for invoice due in the future"
        )


class TestNotificationServiceFailure:
    """Test handling of notification service failures."""
    
    @patch('app.scheduler.jobs.overdue_invoice_job.SessionLocal')
    @patch('app.scheduler.jobs.overdue_invoice_job.InvoiceQueryService')
    @patch('app.scheduler.jobs.overdue_invoice_job.NotificationCreationService')
    def test_job_continues_when_notification_service_fails(
        self,
        mock_notification_service_class,
        mock_invoice_service_class,
        mock_session_local
    ):
        """
        Test that job continues processing other invoices when notification
        service fails for one invoice.
        
        Requirements: 4.1, 4.3
        """
        # Setup: Mock database session
        mock_session = MagicMock()
        mock_session_local.return_value = mock_session
        
        # Setup: Create multiple overdue invoices
        business_id = uuid4()
        invoices = [
            create_mock_invoice(
                invoice_number=f"INV-FAIL-{1000 + i}",
                business_id=business_id,
                due_date=date.today() - timedelta(days=1)
            )
            for i in range(5)
        ]
        
        # Setup: Mock invoice query service
        mock_invoice_service = MagicMock()
        mock_invoice_service.get_overdue_invoices_count.return_value = 5
        mock_invoice_service.get_overdue_invoices.return_value = invoices
        mock_invoice_service.get_existing_notification_invoice_ids.return_value = set()
        mock_invoice_service.calculate_days_overdue.return_value = 1
        mock_invoice_service_class.return_value = mock_invoice_service
        
        # Setup: Mock notification service to fail on second call
        mock_notification_service = MagicMock()
        call_count = [0]
        
        def mock_create_with_failure(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 2:  # Fail on second call
                return False
            return True
        
        mock_notification_service.create_overdue_notification.side_effect = mock_create_with_failure
        mock_notification_service_class.return_value = mock_notification_service
        
        # Execute: Run the job
        result = check_overdue_invoices_job()
        
        # Verify: Job completed (not failed completely)
        assert result is not None, "Job should complete"
        assert result.invoices_found == 5, "Should find all 5 invoices"
        
        # Verify: Some notifications were created (for non-failing invoices)
        assert result.notifications_created == 4, (
            "4 notifications should be created (1 failed)"
        )
        
        # Verify: Database session was closed
        mock_session.close.assert_called_once()
    
    @patch('app.scheduler.jobs.overdue_invoice_job.SessionLocal')
    @patch('app.scheduler.jobs.overdue_invoice_job.InvoiceQueryService')
    @patch('app.scheduler.jobs.overdue_invoice_job.NotificationCreationService')
    def test_error_logged_with_invoice_details(
        self,
        mock_notification_service_class,
        mock_invoice_service_class,
        mock_session_local
    ):
        """
        Test that errors are logged with invoice details.
        
        Requirements: 4.1, 5.5
        """
        # Setup: Mock database session
        mock_session = MagicMock()
        mock_session_local.return_value = mock_session
        
        # Setup: Create an overdue invoice
        invoice_id = uuid4()
        invoice = create_mock_invoice(
            invoice_id=invoice_id,
            invoice_number="INV-ERROR-TEST",
            due_date=date.today() - timedelta(days=1)
        )
        
        # Setup: Mock invoice query service
        mock_invoice_service = MagicMock()
        mock_invoice_service.get_overdue_invoices_count.return_value = 1
        mock_invoice_service.get_overdue_invoices.return_value = [invoice]
        mock_invoice_service.get_existing_notification_invoice_ids.return_value = set()
        mock_invoice_service.calculate_days_overdue.return_value = 1
        mock_invoice_service_class.return_value = mock_invoice_service
        
        # Setup: Mock notification service to raise exception
        mock_notification_service = MagicMock()
        mock_notification_service.create_overdue_notification.side_effect = Exception("Test error")
        mock_notification_service_class.return_value = mock_notification_service
        
        # Execute: Run the job
        result = check_overdue_invoices_job()
        
        # Verify: Error was logged
        assert len(result.errors) > 0, "Error should be logged"
        
        # Verify: Error contains invoice ID
        error_message = result.errors[0]
        assert str(invoice_id) in error_message, (
            "Error message should contain invoice ID"
        )
        
        # Verify: Database session was closed
        mock_session.close.assert_called_once()

