"""
Unit tests for RunawayGuard.

Tests that:
- Steps are counted and limits enforced
- Token budget is enforced
- Graceful result is returned (no exceptions thrown)
- Progress summary is included in stop result
"""

import pytest
from app.agents.lib.runaway_guard import RunawayGuard, GuardResult
from app.agents.constants import Limits


def test_normal_step_increments_counter():
    guard = RunawayGuard(max_steps=5)
    result = guard.record_step("Fetched sales data", tokens_used=100)
    assert result.stopped is False
    assert result.steps_completed == 1
    assert result.tokens_used == 100


def test_multiple_steps_accumulate():
    guard = RunawayGuard(max_steps=10)
    for i in range(3):
        result = guard.record_step(f"Step {i}", tokens_used=200)
    assert result.stopped is False
    assert result.steps_completed == 3
    assert result.tokens_used == 600


def test_step_limit_triggers_graceful_stop():
    guard = RunawayGuard(max_steps=3)
    for _ in range(2):
        guard.record_step("Step", tokens_used=10)
    # Third step hits the limit
    result = guard.record_step("Final step", tokens_used=10)
    assert result.stopped is True
    assert "3" in result.reason or "step" in result.reason.lower()
    # Partial summary should list what completed
    assert "Step" in result.partial_summary


def test_stop_result_includes_partial_summary():
    guard = RunawayGuard(max_steps=2)
    guard.record_step("Fetched orders", tokens_used=50)
    result = guard.record_step("Analysed data", tokens_used=50)
    assert result.stopped is True
    assert "Fetched orders" in result.partial_summary
    assert "Analysed data" in result.partial_summary


def test_token_budget_triggers_graceful_stop():
    guard = RunawayGuard(max_steps=100, max_tokens=500)
    guard.record_step("Step 1", tokens_used=300)
    result = guard.record_step("Step 2", tokens_used=250)  # total = 550 > 500
    assert result.stopped is True
    assert "token" in result.reason.lower()


def test_no_exception_is_raised_on_limit():
    """RunawayGuard must never raise — it returns a GuardResult."""
    guard = RunawayGuard(max_steps=1)
    result = guard.record_step("Only step", tokens_used=100)
    # Should not raise, should return stopped result
    assert isinstance(result, GuardResult)
    assert result.stopped is True


def test_guard_result_is_dataclass():
    result = GuardResult(stopped=False, steps_completed=1)
    assert result.stopped is False
    assert result.steps_completed == 1
    assert result.partial_summary == ""


def test_below_limit_result_has_correct_fields():
    guard = RunawayGuard(max_steps=10, max_tokens=10000)
    result = guard.record_step("Step", tokens_used=200)
    assert result.stopped is False
    assert result.steps_completed == 1
    assert result.tokens_used == 200
    assert result.reason == ""
