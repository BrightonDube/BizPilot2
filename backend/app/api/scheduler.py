"""Scheduler monitoring API endpoints."""

from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc

from app.api.deps import get_current_user
from app.core.database import get_sync_db
from app.models.user import User
from app.models.job_execution_log import JobExecutionLog, JobStatus

router = APIRouter()


def get_scheduler_manager():
    """Get the global scheduler manager instance."""
    from app.main import scheduler_manager
    return scheduler_manager


@router.get("/status")
def get_scheduler_status(
    current_user: User = Depends(get_current_user),
    db=Depends(get_sync_db)
):
    """
    Get scheduler status and last execution details.
    
    Returns:
    - Scheduler running status
    - Last job execution details
    - Next scheduled execution time (if available)
    
    Requirements: 5.1, 5.2
    """
    # Check if scheduler is running
    is_running = False
    next_run_time = None
    
    scheduler_manager = get_scheduler_manager()
    if scheduler_manager and scheduler_manager.is_running():
        is_running = True
        
        # Get next run time for the overdue invoice job
        jobs = scheduler_manager.get_jobs()
        for job in jobs:
            if job.id == 'check_overdue_invoices':
                next_run_time = job.next_run_time
                break
    
    # Get last job execution from database
    last_execution = db.query(JobExecutionLog).filter(
        JobExecutionLog.job_name == "check_overdue_invoices"
    ).order_by(desc(JobExecutionLog.start_time)).first()
    
    last_execution_data = None
    if last_execution:
        duration = None
        if last_execution.end_time and last_execution.start_time:
            duration = (last_execution.end_time - last_execution.start_time).total_seconds()
        
        last_execution_data = {
            "id": last_execution.id,
            "start_time": last_execution.start_time.isoformat() if last_execution.start_time else None,
            "end_time": last_execution.end_time.isoformat() if last_execution.end_time else None,
            "duration_seconds": duration,
            "status": last_execution.status.value if last_execution.status else None,
            "invoices_processed": last_execution.invoices_processed,
            "notifications_created": last_execution.notifications_created,
            "error_count": last_execution.error_count,
            "has_errors": last_execution.error_count > 0 if last_execution.error_count else False,
        }
    
    return {
        "scheduler_running": is_running,
        "next_run_time": next_run_time.isoformat() if next_run_time else None,
        "last_execution": last_execution_data,
    }


@router.get("/executions")
def get_job_executions(
    status: Optional[JobStatus] = Query(None, description="Filter by job status"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date (from)"),
    end_date: Optional[datetime] = Query(None, description="Filter by start date (to)"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db=Depends(get_sync_db)
):
    """
    Get paginated list of job execution history.
    
    Supports filtering by:
    - Status (RUNNING, COMPLETED, FAILED)
    - Date range
    
    Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
    """
    # Build query
    query = db.query(JobExecutionLog).filter(
        JobExecutionLog.job_name == "check_overdue_invoices"
    )
    
    # Apply filters
    if status:
        query = query.filter(JobExecutionLog.status == status)
    
    if start_date:
        query = query.filter(JobExecutionLog.start_time >= start_date)
    
    if end_date:
        query = query.filter(JobExecutionLog.start_time <= end_date)
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    query = query.order_by(desc(JobExecutionLog.start_time))
    query = query.offset((page - 1) * per_page).limit(per_page)
    
    # Execute query
    executions = query.all()
    
    # Format results
    results = []
    for execution in executions:
        duration = None
        if execution.end_time and execution.start_time:
            duration = (execution.end_time - execution.start_time).total_seconds()
        
        results.append({
            "id": execution.id,
            "job_name": execution.job_name,
            "start_time": execution.start_time.isoformat() if execution.start_time else None,
            "end_time": execution.end_time.isoformat() if execution.end_time else None,
            "duration_seconds": duration,
            "status": execution.status.value if execution.status else None,
            "invoices_processed": execution.invoices_processed,
            "notifications_created": execution.notifications_created,
            "error_count": execution.error_count,
            "error_details": execution.error_details,
        })
    
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
        "executions": results,
    }


@router.get("/executions/{execution_id}")
def get_job_execution_details(
    execution_id: int,
    current_user: User = Depends(get_current_user),
    db=Depends(get_sync_db)
):
    """
    Get detailed information about a specific job execution.
    
    Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
    """
    execution = db.query(JobExecutionLog).filter(
        JobExecutionLog.id == execution_id,
        JobExecutionLog.job_name == "check_overdue_invoices"
    ).first()
    
    if not execution:
        return {"error": "Execution not found"}, 404
    
    duration = None
    if execution.end_time and execution.start_time:
        duration = (execution.end_time - execution.start_time).total_seconds()
    
    return {
        "id": execution.id,
        "job_name": execution.job_name,
        "start_time": execution.start_time.isoformat() if execution.start_time else None,
        "end_time": execution.end_time.isoformat() if execution.end_time else None,
        "duration_seconds": duration,
        "status": execution.status.value if execution.status else None,
        "invoices_processed": execution.invoices_processed,
        "notifications_created": execution.notifications_created,
        "error_count": execution.error_count,
        "error_details": execution.error_details,
    }
