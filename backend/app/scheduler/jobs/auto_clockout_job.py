"""Auto clock-out job."""

import logging
from datetime import datetime
from typing import List, Dict, Any
from dataclasses import dataclass

from app.core.database import SessionLocal
from app.models.job_execution_log import JobExecutionLog, JobStatus
from app.models.business import Business
from app.services.time_tracking_service import TimeTrackingService

logger = logging.getLogger(__name__)


@dataclass
class AutoClockOutResult:
    """Result of auto clock-out job execution."""
    start_time: datetime
    end_time: datetime
    businesses_processed: int
    employees_auto_clocked_out: int
    errors: List[str]


def auto_clock_out_job() -> AutoClockOutResult:
    """
    Execute the auto clock-out job.
    
    This job:
    1. Iterates through all businesses
    2. Runs the day-end process for each business
    3. Auto clocks out employees if applicable
    4. Handles errors gracefully
    
    Returns:
        AutoClockOutResult containing execution statistics
    """
    start_time = datetime.utcnow()
    businesses_processed = 0
    employees_auto_clocked_out = 0
    errors = []
    
    logger.info("Starting auto clock-out job")
    
    # Create database session
    db = SessionLocal()
    job_log = None
    
    try:
        # Create job execution log
        job_log = JobExecutionLog(
            job_name="auto_clock_out",
            start_time=start_time,
            status=JobStatus.RUNNING
        )
        db.add(job_log)
        db.commit()
        
        # Initialize service
        time_tracking_service = TimeTrackingService(db)
        
        # Get all businesses
        businesses = db.query(Business).all()
        total_businesses = len(businesses)
        logger.info(f"Found {total_businesses} businesses to process")
        
        for business in businesses:
            try:
                businesses_processed += 1
                result = time_tracking_service.run_day_end_process(str(business.id))
                
                clocked_out_count = result.get("auto_clocked_out", 0)
                if clocked_out_count > 0:
                    employees_auto_clocked_out += clocked_out_count
                    logger.info(f"Business {business.id}: Auto clocked out {clocked_out_count} employees")
                    
            except Exception as e:
                error_msg = f"Error processing business {business.id}: {str(e)}"
                logger.error(error_msg, exc_info=True)
                errors.append(error_msg)
                # Continue processing other businesses
        
        # Update job log with success
        end_time = datetime.utcnow()
        job_log.end_time = end_time
        job_log.status = JobStatus.COMPLETED
        job_log.items_processed = businesses_processed
        job_log.items_succeeded = employees_auto_clocked_out  # Reusing field for clock-out count
        job_log.error_count = len(errors)
        job_log.error_details = "\n".join(errors[:10]) if errors else None
        
        db.commit()
        
        duration = (end_time - start_time).total_seconds()
        logger.info(
            f"Auto clock-out job completed in {duration:.2f}s. "
            f"Processed {businesses_processed} businesses, "
            f"auto clocked out {employees_auto_clocked_out} employees, "
            f"{len(errors)} errors"
        )
        
        return AutoClockOutResult(
            start_time=start_time,
            end_time=end_time,
            businesses_processed=businesses_processed,
            employees_auto_clocked_out=employees_auto_clocked_out,
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
            job_log.items_processed = businesses_processed
            job_log.items_succeeded = employees_auto_clocked_out
            job_log.error_count = len(errors)
            job_log.error_details = "\n".join(errors[:10]) if errors else None
            
            try:
                db.commit()
            except Exception:
                db.rollback()
        
        return AutoClockOutResult(
            start_time=start_time,
            end_time=end_time,
            businesses_processed=businesses_processed,
            employees_auto_clocked_out=employees_auto_clocked_out,
            errors=errors
        )
    
    finally:
        # Always close the database session
        db.close()
