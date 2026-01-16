"""Job execution log models."""

import enum
from sqlalchemy import Column, String, Integer, Text, DateTime
from datetime import datetime

from app.models.base import BaseModel


class JobStatus(str, enum.Enum):
    """Job execution status."""
    
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class JobExecutionLog(BaseModel):
    """Log record for each job execution."""
    
    __tablename__ = "job_execution_logs"
    
    job_name = Column(String(100), nullable=False, index=True)
    start_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    status = Column(String(20), default=JobStatus.RUNNING.value, nullable=False)
    invoices_processed = Column(Integer, default=0, nullable=False)
    notifications_created = Column(Integer, default=0, nullable=False)
    error_count = Column(Integer, default=0, nullable=False)
    error_details = Column(Text, nullable=True)
    
    def __repr__(self) -> str:
        return f"<JobExecutionLog {self.job_name} {self.status}>"
    
    @property
    def duration_seconds(self) -> float:
        """Calculate job duration in seconds."""
        if self.end_time and self.start_time:
            delta = self.end_time - self.start_time
            return delta.total_seconds()
        return 0.0
