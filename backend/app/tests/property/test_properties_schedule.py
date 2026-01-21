"""Property-based tests for scheduler configuration."""

import os
from hypothesis import given, strategies as st, settings
from unittest.mock import patch

from app.scheduler.config import SchedulerConfig


# Feature: overdue-invoice-scheduler, Property 2: Configuration Application
@given(
    schedule_type=st.sampled_from(["cron", "interval"]),
    cron_expr=st.sampled_from([
        "0 0 * * *",  # Daily at midnight
        "0 */6 * * *",  # Every 6 hours
        "30 2 * * *",  # Daily at 2:30 AM
        "0 0 * * 0",  # Weekly on Sunday
        "0 12 1 * *",  # Monthly on 1st at noon
    ]),
    interval_hours=st.integers(min_value=1, max_value=168),  # 1 hour to 1 week
    batch_size=st.integers(min_value=1, max_value=1000),
    timezone=st.sampled_from(["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"]),
)
@settings(max_examples=20)
def test_configuration_application(
    schedule_type, cron_expr, interval_hours, batch_size, timezone
):
    """
    Property: For any valid schedule configuration (cron expression or hour interval),
    the scheduler should parse and apply that configuration correctly, using the
    specified schedule for job execution.
    
    Validates: Requirements 1.4, 6.1, 6.2, 6.3
    """
    # Setup: Set environment variables based on schedule type
    if schedule_type == "cron":
        schedule_value = cron_expr
    else:
        schedule_value = str(interval_hours)
    
    env_vars = {
        "OVERDUE_INVOICE_SCHEDULE_TYPE": schedule_type,
        "OVERDUE_INVOICE_SCHEDULE_VALUE": schedule_value,
        "OVERDUE_INVOICE_BATCH_SIZE": str(batch_size),
        "OVERDUE_INVOICE_TIMEZONE": timezone,
    }
    
    with patch.dict(os.environ, env_vars, clear=False):
        # Execute: Load configuration from environment
        config = SchedulerConfig.from_env()
        
        # Verify: Configuration matches what was set
        assert config.schedule_type == schedule_type
        assert config.schedule_value == schedule_value
        assert config.batch_size == batch_size
        assert config.timezone == timezone
        
        # Verify: Configuration is valid
        assert config.validate() is True


@given(
    schedule_type=st.sampled_from(["cron", "interval"]),
    cron_expr=st.sampled_from([
        "0 0 * * *",
        "0 */6 * * *",
        "30 2 * * *",
    ]),
    interval_hours=st.integers(min_value=1, max_value=168),
)
@settings(max_examples=10)
def test_configuration_persistence(schedule_type, cron_expr, interval_hours):
    """
    Property: Configuration loaded from environment should remain consistent
    across multiple reads.
    """
    schedule_value = cron_expr if schedule_type == "cron" else str(interval_hours)
    
    env_vars = {
        "OVERDUE_INVOICE_SCHEDULE_TYPE": schedule_type,
        "OVERDUE_INVOICE_SCHEDULE_VALUE": schedule_value,
    }
    
    with patch.dict(os.environ, env_vars, clear=False):
        # Load configuration twice
        config1 = SchedulerConfig.from_env()
        config2 = SchedulerConfig.from_env()
        
        # Verify: Both configs are identical
        assert config1.schedule_type == config2.schedule_type
        assert config1.schedule_value == config2.schedule_value
        assert config1.batch_size == config2.batch_size
        assert config1.timezone == config2.timezone
