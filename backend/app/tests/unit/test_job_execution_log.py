"""Unit tests for JobExecutionLog model."""

from datetime import datetime, timedelta
from app.models.job_execution_log import JobExecutionLog, JobStatus


def test_job_execution_log_creation():
    """Test creating a job execution log."""
    log = JobExecutionLog(
        job_name="test_job",
        start_time=datetime.utcnow(),
        status=JobStatus.RUNNING.value,
        invoices_processed=0,
        notifications_created=0,
        error_count=0
    )
    
    assert log.job_name == "test_job"
    assert log.status == JobStatus.RUNNING.value
    assert log.invoices_processed == 0
    assert log.notifications_created == 0
    assert log.error_count == 0


def test_job_execution_log_duration():
    """Test duration calculation."""
    start = datetime.utcnow()
    end = start + timedelta(seconds=30)
    
    log = JobExecutionLog(
        job_name="test_job",
        start_time=start,
        end_time=end,
        status=JobStatus.COMPLETED.value
    )
    
    assert log.duration_seconds == 30.0


def test_job_execution_log_duration_no_end():
    """Test duration when job hasn't ended."""
    log = JobExecutionLog(
        job_name="test_job",
        start_time=datetime.utcnow(),
        status=JobStatus.RUNNING.value
    )
    
    assert log.duration_seconds == 0.0


def test_job_execution_log_with_errors():
    """Test log with error details."""
    log = JobExecutionLog(
        job_name="test_job",
        start_time=datetime.utcnow(),
        status=JobStatus.FAILED.value,
        error_count=3,
        error_details="Error 1\nError 2\nError 3"
    )
    
    assert log.status == JobStatus.FAILED.value
    assert log.error_count == 3
    assert "Error 1" in log.error_details


def test_job_execution_log_repr():
    """Test string representation."""
    log = JobExecutionLog(
        job_name="test_job",
        start_time=datetime.utcnow(),
        status=JobStatus.COMPLETED.value
    )
    
    repr_str = repr(log)
    assert "JobExecutionLog" in repr_str
    assert "test_job" in repr_str
    assert "completed" in repr_str
