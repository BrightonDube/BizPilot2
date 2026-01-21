"""Unit tests for scheduler manager."""

import pytest

from app.scheduler.manager import SchedulerManager
from app.scheduler.config import SchedulerConfig


class TestSchedulerManagerLifecycle:
    """Test scheduler manager lifecycle operations."""
    
    def test_scheduler_initialization(self):
        """Test that scheduler initializes correctly."""
        config = SchedulerConfig.default()
        manager = SchedulerManager(config)
        
        assert manager.scheduler is not None
        assert manager.is_running() is False
        assert manager.config == config
    
    def test_scheduler_starts_successfully(self):
        """Test that scheduler starts correctly."""
        config = SchedulerConfig.default()
        manager = SchedulerManager(config)
        
        manager.start()
        
        assert manager.is_running() is True
        
        # Cleanup
        manager.shutdown()
    
    def test_scheduler_shutdown_successfully(self):
        """Test that scheduler shuts down correctly."""
        config = SchedulerConfig.default()
        manager = SchedulerManager(config)
        
        manager.start()
        assert manager.is_running() is True
        
        manager.shutdown()
        assert manager.is_running() is False
    
    def test_scheduler_start_when_already_running(self):
        """Test that starting an already running scheduler is handled gracefully."""
        config = SchedulerConfig.default()
        manager = SchedulerManager(config)
        
        manager.start()
        assert manager.is_running() is True
        
        # Try to start again - should not raise error
        manager.start()
        assert manager.is_running() is True
        
        # Cleanup
        manager.shutdown()
    
    def test_scheduler_shutdown_when_not_running(self):
        """Test that shutting down a non-running scheduler is handled gracefully."""
        config = SchedulerConfig.default()
        manager = SchedulerManager(config)
        
        # Shutdown without starting - should not raise error
        manager.shutdown()
        assert manager.is_running() is False


class TestJobRegistration:
    """Test job registration functionality."""
    
    def test_add_cron_job(self):
        """Test adding a job with cron trigger."""
        config = SchedulerConfig.default()
        manager = SchedulerManager(config)
        
        def dummy_job():
            pass
        
        manager.add_job(
            dummy_job,
            trigger='cron',
            cron_expression='0 0 * * *',
            job_id='test_job'
        )
        
        jobs = manager.get_jobs()
        assert len(jobs) == 1
        assert jobs[0].id == 'test_job'
        
        # Cleanup
        manager.shutdown()
    
    def test_add_interval_job(self):
        """Test adding a job with interval trigger."""
        config = SchedulerConfig.default()
        manager = SchedulerManager(config)
        
        def dummy_job():
            pass
        
        manager.add_job(
            dummy_job,
            trigger='interval',
            hours=24,
            job_id='test_interval_job'
        )
        
        jobs = manager.get_jobs()
        assert len(jobs) == 1
        assert jobs[0].id == 'test_interval_job'
        
        # Cleanup
        manager.shutdown()
    
    def test_add_job_with_invalid_trigger(self):
        """Test that adding a job with invalid trigger raises error."""
        config = SchedulerConfig.default()
        manager = SchedulerManager(config)
        
        def dummy_job():
            pass
        
        with pytest.raises(ValueError, match="Unsupported trigger type"):
            manager.add_job(
                dummy_job,
                trigger='invalid_trigger',
                job_id='test_job'
            )
        
        # Cleanup
        manager.shutdown()
    
    def test_add_job_with_invalid_cron_expression(self):
        """Test that adding a job with invalid cron expression raises error."""
        config = SchedulerConfig.default()
        manager = SchedulerManager(config)
        
        def dummy_job():
            pass
        
        with pytest.raises(ValueError, match="Invalid cron expression"):
            manager.add_job(
                dummy_job,
                trigger='cron',
                cron_expression='invalid',
                job_id='test_job'
            )
        
        # Cleanup
        manager.shutdown()
    
    def test_replace_existing_job(self):
        """Test that adding a job with same ID replaces the existing one."""
        config = SchedulerConfig.default()
        manager = SchedulerManager(config)
        
        def dummy_job_1():
            pass
        
        def dummy_job_2():
            pass
        
        # Start scheduler first for replace_existing to work properly
        manager.start()
        
        # Add first job
        manager.add_job(
            dummy_job_1,
            trigger='cron',
            cron_expression='0 0 * * *',
            job_id='test_job'
        )
        
        # Add second job with same ID
        manager.add_job(
            dummy_job_2,
            trigger='cron',
            cron_expression='0 12 * * *',
            job_id='test_job'
        )
        
        jobs = manager.get_jobs()
        assert len(jobs) == 1  # Should only have one job
        assert jobs[0].id == 'test_job'
        
        # Cleanup
        manager.shutdown()
    
    def test_get_jobs_when_no_jobs_registered(self):
        """Test getting jobs when none are registered."""
        config = SchedulerConfig.default()
        manager = SchedulerManager(config)
        
        jobs = manager.get_jobs()
        assert len(jobs) == 0
        
        # Cleanup
        manager.shutdown()


class TestSchedulerConfiguration:
    """Test scheduler configuration handling."""
    
    def test_scheduler_uses_configured_timezone(self):
        """Test that scheduler uses the configured timezone."""
        config = SchedulerConfig(
            schedule_type="cron",
            schedule_value="0 0 * * *",
            batch_size=100,
            timezone="America/New_York"
        )
        manager = SchedulerManager(config)
        
        assert manager.scheduler.timezone.zone == "America/New_York"
        
        # Cleanup
        manager.shutdown()
    
    def test_scheduler_job_defaults(self):
        """Test that scheduler has correct job defaults."""
        config = SchedulerConfig.default()
        manager = SchedulerManager(config)
        
        # Check job defaults are set
        assert manager.scheduler._job_defaults['coalesce'] is True
        assert manager.scheduler._job_defaults['max_instances'] == 1
        assert manager.scheduler._job_defaults['misfire_grace_time'] == 300
        
        # Cleanup
        manager.shutdown()
