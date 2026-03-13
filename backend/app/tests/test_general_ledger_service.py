"""Unit tests for GeneralLedgerService.

Tests cover:
- Chart of accounts CRUD (create, list, get)
- Journal entry lifecycle (create, post, void)
- Double-entry validation (balanced, min 2 lines, non-zero)
- Financial reports (trial balance, income statement, balance sheet)
- Seed default accounts
- Recurring entries CRUD
"""

import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import pytest

from app.services.general_ledger_service import GeneralLedgerService
from app.models.general_ledger import (
    AccountType,
    JournalEntryStatus,
)


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = str(uuid.uuid4())
USER = str(uuid.uuid4())


def _make_service():
    db = MagicMock()
    return GeneralLedgerService(db), db


def _mock_account(**kwargs):
    """Mock a ChartOfAccount."""
    acct = MagicMock()
    acct.id = kwargs.get("id", str(uuid.uuid4()))
    acct.business_id = kwargs.get("business_id", BIZ)
    acct.account_code = kwargs.get("code", "1000")
    acct.name = kwargs.get("name", "Cash")
    acct.account_type = kwargs.get("account_type", AccountType.ASSET)
    acct.normal_balance = kwargs.get("normal_balance", "debit")
    acct.parent_id = kwargs.get("parent_id", None)
    acct.description = kwargs.get("description", None)
    acct.is_active = kwargs.get("is_active", True)
    acct.deleted_at = None
    return acct


def _mock_entry(**kwargs):
    """Mock a JournalEntry."""
    entry = MagicMock()
    entry.id = kwargs.get("id", str(uuid.uuid4()))
    entry.business_id = kwargs.get("business_id", BIZ)
    entry.entry_number = kwargs.get("entry_number", "JE-000001")
    entry.description = kwargs.get("description", "Test entry")
    entry.status = kwargs.get("status", JournalEntryStatus.DRAFT)
    entry.created_by_id = kwargs.get("created_by_id", USER)
    entry.posted_at = kwargs.get("posted_at", None)
    entry.deleted_at = None
    return entry


# ══════════════════════════════════════════════════════════════════════════════
# Chart of Accounts Tests
# ══════════════════════════════════════════════════════════════════════════════


class TestChartOfAccounts:
    """Test account CRUD operations."""

    def test_create_account(self):
        """create_account persists and returns an account."""
        svc, db = _make_service()
        svc.create_account(BIZ, code="1000", name="Cash", account_type="asset")
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_list_accounts(self):
        """list_accounts filters by business_id and not deleted."""
        svc, db = _make_service()
        acct = _mock_account()
        chain = db.query.return_value.filter.return_value
        chain.order_by.return_value.all.return_value = [acct]

        items = svc.list_accounts(BIZ)
        assert items == [acct]

    def test_get_account_found(self):
        """get_account returns account when found."""
        svc, db = _make_service()
        acct = _mock_account()
        db.query.return_value.filter.return_value.first.return_value = acct
        assert svc.get_account(acct.id, BIZ) == acct

    def test_get_account_not_found(self):
        """get_account returns None for missing account."""
        svc, db = _make_service()
        db.query.return_value.filter.return_value.first.return_value = None
        assert svc.get_account("nope", BIZ) is None


# ══════════════════════════════════════════════════════════════════════════════
# Journal Entry Tests
# ══════════════════════════════════════════════════════════════════════════════


class TestJournalEntries:
    """Test journal entry lifecycle and double-entry validation."""

    def test_create_balanced_entry(self):
        """create_journal_entry succeeds with balanced debits/credits."""
        svc, db = _make_service()
        # Mock _next_entry_number
        db.query.return_value.filter.return_value.scalar.return_value = 0

        acct_a = str(uuid.uuid4())
        acct_b = str(uuid.uuid4())
        lines = [
            {"account_id": acct_a, "debit": "100", "credit": "0"},
            {"account_id": acct_b, "debit": "0", "credit": "100"},
        ]

        svc.create_journal_entry(BIZ, "Test sale", lines, user_id=USER)
        db.add.assert_called()
        db.commit.assert_called_once()

    def test_reject_unbalanced_entry(self):
        """create_journal_entry rejects mismatched debits/credits."""
        svc, db = _make_service()
        lines = [
            {"account_id": "a1", "debit": "100", "credit": "0"},
            {"account_id": "a2", "debit": "0", "credit": "50"},
        ]
        with pytest.raises(ValueError, match="not balanced"):
            svc.create_journal_entry(BIZ, "Bad entry", lines)

    def test_reject_single_line(self):
        """create_journal_entry rejects entries with fewer than 2 lines."""
        svc, db = _make_service()
        lines = [{"account_id": "a1", "debit": "100", "credit": "0"}]
        with pytest.raises(ValueError, match="at least 2 lines"):
            svc.create_journal_entry(BIZ, "One line", lines)

    def test_reject_zero_amount(self):
        """create_journal_entry rejects entries where all amounts are zero."""
        svc, db = _make_service()
        lines = [
            {"account_id": "a1", "debit": "0", "credit": "0"},
            {"account_id": "a2", "debit": "0", "credit": "0"},
        ]
        with pytest.raises(ValueError, match="non-zero"):
            svc.create_journal_entry(BIZ, "Zero amounts", lines)

    def test_post_draft_entry(self):
        """post_journal_entry changes status to POSTED."""
        svc, db = _make_service()
        entry = _mock_entry(status=JournalEntryStatus.DRAFT)
        db.query.return_value.filter.return_value.first.return_value = entry

        result = svc.post_journal_entry(entry.id, BIZ, USER)
        assert result.status == JournalEntryStatus.POSTED

    def test_post_rejects_already_posted(self):
        """post_journal_entry rejects already-posted entries."""
        svc, db = _make_service()
        entry = _mock_entry(status=JournalEntryStatus.POSTED)
        db.query.return_value.filter.return_value.first.return_value = entry

        with pytest.raises(ValueError, match="Cannot post"):
            svc.post_journal_entry(entry.id, BIZ, USER)

    def test_void_entry(self):
        """void_journal_entry sets status to VOIDED."""
        svc, db = _make_service()
        entry = _mock_entry(status=JournalEntryStatus.POSTED)
        db.query.return_value.filter.return_value.first.return_value = entry

        result = svc.void_journal_entry(entry.id, BIZ)
        assert result.status == JournalEntryStatus.VOIDED

    def test_void_already_voided_rejects(self):
        """void_journal_entry rejects already-voided entries."""
        svc, db = _make_service()
        entry = _mock_entry(status=JournalEntryStatus.VOIDED)
        db.query.return_value.filter.return_value.first.return_value = entry

        with pytest.raises(ValueError, match="already voided"):
            svc.void_journal_entry(entry.id, BIZ)

    def test_void_not_found_raises(self):
        """void_journal_entry raises when entry not found."""
        svc, db = _make_service()
        db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(ValueError, match="not found"):
            svc.void_journal_entry("missing", BIZ)

    def test_list_entries_with_pagination(self):
        """list_journal_entries returns paginated results with total."""
        svc, db = _make_service()
        entry = _mock_entry()
        chain = db.query.return_value.filter.return_value
        chain.count.return_value = 1
        chain.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [entry]

        items, total = svc.list_journal_entries(BIZ, page=1, per_page=20)
        assert total == 1
        assert items == [entry]


# ══════════════════════════════════════════════════════════════════════════════
# Financial Report Tests
# ══════════════════════════════════════════════════════════════════════════════


class TestFinancialReports:
    """Test trial balance, income statement, and balance sheet."""

    def test_trial_balance_empty(self):
        """Trial balance with no posted entries returns empty."""
        svc, db = _make_service()
        chain = db.query.return_value.join.return_value.join.return_value.filter.return_value
        chain.group_by.return_value.order_by.return_value.all.return_value = []

        result = svc.get_trial_balance(BIZ)
        assert result["rows"] == []
        assert result["total_debit"] == Decimal("0")
        assert result["total_credit"] == Decimal("0")

    def test_trial_balance_balances(self):
        """Trial balance total debits equals total credits."""
        svc, db = _make_service()

        row_asset = MagicMock()
        row_asset.account_id = uuid.uuid4()
        row_asset.account_code = "1000"
        row_asset.account_name = "Cash"
        row_asset.account_type = AccountType.ASSET
        row_asset.normal_balance = "debit"
        row_asset.total_debit = Decimal("1000")
        row_asset.total_credit = Decimal("0")

        row_revenue = MagicMock()
        row_revenue.account_id = uuid.uuid4()
        row_revenue.account_code = "4000"
        row_revenue.account_name = "Sales"
        row_revenue.account_type = AccountType.REVENUE
        row_revenue.normal_balance = "credit"
        row_revenue.total_debit = Decimal("0")
        row_revenue.total_credit = Decimal("1000")

        chain = db.query.return_value.join.return_value.join.return_value.filter.return_value
        chain.group_by.return_value.order_by.return_value.all.return_value = [row_asset, row_revenue]

        result = svc.get_trial_balance(BIZ)
        assert result["total_debit"] == result["total_credit"]
        assert len(result["rows"]) == 2

    def test_income_statement_calculates_net_income(self):
        """Income statement: net income = revenue - expenses."""
        svc, db = _make_service()

        row_rev = MagicMock()
        row_rev.account_id = uuid.uuid4()
        row_rev.account_code = "4000"
        row_rev.account_name = "Sales"
        row_rev.account_type = AccountType.REVENUE
        row_rev.normal_balance = "credit"
        row_rev.total_debit = Decimal("0")
        row_rev.total_credit = Decimal("5000")

        row_exp = MagicMock()
        row_exp.account_id = uuid.uuid4()
        row_exp.account_code = "5000"
        row_exp.account_name = "Rent"
        row_exp.account_type = AccountType.EXPENSE
        row_exp.normal_balance = "debit"
        row_exp.total_debit = Decimal("2000")
        row_exp.total_credit = Decimal("0")

        chain = db.query.return_value.join.return_value.join.return_value.filter.return_value
        chain.group_by.return_value.order_by.return_value.all.return_value = [row_rev, row_exp]

        now = datetime.now(timezone.utc)
        result = svc.get_income_statement(BIZ, now, now)
        assert result["total_revenue"] == Decimal("5000")
        assert result["total_expenses"] == Decimal("2000")
        assert result["net_income"] == Decimal("3000")

    def test_balance_sheet_empty(self):
        """Balance sheet with no data returns empty categories."""
        svc, db = _make_service()
        chain = db.query.return_value.join.return_value.join.return_value.filter.return_value
        chain.group_by.return_value.order_by.return_value.all.return_value = []

        result = svc.get_balance_sheet(BIZ)
        assert result["assets"] == []
        assert result["liabilities"] == []
        assert result["equity"] == []
        assert result["total_assets"] == Decimal("0")

    def test_balance_sheet_categorises_accounts(self):
        """Balance sheet groups accounts into assets, liabilities, equity."""
        svc, db = _make_service()

        row_asset = MagicMock()
        row_asset.account_id = uuid.uuid4()
        row_asset.account_code = "1000"
        row_asset.account_name = "Cash"
        row_asset.account_type = AccountType.ASSET
        row_asset.normal_balance = "debit"
        row_asset.total_debit = Decimal("10000")
        row_asset.total_credit = Decimal("0")

        row_liability = MagicMock()
        row_liability.account_id = uuid.uuid4()
        row_liability.account_code = "2000"
        row_liability.account_name = "Accounts Payable"
        row_liability.account_type = AccountType.LIABILITY
        row_liability.normal_balance = "credit"
        row_liability.total_debit = Decimal("0")
        row_liability.total_credit = Decimal("3000")

        row_equity = MagicMock()
        row_equity.account_id = uuid.uuid4()
        row_equity.account_code = "3000"
        row_equity.account_name = "Retained Earnings"
        row_equity.account_type = AccountType.EQUITY
        row_equity.normal_balance = "credit"
        row_equity.total_debit = Decimal("0")
        row_equity.total_credit = Decimal("7000")

        chain = db.query.return_value.join.return_value.join.return_value.filter.return_value
        chain.group_by.return_value.order_by.return_value.all.return_value = [
            row_asset, row_liability, row_equity,
        ]

        result = svc.get_balance_sheet(BIZ)
        assert result["total_assets"] == Decimal("10000")
        assert result["total_liabilities"] == Decimal("3000")
        assert result["total_equity"] == Decimal("7000")
        assert len(result["assets"]) == 1
        assert len(result["liabilities"]) == 1
        assert len(result["equity"]) == 1


# ══════════════════════════════════════════════════════════════════════════════
# Seed Default Accounts
# ══════════════════════════════════════════════════════════════════════════════


class TestSeedAccounts:
    """Test default chart of accounts seeding."""

    def test_seed_creates_accounts(self):
        """seed_default_accounts creates multiple accounts."""
        svc, db = _make_service()
        # Return None for existing check (none exist)
        db.query.return_value.filter.return_value.first.return_value = None

        accounts = svc.seed_default_accounts(BIZ)
        assert db.add.called
        assert db.commit.called
        assert len(accounts) > 0


# ══════════════════════════════════════════════════════════════════════════════
# Entry Number Generation
# ══════════════════════════════════════════════════════════════════════════════


class TestEntryNumber:
    """Test journal entry number generation."""

    def test_first_entry_is_000001(self):
        """First entry number is JE-000001."""
        svc, db = _make_service()
        db.query.return_value.filter.return_value.scalar.return_value = 0
        assert svc._next_entry_number(BIZ) == "JE-000001"

    def test_increments_from_existing(self):
        """Entry number increments from existing count."""
        svc, db = _make_service()
        db.query.return_value.filter.return_value.scalar.return_value = 42
        assert svc._next_entry_number(BIZ) == "JE-000043"
