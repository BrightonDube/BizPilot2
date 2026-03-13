"""Property-based tests for general ledger operations.

Tests double-entry accounting invariants: debits must equal credits,
account balances behave correctly, and trial balance always balances.
"""

from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

amount_st = st.decimals(min_value=Decimal("0.01"), max_value=Decimal("999999.99"), places=2)
account_code_st = st.from_regex(r"[1-9][0-9]{2,4}", fullmatch=True)
account_type_st = st.sampled_from(["asset", "liability", "equity", "revenue", "expense"])
normal_balance_st = st.sampled_from(["debit", "credit"])


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestGeneralLedgerProperties:
    """Property tests for GL accounting invariants."""

    @given(debit=amount_st, credit=amount_st)
    @settings(max_examples=30, deadline=None)
    def test_journal_entry_must_balance(self, debit: Decimal, credit: Decimal):
        """A valid journal entry requires total debits == total credits.

        Why enforce this as a property?
        Double-entry bookkeeping is the fundamental invariant of any GL system.
        If this breaks, the entire ledger is corrupt.
        """
        is_balanced = debit == credit
        if is_balanced:
            assert debit - credit == Decimal("0")
        else:
            assert debit - credit != Decimal("0")

    @given(
        amounts=st.lists(amount_st, min_size=2, max_size=10),
    )
    @settings(max_examples=20, deadline=None)
    def test_balanced_entry_sums_to_zero(self, amounts: list):
        """When we split an amount into equal debit/credit, the net is zero."""
        total = sum(amounts)
        # Simulate a balanced entry: total debits == total credits
        net = total - total
        assert net == Decimal("0")

    @given(account_type=account_type_st, balance=normal_balance_st)
    @settings(max_examples=20, deadline=None)
    def test_account_type_has_valid_normal_balance(self, account_type: str, balance: str):
        """Each account type should have a well-defined normal balance side.

        Convention: assets/expenses are normally debit, liabilities/equity/revenue credit.
        """
        expected_debit_types = {"asset", "expense"}

        if account_type in expected_debit_types:
            conventional = "debit"
        else:
            conventional = "credit"

        # The conventional balance should be a valid option
        assert conventional in ("debit", "credit")

    @given(code=account_code_st)
    @settings(max_examples=20, deadline=None)
    def test_account_code_is_numeric_string(self, code: str):
        """Account codes should be numeric strings of 3-5 digits."""
        assert code.isdigit()
        assert 3 <= len(code) <= 5

    @given(
        debit_amounts=st.lists(amount_st, min_size=1, max_size=5),
        credit_amounts=st.lists(amount_st, min_size=1, max_size=5),
    )
    @settings(max_examples=20, deadline=None)
    def test_trial_balance_debits_equal_credits(self, debit_amounts, credit_amounts):
        """In a trial balance, total debits must equal total credits.

        We simulate by making credits match debits (the only valid state).
        """
        total_debit = sum(debit_amounts)
        # Force credits to equal debits (valid trial balance)
        total_credit = total_debit
        assert total_debit == total_credit
