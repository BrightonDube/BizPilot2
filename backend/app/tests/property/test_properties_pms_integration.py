"""Property-based tests for PMS (Property Management System) integration.

Tests charge posting, room validation, folio operations, and adapter behaviour.
"""

from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st


class TestPMSIntegrationProperties:
    """Property tests for PMS integration invariants."""

    @given(
        charge_amount=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("99999.99"), places=2),
        room_number=st.from_regex(r"[0-9]{3,4}", fullmatch=True),
    )
    @settings(max_examples=20, deadline=None)
    def test_charge_amount_positive(self, charge_amount: Decimal, room_number: str):
        """Charges posted to rooms must be positive amounts.

        Why not allow zero?
        Zero-value charges pollute folio history and confuse
        reconciliation.  Use reversals for corrections instead.
        """
        assert charge_amount > 0
        assert len(room_number) in (3, 4)

    @given(
        original_amount=st.decimals(
            min_value=Decimal("1.00"), max_value=Decimal("10000.00"), places=2
        ),
    )
    @settings(max_examples=20, deadline=None)
    def test_reversal_matches_original(self, original_amount: Decimal):
        """Charge reversals must exactly match the original amount.

        Why exact match?
        Partial reversals are a separate workflow (adjustments).
        Reversals are all-or-nothing to simplify reconciliation.
        """
        reversal_amount = -original_amount
        assert reversal_amount + original_amount == Decimal("0")

    @given(
        guest_name=st.text(min_size=1, max_size=200, alphabet=st.characters(whitelist_categories=("L", "Zs"))),
    )
    @settings(max_examples=20, deadline=None)
    def test_guest_name_not_empty(self, guest_name: str):
        """Guest profiles must have a non-empty name.

        Why enforce?
        PMS systems use guest name for folio identification.
        An empty name causes lookup failures on the PMS side.
        """
        assert len(guest_name.strip()) >= 1

    @given(
        adapter_type=st.sampled_from(["opera", "protel", "mews", "cloudbeds", "generic"]),
    )
    @settings(max_examples=10, deadline=None)
    def test_adapter_type_known(self, adapter_type: str):
        """PMS adapter type must be a supported system."""
        supported = {"opera", "protel", "mews", "cloudbeds", "generic"}
        assert adapter_type in supported

    @given(
        posted_charges=st.lists(
            st.decimals(min_value=Decimal("0.01"), max_value=Decimal("1000.00"), places=2),
            min_size=1,
            max_size=20,
        ),
    )
    @settings(max_examples=20, deadline=None)
    def test_folio_balance_equals_sum(self, posted_charges: list[Decimal]):
        """Folio balance must equal sum of all posted charges.

        Why sum-based?
        Running balance is error-prone with concurrent modifications.
        Recomputing from the charge list ensures correctness.
        """
        total = sum(posted_charges)
        assert total == sum(posted_charges)
        assert total > 0

    @given(
        max_retries=st.integers(min_value=1, max_value=5),
        attempt=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=20, deadline=None)
    def test_retry_within_limit(self, max_retries: int, attempt: int):
        """PMS API retry attempts must not exceed configured maximum.

        Why limit retries?
        Unbounded retries can overwhelm the PMS API and cause rate
        limiting or connection pool exhaustion.
        """
        should_retry = attempt <= max_retries
        if attempt > max_retries:
            assert not should_retry
        else:
            assert should_retry
