"""Scheduler configuration module."""

import os
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class SchedulerConfig:
    """Configuration for the scheduler."""
    
    schedule_type: str  # "cron" or "interval"
    schedule_value: str  # cron expression or interval hours
    batch_size: int  # number of invoices to process per batch
    timezone: str  # timezone for schedule execution
    
    @classmethod
    def from_env(cls) -> "SchedulerConfig":
        """Load configuration from environment variables."""
        schedule_type = os.getenv("OVERDUE_INVOICE_SCHEDULE_TYPE", "cron")
        schedule_value = os.getenv("OVERDUE_INVOICE_SCHEDULE_VALUE", "0 0 * * *")
        batch_size_str = os.getenv("OVERDUE_INVOICE_BATCH_SIZE", "100")
        timezone = os.getenv("OVERDUE_INVOICE_TIMEZONE", "UTC")
        
        # Validate and convert batch_size
        try:
            batch_size = int(batch_size_str)
            if batch_size <= 0:
                logger.error(f"Invalid batch size: {batch_size}. Using default: 100")
                batch_size = 100
        except ValueError:
            logger.error(f"Invalid batch size format: {batch_size_str}. Using default: 100")
            batch_size = 100
        
        # Validate schedule_type
        if schedule_type not in ["cron", "interval"]:
            logger.error(f"Invalid schedule type: {schedule_type}. Using default: cron")
            schedule_type = "cron"
            schedule_value = "0 0 * * *"
        
        # Validate schedule_value based on type
        if schedule_type == "interval":
            try:
                hours = int(schedule_value)
                if hours <= 0:
                    logger.error(f"Invalid interval hours: {hours}. Using default: daily")
                    schedule_type = "cron"
                    schedule_value = "0 0 * * *"
            except ValueError:
                logger.error(f"Invalid interval format: {schedule_value}. Using default: daily")
                schedule_type = "cron"
                schedule_value = "0 0 * * *"
        elif schedule_type == "cron":
            # Basic validation for cron expression (5 or 6 fields)
            parts = schedule_value.split()
            if len(parts) not in [5, 6]:
                logger.error(f"Invalid cron expression: {schedule_value}. Using default: 0 0 * * *")
                schedule_value = "0 0 * * *"
        
        return cls(
            schedule_type=schedule_type,
            schedule_value=schedule_value,
            batch_size=batch_size,
            timezone=timezone,
        )
    
    @classmethod
    def default(cls) -> "SchedulerConfig":
        """Return default configuration."""
        return cls(
            schedule_type="cron",
            schedule_value="0 0 * * *",  # Daily at midnight UTC
            batch_size=100,
            timezone="UTC",
        )
    
    def validate(self) -> bool:
        """Validate configuration values."""
        if self.schedule_type not in ["cron", "interval"]:
            return False
        
        if self.batch_size <= 0:
            return False
        
        if self.schedule_type == "interval":
            try:
                hours = int(self.schedule_value)
                if hours <= 0:
                    return False
            except ValueError:
                return False
        elif self.schedule_type == "cron":
            parts = self.schedule_value.split()
            if len(parts) not in [5, 6]:
                return False
        
        return True
