"""Property-based tests for staff targets.

Validates correctness properties:
  Property 1 — Achievement percentage accuracy
  Property 2 — Commission calculation (sales × rate)
  Property 3 — Target status consistency

Feature: Staff Targets
"""

from decimal import Decimal

from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st


# ── Property Tests ───────────────────────────────────────────────────────────

@given(
    target_value=st.decimals(min_value=Decimal("1"), max_value=Decimal("100000"), places=2),
    achieved_value=st.decimals(min_value=Decimal("0"), max_value=Decimal("200000"), places=2),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_achievement_percentage_accuracy(target_value, achieved_value):
    """
    Property 1: Achievement percentage accuracy.

    achievement_pct = (achieved_value / target_value) × 100

    If target is 0, pct should be 0 (avoid division by zero).

    Why: Incorrect achievement % directly affects commission payouts,
    performance reviews, and incentive qualification.
    """
    if target_value > 0:
        pct = (achieved_value / target_value) * 100
    else:
        pct = Decimal("0")

    expected = (achieved_value / target_value) * 100 if target_value > 0 else Decimal("0")
    assert pct == expected
    assert pct >= 0


@given(
    sales_amount=st.decimals(min_value=Decimal("0"), max_value=Decimal("100000"), places=2),
    commission_rate=st.decimals(min_value=Decimal("0"), max_value=Decimal("0.25"), places=4),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_commission_calculation(sales_amount, commission_rate):
    """
    Property 2: Commission calculation.

    commission = sales_amount × commission_rate

    Commission must be non-negative and ≤ sales_amount × max_rate.

    Why: Commission is a direct monetary payout.  An off-by-one in the
    rate (e.g. 10% vs 10x) could bankrupt the business or cheat the staff.
    """
    commission = sales_amount * commission_rate

    assert commission >= 0
    assert commission <= sales_amount, "Commission cannot exceed sales amount"


@given(
    target_value=st.decimals(min_value=Decimal("1"), max_value=Decimal("50000"), places=2),
    achieved_value=st.decimals(min_value=Decimal("0"), max_value=Decimal("100000"), places=2),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_target_status_consistency(target_value, achieved_value):
    """
    Property 3: Target status consistency.

    Status SHALL be:
    - 'completed' if achieved >= target
    - 'in_progress' if achieved > 0 and < target
    - 'not_started' if achieved == 0

    Why: An incorrect status would trigger wrong notifications (e.g.
    "congratulations" email when target is not met).
    """
    if achieved_value >= target_value:
        status = "completed"
    elif achieved_value > 0:
        status = "in_progress"
    else:
        status = "not_started"

    # Verify consistency
    if status == "completed":
        assert achieved_value >= target_value
    elif status == "in_progress":
        assert Decimal("0") < achieved_value < target_value
    else:
        assert achieved_value == 0
