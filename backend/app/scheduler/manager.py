"""Scheduler manager for managing APScheduler instance."""

import logging
from typing import Callable, Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.executors.pool import ThreadPoolExecutor

from app.scheduler.config import SchedulerConfig

logger = logging.getLogger(__name__)


class SchedulerManager:
    """Manager for APScheduler instance and job registration."""
    
    def __init__(self, config: SchedulerConfig):
        """
        Initialize scheduler with configuration.
        
        Args:
            config: Scheduler configuration
        """
        self.config = config
        self.scheduler: Optional[BackgroundScheduler] = None
        self._is_running = False
        
        # Configure job stores and executors
        jobstores = {
            'default': MemoryJobStore()
        }
        
        executors = {
            'default': ThreadPoolExecutor(max_workers=5)
        }
        
        job_defaults = {
            'coalesce': True,  # Combine multiple pending executions into one
            'max_instances': 1,  # Only one instance of each job at a time
            'misfire_grace_time': 300  # 5 minutes grace time for misfired jobs
        }
        
        # Initialize scheduler
        self.scheduler = BackgroundScheduler(
            jobstores=jobstores,
            executors=executors,
            job_defaults=job_defaults,
            timezone=self.config.timezone
        )
        
        logger.info(f"Scheduler initialized with timezone: {self.config.timezone}")
    
    def start(self) -> None:
        """Start the scheduler."""
        if self.scheduler and not self._is_running:
            try:
                self.scheduler.start()
                self._is_running = True
                logger.info("Scheduler started successfully")
            except Exception as e:
                logger.error(f"Failed to start scheduler: {e}")
                raise
        else:
            logger.warning("Scheduler already running or not initialized")
    
    def shutdown(self, wait: bool = True) -> None:
        """
        Gracefully shutdown the scheduler.
        
        Args:
            wait: Whether to wait for running jobs to complete
        """
        if self.scheduler and self._is_running:
            try:
                self.scheduler.shutdown(wait=wait)
                self._is_running = False
                logger.info("Scheduler shutdown successfully")
            except Exception as e:
                logger.error(f"Error during scheduler shutdown: {e}")
                raise
        else:
            logger.warning("Scheduler not running or not initialized")
    
    def add_job(
        self,
        func: Callable,
        trigger: str,
        **trigger_args
    ) -> None:
        """
        Register a job with the scheduler.
        
        Args:
            func: The function to execute
            trigger: Trigger type ('cron' or 'interval')
            **trigger_args: Arguments for the trigger
        """
        if not self.scheduler:
            logger.error("Scheduler not initialized")
            raise RuntimeError("Scheduler not initialized")
        
        try:
            if trigger == 'cron':
                # Parse cron expression
                cron_parts = trigger_args.get('cron_expression', '0 0 * * *').split()
                if len(cron_parts) == 5:
                    minute, hour, day, month, day_of_week = cron_parts
                    trigger_obj = CronTrigger(
                        minute=minute,
                        hour=hour,
                        day=day,
                        month=month,
                        day_of_week=day_of_week,
                        timezone=self.config.timezone
                    )
                elif len(cron_parts) == 6:
                    second, minute, hour, day, month, day_of_week = cron_parts
                    trigger_obj = CronTrigger(
                        second=second,
                        minute=minute,
                        hour=hour,
                        day=day,
                        month=month,
                        day_of_week=day_of_week,
                        timezone=self.config.timezone
                    )
                else:
                    raise ValueError(f"Invalid cron expression: {trigger_args.get('cron_expression')}")
            
            elif trigger == 'interval':
                hours = trigger_args.get('hours', 24)
                trigger_obj = IntervalTrigger(
                    hours=hours,
                    timezone=self.config.timezone
                )
            
            else:
                raise ValueError(f"Unsupported trigger type: {trigger}")
            
            # Add job to scheduler
            job_id = trigger_args.get('job_id', func.__name__)
            self.scheduler.add_job(
                func,
                trigger=trigger_obj,
                id=job_id,
                name=trigger_args.get('name', func.__name__),
                replace_existing=True
            )
            
            logger.info(f"Job '{job_id}' registered with {trigger} trigger")
        
        except Exception as e:
            logger.error(f"Failed to add job: {e}")
            raise
    
    def is_running(self) -> bool:
        """Check if scheduler is running."""
        return self._is_running
    
    def get_jobs(self) -> list:
        """Get list of registered jobs."""
        if self.scheduler:
            return self.scheduler.get_jobs()
        return []
