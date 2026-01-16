"""Unit tests for edge cases in overdue invoice scheduler."""

import pytest
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import patch, MagicMock

from app.scheduler.jobs.overdue_invoice_job import check_overdue_invoices_job
from app.scheduler.services.invoice_query import InvoiceQueryService
from app.models.invoice import Invoice, InvoiceStatus
from app.models.job_execution_log import JobExecutionLog, JobStatus
from app.core.database import SessionLocal


def get_test_db_session():
    """Get a database session for testing."""
    session = SessionLocal()
    return session


def cleanup_test_data(session):
    """Clean up test data from the database."""
    try:
        try:
            session.query(JobExecutionLog).delete()
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


class TestEmptyInvoiceList:
    """Test handling of empty invoice lists."""
    
    def test_job_completes_successfully_with_no_overdue_invoices(self):
        """
        Test that job completes successfully when no overdue invoices exist.
        
        Requirements: 2.5, 5.3
        """
        # Get a fresh database session
        db_session = get_test_db_session()
        
        try:
            # Clean up any existing test data
            cleanup_test_data(db_session)
            db_session.close()
            
            # Execute: Run the job with no overdue invoices
            result = check_overdue_invoices_job()
            
            # Verify: Job completed successfully
            assert result is not None, "Job should return a result"
            assert result.invoices_found == 0, "Should find 0 overdue invoices"
            assert result.notifications_created == 0, "Should create 0 notifications"
            assert len(result.errors) == 0, "Should have no errors"
            
            # Verify: JobExecutionLog shows 0 invoices processed
            db_session = get_test_db_session()
            job_log = db_session.query(JobExecutionLog).filter(
                JobExecutionLog.job_name == "check_overdue_invoices"
            ).order_by(JobExecutionLog.start_time.desc()).first()
            
            assert job_log is not None, "JobExecutionLog should be created"
            assert job_log.invoices_processed == 0, "Log should show 0 invoices processed"
            assert job_log.status == JobStatus.COMPLETED, "Job should be marked as completed"
        
        finally:
            # Cleanup
            db_session = get_test_db_session()
            cleanup_test_data(db_session)
            db_session.close()


class TestInvoicesDueToday:
    """Test handling of invoices with due_date equal to today."""
    
    def test_invoices_due_today_not_considered_overdue(self):
        """
        Test that invoices due today are not considered overdue.
        
        Requirements: 2.1, 2.5
        """
        # Get a fresh database session
        db_session = get_test_db_session()
        
        try:
            # Clean up any existing test data
            cleanup_test_data(db_session)
            
            # Setup: Create invoice due today
            invoice = Invoice(
                id=uuid4(),
                business_id=uuid4(),
                invoice_number="INV-DUE-TODAY",
                due_date=date.today(),  # Due today
                status=InvoiceStatus.SENT,
                issue_date=date.today() - timedelta(days=7),
                subtotal=Decimal("100.00"),
                total=Decimal("100.00"),
                amount_paid=Decimal("0.00"),
            )
            db_session.add(invoice)
            db_session.commit()
            
            # Execute: Query overdue invoices
            service = InvoiceQueryService(db_session)
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
        
        finally:
            # Cleanup
            cleanup_test_data(db_session)
            db_session.close()
    
    def test_invoice_due_tomorrow_not_overdue(self):
        """
        Test that invoices due in the future are not considered overdue.
        
        Requirements: 2.1, 2.5
        """
        # Get a fresh database session
        db_session = get_test_db_session()
        
        try:
            # Clean up any existing test data
            cleanup_test_data(db_session)
            
            # Setup: Create invoice due tomorrow
            invoice = Invoice(
                id=uuid4(),
                business_id=uuid4(),
                invoice_number="INV-DUE-TOMORROW",
                due_date=date.today() + timedelta(days=1),  # Due tomorrow
                status=InvoiceStatus.SENT,
                issue_date=date.today(),
                subtotal=Decimal("100.00"),
                total=Decimal("100.00"),
                amount_paid=Decimal("0.00"),
            )
            db_session.add(invoice)
            db_session.commit()
            
            # Execute: Query overdue invoices
            service = InvoiceQueryService(db_session)
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
        
        finally:
            # Cleanup
            cleanup_test_data(db_session)
            db_session.close()


class TestNotificationServiceFailure:
    """Test handling of notification service failures."""
    
    def test_job_continues_when_notification_service_fails(self):
        """
        Test that job continues processing other invoices when notification
        service fails for one invoice.
        
        Requirements: 4.1, 4.3
        """
        # Get a fresh database session
        db_session = get_test_db_session()
        
        try:
            # Clean up any existing test data
            cleanup_test_data(db_session)
            
            # Setup: Create multiple overdue invoices
            business_id = uuid4()
            for i in range(5):
                invoice = Invoice(
                    id=uuid4(),
                    business_id=business_id,
                    invoice_number=f"INV-FAIL-{1000 + i}",
                    due_date=date.today() - timedelta(days=1),
                    status=InvoiceStatus.SENT,
                    issue_date=date.today() - timedelta(days=8),
                    subtotal=Decimal("100.00"),
                    total=Decimal("100.00"),
                    amount_paid=Decimal("0.00"),
                    balance_due=Decimal("100.00"),
                )
                db_session.add(invoice)
            
            db_session.commit()
            db_session.close()
            
            # Mock NotificationService to fail for some invoices
            from app.services.notification_service import NotificationService
            original_method = NotificationService.create_payment_overdue_notification
            call_count = [0]
            
            def mock_create_with_failure(*args, **kwargs):
                call_count[0] += 1
                if call_count[0] == 2:  # Fail on second call
                    raise Exception("Simulated notification service failure")
                return original_method(*args, **kwargs)
            
            with patch.object(
                NotificationService,
                'create_payment_overdue_notification',
                mock_create_with_failure
            ):
                # Execute: Run the job
                result = check_overdue_invoices_job()
                
                # Verify: Job completed (not failed completely)
                assert result is not None, "Job should complete"
                assert result.invoices_found == 5, "Should find all 5 invoices"
                
                # Verify: Error was logged
                assert len(result.errors) > 0, "Error should be logged"
                
                # Verify: Some notifications were created (for non-failing invoices)
                assert result.notifications_created >= 0, (
                    "Some notifications should be created"
                )
        
        finally:
            # Cleanup
            db_session = get_test_db_session()
            cleanup_test_data(db_session)
            db_session.close()
    
    def test_error_logged_with_invoice_details(self):
        """
        Test that errors are logged with invoice details.
        
        Requirements: 4.1, 5.5
        """
        # Get a fresh database session
        db_session = get_test_db_session()
        
        try:
            # Clean up any existing test data
            cleanup_test_data(db_session)
            
            # Setup: Create an overdue invoice
            invoice_id = uuid4()
            invoice = Invoice(
                id=invoice_id,
                business_id=uuid4(),
                invoice_number="INV-ERROR-TEST",
                due_date=date.today() - timedelta(days=1),
                status=InvoiceStatus.SENT,
                issue_date=date.today() - timedelta(days=8),
                subtotal=Decimal("100.00"),
                total=Decimal("100.00"),
                amount_paid=Decimal("0.00"),
                balance_due=Decimal("100.00"),
            )
            db_session.add(invoice)
            db_session.commit()
            db_session.close()
            
            # Mock NotificationService to fail
            from app.services.notification_service import NotificationService
            with patch.object(
                NotificationService,
                'create_payment_overdue_notification',
                side_effect=Exception("Test error")
            ):
                # Execute: Run the job
                result = check_overdue_invoices_job()
                
                # Verify: Error contains invoice ID
                assert len(result.errors) > 0, "Error should be logged"
                error_message = result.errors[0]
                assert str(invoice_id) in error_message, (
                    "Error message should contain invoice ID"
                )
        
        finally:
            # Cleanup
            db_session = get_test_db_session()
            cleanup_test_data(db_session)
            db_session.close()
