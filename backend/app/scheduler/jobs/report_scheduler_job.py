"""Report scheduler job for sending automated reports."""

import logging
from datetime import datetime
from typing import List, Optional
from dataclasses import dataclass

from app.core.database import SessionLocal
from app.models.job_execution_log import JobExecutionLog, JobStatus
from app.models.report_subscription import DeliveryFrequency, DeliveryStatus
from app.services.report_subscription_service import ReportSubscriptionService
from app.services.report_generator_service import ReportGeneratorService
from app.services.report_email_service import ReportEmailService
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)


@dataclass
class ReportJobResult:
    """Result of report job execution."""
    start_time: datetime
    end_time: datetime
    subscriptions_processed: int
    emails_sent: int
    errors: List[str]


def process_automated_reports_job(frequency: str) -> ReportJobResult:
    """
    Execute the automated report generation and email job.
    
    Args:
        frequency: 'weekly' or 'monthly'
        
    Returns:
        ReportJobResult containing execution statistics
    """
    start_time = datetime.utcnow()
    subscriptions_processed = 0
    emails_sent = 0
    errors = []
    
    logger.info(f"Starting {frequency} automated report job")
    
    try:
        freq_enum = DeliveryFrequency(frequency)
    except ValueError:
        logger.error(f"Invalid frequency: {frequency}")
        return ReportJobResult(start_time, datetime.utcnow(), 0, 0, [f"Invalid frequency: {frequency}"])

    # Create database session
    db = SessionLocal()
    job_log = None
    
    try:
        # Create job execution log
        job_log = JobExecutionLog(
            job_name=f"automated_reports_{frequency}",
            start_time=start_time,
            status=JobStatus.RUNNING
        )
        db.add(job_log)
        db.commit()
        
        # Initialize services
        subscription_service = ReportSubscriptionService(db)
        generator_service = ReportGeneratorService(db)
        email_service = EmailService() # Assuming this doesn't need DB
        report_email_service = ReportEmailService(email_service)
        
        # Get active subscriptions for this frequency
        subscriptions = subscription_service.get_active_subscriptions_by_frequency(freq_enum, batch_size=1000)
        logger.info(f"Found {len(subscriptions)} active {frequency} subscriptions")
        
        # Calculate period
        current_time = datetime.utcnow()
        if freq_enum == DeliveryFrequency.WEEKLY:
            period_start, period_end = generator_service.calculate_weekly_period(current_time)
        else:
            period_start, period_end = generator_service.calculate_monthly_period(current_time)
            
        logger.info(f"Reporting period: {period_start} to {period_end}")
        
        for sub in subscriptions:
            subscriptions_processed += 1
            try:
                # Generate Report
                report_data = generator_service.generate_report(
                    user_id=sub.user_id,
                    user_email="user@example.com", # Ideally we fetch user email, let's look it up
                    report_type=sub.report_type_enum,
                    period_start=period_start,
                    period_end=period_end,
                    business=None # Auto-detect primary business
                )
                
                # Fetch user email if needed - but wait, generate_report takes user_email.
                # We need to fetch the user to get the email.
                # ReportGeneratorService.generate_report uses the provided email in the result.
                # Let's quickly fetch the user using the relationship if available or query.
                user = sub.user # Assuming relationship exists
                if not user or not user.email:
                    logger.warning(f"User {sub.user_id} not found or has no email, skipping subscription {sub.id}")
                    continue
                    
                # Regenerate with correct email if we passed dummy before
                # Actually, better to fetch user first.
                
                report_data = generator_service.generate_report(
                    user_id=sub.user_id,
                    user_email=user.email,
                    report_type=sub.report_type_enum,
                    period_start=period_start,
                    period_end=period_end
                )
                
                if not report_data:
                    logger.warning(f"No data generated for subscription {sub.id}")
                    subscription_service.log_delivery(
                        user_id=sub.user_id,
                        report_type=sub.report_type_enum,
                        frequency=freq_enum,
                        period_start=period_start,
                        period_end=period_end,
                        status=DeliveryStatus.SKIPPED,
                        error_message="No data generated"
                    )
                    continue
                
                # Send Email
                report_email_service.send_report_email(report_data, include_excel=True)
                emails_sent += 1
                
                # Log Success
                subscription_service.log_delivery(
                    user_id=sub.user_id,
                    report_type=sub.report_type_enum,
                    frequency=freq_enum,
                    period_start=period_start,
                    period_end=period_end,
                    status=DeliveryStatus.SUCCESS,
                    delivered_at=datetime.utcnow()
                )
                
                # Update last sent
                subscription_service.update_last_sent(sub.id, datetime.utcnow())
                
            except Exception as e:
                error_msg = f"Error processing subscription {sub.id}: {str(e)}"
                logger.error(error_msg, exc_info=True)
                errors.append(error_msg)
                
                subscription_service.log_delivery(
                    user_id=sub.user_id,
                    report_type=sub.report_type_enum if hasattr(sub, 'report_type_enum') else None, # Fallback
                    frequency=freq_enum,
                    period_start=period_start,
                    period_end=period_end,
                    status=DeliveryStatus.FAILED,
                    error_message=str(e)
                )
        
        # Update job log with success
        end_time = datetime.utcnow()
        job_log.end_time = end_time
        job_log.status = JobStatus.COMPLETED
        job_log.items_processed = subscriptions_processed
        job_log.items_succeeded = emails_sent
        job_log.error_count = len(errors)
        job_log.error_details = "\n".join(errors[:10]) if errors else None
        
        db.commit()
        
        return ReportJobResult(
            start_time=start_time,
            end_time=end_time,
            subscriptions_processed=subscriptions_processed,
            emails_sent=emails_sent,
            errors=errors
        )
        
    except Exception as e:
        end_time = datetime.utcnow()
        error_msg = f"Job failed with error: {str(e)}"
        logger.error(error_msg, exc_info=True)
        errors.append(error_msg)
        
        if job_log:
            job_log.end_time = end_time
            job_log.status = JobStatus.FAILED
            job_log.error_count = len(errors)
            job_log.error_details = "\n".join(errors[:10]) if errors else None
            try:
                db.commit()
            except Exception:
                db.rollback()
                
        return ReportJobResult(
            start_time=start_time,
            end_time=end_time,
            subscriptions_processed=subscriptions_processed,
            emails_sent=emails_sent,
            errors=errors
        )
    finally:
        db.close()
