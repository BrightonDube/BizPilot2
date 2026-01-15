"""Unit tests for scheduler configuration."""

import os
import pytest
from unittest.mock import patch

from app.scheduler.config import SchedulerConfig


class TestInvalidConfigurationHandling:
    """Test invalid configuration handling - Property 13."""
    
    def test_invalid_schedule_type_uses_default(self):
        """
        When schedule type is invalid, should use default cron schedule.
        Validates: Requirements 6.4
        """
        env_vars = {
            "OVERDUE_INVOICE_SCHEDULE_TYPE": "invalid_type",
            "OVERDUE_INVOICE_SCHEDULE_VALUE": "some_value",
        }
        
        with patch.dict(os.environ, env_vars, clear=False):
            config = SchedulerConfig.from_env()
            
            # Should fall back to default cron schedule
            assert config.schedule_type == "cron"
            assert config.schedule_value == "0 0 * * *"
    
    def test_invalid_cron_expression_uses_default(self):
        """
        When cron expression is invalid, should use default.
        Validates: Requirements 6.4
        """
        env_vars = {
            "OVERDUE_INVOICE_SCHEDULE_TYPE": "cron",
            "OVERDUE_INVOICE_SCHEDULE_VALUE": "invalid cron",  # Not enough fields
        }
        
        with patch.dict(os.environ, env_vars, clear=False):
            config = SchedulerConfig.from_env()
            
            # Should fall back to default cron expression
            assert config.schedule_type == "cron"
            assert config.schedule_value == "0 0 * * *"
    
    def test_invalid_interval_hours_uses_default(self):
        """
        When interval hours is invalid, should use default cron schedule.
        Validates: Requirements 6.4
        """
        env_vars = {
            "OVERDUE_INVOICE_SCHEDULE_TYPE": "interval",
            "OVERDUE_INVOICE_SCHEDULE_VALUE": "not_a_number",
        }
        
        with patch.dict(os.environ, env_vars, clear=False):
            config = SchedulerConfig.from_env()
            
            # Should fall back to default cron schedule
            assert config.schedule_type == "cron"
            assert config.schedule_value == "0 0 * * *"
    
    def test_negative_interval_hours_uses_default(self):
        """
        When interval hours is negative, should use default cron schedule.
        Validates: Requirements 6.4
        """
        env_vars = {
            "OVERDUE_INVOICE_SCHEDULE_TYPE": "interval",
            "OVERDUE_INVOICE_SCHEDULE_VALUE": "-5",
        }
        
        with patch.dict(os.environ, env_vars, clear=False):
            config = SchedulerConfig.from_env()
            
            # Should fall back to default cron schedule
            assert config.schedule_type == "cron"
            assert config.schedule_value == "0 0 * * *"
    
    def test_zero_interval_hours_uses_default(self):
        """
        When interval hours is zero, should use default cron schedule.
        Validates: Requirements 6.4
        """
        env_vars = {
            "OVERDUE_INVOICE_SCHEDULE_TYPE": "interval",
            "OVERDUE_INVOICE_SCHEDULE_VALUE": "0",
        }
        
        with patch.dict(os.environ, env_vars, clear=False):
            config = SchedulerConfig.from_env()
            
            # Should fall back to default cron schedule
            assert config.schedule_type == "cron"
            assert config.schedule_value == "0 0 * * *"
    
    def test_invalid_batch_size_uses_default(self):
        """
        When batch size is invalid, should use default value of 100.
        Validates: Requirements 6.4
        """
        env_vars = {
            "OVERDUE_INVOICE_BATCH_SIZE": "not_a_number",
        }
        
        with patch.dict(os.environ, env_vars, clear=False):
            config = SchedulerConfig.from_env()
            
            # Should use default batch size
            assert config.batch_size == 100
    
    def test_negative_batch_size_uses_default(self):
        """
        When batch size is negative, should use default value of 100.
        Validates: Requirements 6.4
        """
        env_vars = {
            "OVERDUE_INVOICE_BATCH_SIZE": "-50",
        }
        
        with patch.dict(os.environ, env_vars, clear=False):
            config = SchedulerConfig.from_env()
            
            # Should use default batch size
            assert config.batch_size == 100
    
    def test_zero_batch_size_uses_default(self):
        """
        When batch size is zero, should use default value of 100.
        Validates: Requirements 6.4
        """
        env_vars = {
            "OVERDUE_INVOICE_BATCH_SIZE": "0",
        }
        
        with patch.dict(os.environ, env_vars, clear=False):
            config = SchedulerConfig.from_env()
            
            # Should use default batch size
            assert config.batch_size == 100


class TestDefaultConfiguration:
    """Test default configuration behavior."""
    
    def test_default_configuration_values(self):
        """Test that default configuration has expected values."""
        config = SchedulerConfig.default()
        
        assert config.schedule_type == "cron"
        assert config.schedule_value == "0 0 * * *"
        assert config.batch_size == 100
        assert config.timezone == "UTC"
    
    def test_no_env_vars_uses_defaults(self):
        """When no environment variables are set, should use defaults."""
        # Clear relevant env vars
        env_vars = {
            "OVERDUE_INVOICE_SCHEDULE_TYPE": None,
            "OVERDUE_INVOICE_SCHEDULE_VALUE": None,
            "OVERDUE_INVOICE_BATCH_SIZE": None,
            "OVERDUE_INVOICE_TIMEZONE": None,
        }
        
        with patch.dict(os.environ, {}, clear=True):
            config = SchedulerConfig.from_env()
            
            assert config.schedule_type == "cron"
            assert config.schedule_value == "0 0 * * *"
            assert config.batch_size == 100
            assert config.timezone == "UTC"


class TestConfigurationValidation:
    """Test configuration validation."""
    
    def test_valid_cron_configuration(self):
        """Test that valid cron configuration passes validation."""
        config = SchedulerConfig(
            schedule_type="cron",
            schedule_value="0 0 * * *",
            batch_size=100,
            timezone="UTC",
        )
        
        assert config.validate() is True
    
    def test_valid_interval_configuration(self):
        """Test that valid interval configuration passes validation."""
        config = SchedulerConfig(
            schedule_type="interval",
            schedule_value="24",
            batch_size=100,
            timezone="UTC",
        )
        
        assert config.validate() is True
    
    def test_invalid_schedule_type_fails_validation(self):
        """Test that invalid schedule type fails validation."""
        config = SchedulerConfig(
            schedule_type="invalid",
            schedule_value="0 0 * * *",
            batch_size=100,
            timezone="UTC",
        )
        
        assert config.validate() is False
    
    def test_invalid_batch_size_fails_validation(self):
        """Test that invalid batch size fails validation."""
        config = SchedulerConfig(
            schedule_type="cron",
            schedule_value="0 0 * * *",
            batch_size=0,
            timezone="UTC",
        )
        
        assert config.validate() is False
    
    def test_invalid_cron_expression_fails_validation(self):
        """Test that invalid cron expression fails validation."""
        config = SchedulerConfig(
            schedule_type="cron",
            schedule_value="invalid",
            batch_size=100,
            timezone="UTC",
        )
        
        assert config.validate() is False
    
    def test_invalid_interval_value_fails_validation(self):
        """Test that invalid interval value fails validation."""
        config = SchedulerConfig(
            schedule_type="interval",
            schedule_value="not_a_number",
            batch_size=100,
            timezone="UTC",
        )
        
        assert config.validate() is False
