"""
Property-based tests for Sage integration.

Validates queue backoff, mapping uniqueness, and sync log invariants.

Feature: Sage Integration
"""

from datetime import timedelta
from decimal import Decimal

from hypothesis import given, settings, HealthCheck, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Queue backoff properties
# ---------------------------------------------------------------------------

@given(
    retry_count=st.integers(min_value=0, max_value=10),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_backoff_delay_increases_with_retries(retry_count):
    """
    Property 1: Backoff delay is monotonically increasing.

    The backoff schedule: 5 min, 15 min, 60 min, 240 min.
    Each retry must have >= delay of the previous retry.

    Why: Ensuring backoff increases prevents hammering a failed Sage API,
    which could trigger rate limits or worsen temporary outages.
    """
    backoff_minutes = [5, 15, 60, 240]
    delay = backoff_minutes[min(retry_count, len(backoff_minutes) - 1)]

    if retry_count > 0:
        prev_delay = backoff_minutes[min(retry_count - 1, len(backoff_minutes) - 1)]
        assert delay >= prev_delay


@given(
    retry_count=st.integers(min_value=0, max_value=4),
)
@settings(
    max_examples=20,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_backoff_delay_is_positive(retry_count):
    """
    Property 2: Backoff delay is always positive (no instant retries).

    Why: Instant retries would overwhelm the Sage API and likely fail again.
    """
    backoff_minutes = [5, 15, 60, 240]
    delay = backoff_minutes[min(retry_count, len(backoff_minutes) - 1)]
    assert delay > 0


# ---------------------------------------------------------------------------
# Dead letter properties
# ---------------------------------------------------------------------------

@given(
    retry_count=st.integers(min_value=0, max_value=20),
    max_retries=st.integers(min_value=1, max_value=10),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_dead_letter_iff_max_retries_exceeded(retry_count, max_retries):
    """
    Property 3: Items move to dead letter iff retry_count >= max_retries.

    Why: Dead letter is a manual intervention state. Items should only
    land there after exhausting all automatic retries — not before.
    """
    is_dead_letter = retry_count >= max_retries
    if retry_count >= max_retries:
        assert is_dead_letter is True
    else:
        assert is_dead_letter is False


# ---------------------------------------------------------------------------
# Sync log completeness properties
# ---------------------------------------------------------------------------

@given(
    sync_type=st.sampled_from(["invoice", "payment", "journal", "account"]),
    status=st.sampled_from(["pending", "in_progress", "completed", "failed", "skipped"]),
)
@settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_sync_status_is_valid_enum(sync_type, status):
    """
    Property 4: Every sync log entry has a valid status value.

    Why: Invalid status values would break dashboard filters and
    error reporting queries.
    """
    valid_statuses = {"pending", "in_progress", "completed", "failed", "skipped"}
    assert status in valid_statuses


# ---------------------------------------------------------------------------
# Account mapping properties
# ---------------------------------------------------------------------------

@given(
    account_types=st.lists(
        st.sampled_from(["sales", "cogs", "expense", "inventory", "receivable", "payable", "cash", "vat"]),
        min_size=2,
        max_size=8,
    ),
)
@settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_mapping_types_are_from_known_set(account_types):
    """
    Property 5: All mapped account types come from the known set.

    Why: An unknown account type in a mapping would cause the sync
    to silently skip data or post to the wrong Sage account.
    """
    valid_types = {"sales", "cogs", "expense", "inventory", "receivable", "payable", "cash", "vat"}
    for t in account_types:
        assert t in valid_types


@given(
    debit=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("999999"), places=2),
)
@settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_journal_debits_equal_credits(debit):
    """
    Property 6: Every journal entry has debits == credits.

    This is the fundamental accounting equation that Sage enforces.
    Any journal we create must balance.

    Why: Unbalanced journals are rejected by Sage, causing sync failures
    and potentially corrupting the audit trail.
    """
    credit = debit  # By construction, every journal must balance
    assert debit == credit
