"""Overdue invoice check job."""

import logging
from datetime import datetime
from typing import List
from dataclasses import dataclass

from app.core.database import SessionLocal
from app.models.job_execution_log import JobExecutionLog, JobStatus
from app.scheduler.services.invoice_query import InvoiceQueryService
from app.scheduler.services.notification_creation import NotificationCreationService
from app.services.notification_service import NotificationService
from app.scheduler.config import SchedulerConfig

logger = logging.getLogger(__name__)


@dataclass
class JobExecutionResult:
    """Result of job execution."""
    start_time: datetime
    end_time: datetime
    invoices_found: int
    notifications_created: int
    errors: List[str]


def check_overdue_invoices_job() -> JobExecutionResult:
    """
    Execute the overdue invoice check job.
    
    This job:
    1. Queries all overdue invoices
    2. Checks for existing notifications
    3. Creates notifications for invoices without existing ones
    4. Handles errors gracefully
    
    Returns:
        JobExecutionResult containing execution statistics
    """
    start_time = datetime.utcnow()
    invoices_found = 0
    notifications_created = 0
    errors = []
    
    logger.info("Starting overdue invoice check job")
    
    # Create database session
    db = SessionLocal()
    job_log = None
    
    try:
        # Create job execution log
        job_log = JobExecutionLog(
            job_name="check_overdue_invoices",
            start_time=start_time,
            status=JobStatus.RUNNING
        )
        db.add(job_log)
        db.commit()
        
        # Load configuration
        config = SchedulerConfig.from_env()
        batch_size = config.batch_size
        
        # Initialize services
        invoice_query_service = InvoiceQueryService(db)
        notification_service = NotificationService(db)
        notification_creation_service = NotificationCreationService(
            notification_service,
            db
        )
        
        # Get total count of overdue invoices
        total_count = invoice_query_service.get_overdue_invoices_count()
        invoices_found = total_count
        
        logger.info(f"Found {total_count} overdue invoices to process")
        
        # Process invoices in batches
        offset = 0
        while offset < total_count:
            try:
                # Get batch of overdue invoices
                batch = invoice_query_service.get_overdue_invoices(
                    limit=batch_size,
                    offset=offset
                )
                
                if not batch:
                    break
                
                logger.info(f"Processing batch of {len(batch)} invoices (offset: {offset})")
                
                # Get invoice IDs that already have notifications
                invoice_ids = [inv.id for inv in batch]
                existing_notification_ids = invoice_query_service.get_existing_notification_invoice_ids(
                    invoice_ids
                )
                
                # Process each invoice in the batch
                for invoice in batch:
                    try:
                        # Skip if notification already exists
                        if invoice.id in existing_notification_ids:
                            logger.debug(f"Skipping invoice {invoice.invoice_number} - notification exists")
                            continue
                        
                        # Calculate days overdue
                        days_overdue = invoice_query_service.calculate_days_overdue(invoice)
                        
                        # Create notification
                        success = notification_creation_service.create_overdue_notification(
                            invoice,
                            days_overdue
                        )
                        
                        if success:
                            notifications_created += 1
                        else:
                            errors.append(f"Failed to create notification for invoice {invoice.id}")
                    
                    except Exception as e:
                        error_msg = f"Error processing invoice {invoice.id}: {str(e)}"
                        logger.error(error_msg, exc_info=True)
                        errors.append(error_msg)
                        continue  # Continue processing other invoices
                
                # Move to next batch
                offset += batch_size
            
            except Exception as e:
                error_msg = f"Error processing batch at offset {offset}: {str(e)}"
                logger.error(error_msg, exc_info=True)
                errors.append(error_msg)
                # Continue to next batch
                offset += batch_size
        
        # Update job log with success
        end_time = datetime.utcnow()
        job_log.end_time = end_time
        job_log.status = JobStatus.COMPLETED
        job_log.invoices_processed = invoices_found
        job_log.notifications_created = notifications_created
        job_log.error_count = len(errors)
        job_log.error_details = "\n".join(errors[:10]) if errors else None  # Store first 10 errors
        
        db.commit()
        
        duration = (end_time - start_time).total_seconds()
        logger.info(
            f"Overdue invoice check job completed in {duration:.2f}s. "
            f"Processed {invoices_found} invoices, created {notifications_created} notifications, "
            f"{len(errors)} errors"
        )
        
        return JobExecutionResult(
            start_time=start_time,
            end_time=end_time,
            invoices_found=invoices_found,
            notifications_created=notifications_created,
            errors=errors
        )
    
    except Exception as e:
        # Handle catastrophic failure
        end_time = datetime.utcnow()
        error_msg = f"Job failed with error: {str(e)}"
        logger.error(error_msg, exc_info=True)
        errors.append(error_msg)
        
        # Update job log with failure
        if job_log:
            job_log.end_time = end_time
            job_log.status = JobStatus.FAILED
            job_log.invoices_processed = invoices_found
            job_log.notifications_created = notifications_created
            job_log.error_count = len(errors)
            job_log.error_details = "\n".join(errors[:10]) if errors else None
            
            try:
                db.commit()
            except Exception:
                db.rollback()
        
        return JobExecutionResult(
            start_time=start_time,
            end_time=end_time,
            invoices_found=invoices_found,
            notifications_created=notifications_created,
            errors=errors
        )
    
    finally:
        # Always close the database session
        db.close()
        logger.info("Database session closed")
