"""Unit tests for petty cash service.

Tests cover:
- Fund creation and management
- Expense category CRUD
- Expense submission, approval, rejection
- Balance deduction on approval
- Fund replenishment
- Disbursement lifecycle
- Receipt management
- Reconciliation with variance
"""

import os
import uuid
from decimal import Decimal
from unittest.mock import MagicMock

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import pytest

from app.models.petty_cash import (
    ExpenseStatus,
    FundStatus,
    DisbursementStatus,
    ReconciliationStatus,
)
from app.services.petty_cash_service import PettyCashService


# ══════════════════════════════════════════════════════════════════════════════
# Test helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = str(uuid.uuid4())
USER = str(uuid.uuid4())
APPROVER = str(uuid.uuid4())


def _mock_fund(**kwargs):
    """Create a mock PettyCashFund."""
    fund = MagicMock()
    fund.id = kwargs.get("id", uuid.uuid4())
    fund.business_id = kwargs.get("business_id", BIZ)
    fund.name = kwargs.get("name", "Office Fund")
    fund.initial_amount = kwargs.get("initial_amount", Decimal("5000.00"))
    fund.current_balance = kwargs.get("current_balance", Decimal("5000.00"))
    fund.custodian_id = kwargs.get("custodian_id", None)
    fund.status = kwargs.get("status", FundStatus.ACTIVE)
    fund.deleted_at = None
    return fund


def _mock_expense(**kwargs):
    """Create a mock PettyCashExpense."""
    expense = MagicMock()
    expense.id = kwargs.get("id", uuid.uuid4())
    expense.fund_id = kwargs.get("fund_id", uuid.uuid4())
    expense.business_id = kwargs.get("business_id", BIZ)
    expense.requested_by_id = kwargs.get("requested_by_id", USER)
    expense.approved_by_id = kwargs.get("approved_by_id", None)
    expense.amount = kwargs.get("amount", Decimal("150.00"))
    expense.description = kwargs.get("description", "Office supplies")
    expense.status = kwargs.get("status", ExpenseStatus.PENDING)
    expense.rejection_reason = None
    expense.deleted_at = None
    return expense


def _make_service():
    """Create PettyCashService with mocked DB session."""
    db = MagicMock()
    return PettyCashService(db), db


# ══════════════════════════════════════════════════════════════════════════════
# Fund tests
# ══════════════════════════════════════════════════════════════════════════════

class TestFundManagement:
    """Test petty cash fund operations."""

    def test_create_fund(self):
        """Fund creation sets initial_amount = current_balance."""
        svc, db = _make_service()
        svc.create_fund(BIZ, "Office Fund", Decimal("5000.00"))
        db.add.assert_called_once()
        db.commit.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.initial_amount == Decimal("5000.00")
        assert added.current_balance == Decimal("5000.00")
        assert added.status == FundStatus.ACTIVE

    def test_create_fund_with_custodian(self):
        """Fund can be assigned to a custodian."""
        svc, db = _make_service()
        svc.create_fund(BIZ, "Cash Box", Decimal("2000.00"), custodian_id=USER)
        added = db.add.call_args[0][0]
        assert added.custodian_id == USER

    def test_get_fund(self):
        """get_fund filters by id, business_id, and non-deleted."""
        svc, db = _make_service()
        fund = _mock_fund()
        db.query.return_value.filter.return_value.first.return_value = fund
        result = svc.get_fund(str(fund.id), BIZ)
        assert result == fund

    def test_get_fund_not_found(self):
        """get_fund returns None for non-existent fund."""
        svc, db = _make_service()
        db.query.return_value.filter.return_value.first.return_value = None
        result = svc.get_fund("no-id", BIZ)
        assert result is None

    def test_list_funds_pagination(self):
        """list_funds returns (items, total) with pagination."""
        svc, db = _make_service()
        db.query.return_value.filter.return_value.count.return_value = 3
        db.query.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
            _mock_fund(), _mock_fund()
        ]
        items, total = svc.list_funds(BIZ, page=1, per_page=2)
        assert total == 3
        assert len(items) == 2


# ══════════════════════════════════════════════════════════════════════════════
# Category tests
# ══════════════════════════════════════════════════════════════════════════════

class TestCategoryManagement:
    """Test expense category operations."""

    def test_create_category(self):
        """Category creation sets name and is_active."""
        svc, db = _make_service()
        svc.create_category(BIZ, "Office Supplies", description="Pens, paper")
        added = db.add.call_args[0][0]
        assert added.name == "Office Supplies"
        assert added.is_active is True

    def test_create_category_with_gl_code(self):
        """Category can have a GL account code."""
        svc, db = _make_service()
        svc.create_category(BIZ, "Cleaning", gl_account_code="5010")
        added = db.add.call_args[0][0]
        assert added.gl_account_code == "5010"

    def test_list_categories(self):
        """list_categories returns active categories only."""
        svc, db = _make_service()
        cats = [MagicMock(name="A"), MagicMock(name="B")]
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = cats
        result = svc.list_categories(BIZ)
        assert len(result) == 2


# ══════════════════════════════════════════════════════════════════════════════
# Expense tests
# ══════════════════════════════════════════════════════════════════════════════

class TestExpenseOperations:
    """Test expense submission, approval, and rejection."""

    def test_submit_expense(self):
        """Submit expense checks fund is active."""
        svc, db = _make_service()
        fund = _mock_fund()
        # Mock get_fund to return active fund
        db.query.return_value.filter.return_value.first.return_value = fund
        svc.submit_expense(
            str(fund.id), BIZ, USER, Decimal("100.00"), "Paper"
        )
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.amount == Decimal("100.00")
        assert added.status == ExpenseStatus.PENDING

    def test_submit_expense_inactive_fund_raises(self):
        """Cannot submit expense against inactive fund."""
        svc, db = _make_service()
        fund = _mock_fund(status=FundStatus.SUSPENDED)
        db.query.return_value.filter.return_value.first.return_value = fund
        with pytest.raises(ValueError, match="not active"):
            svc.submit_expense(str(fund.id), BIZ, USER, Decimal("50"), "Test")

    def test_submit_expense_fund_not_found_raises(self):
        """Cannot submit expense for non-existent fund."""
        svc, db = _make_service()
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(ValueError, match="Fund not found"):
            svc.submit_expense("no-id", BIZ, USER, Decimal("50"), "Test")

    def test_approve_expense_deducts_balance(self):
        """Approval deducts amount from fund balance."""
        svc, db = _make_service()
        fund = _mock_fund(current_balance=Decimal("1000.00"))
        expense = _mock_expense(fund_id=fund.id, amount=Decimal("200.00"))

        # First query returns expense, second returns fund
        db.query.return_value.filter.return_value.first.side_effect = [expense, fund]

        svc.approve_expense(str(expense.id), BIZ, APPROVER)

        assert expense.status == ExpenseStatus.APPROVED
        assert expense.approved_by_id == APPROVER
        assert fund.current_balance == Decimal("800.00")

    def test_approve_expense_insufficient_balance_raises(self):
        """Cannot approve if fund balance is too low."""
        svc, db = _make_service()
        fund = _mock_fund(current_balance=Decimal("50.00"))
        expense = _mock_expense(fund_id=fund.id, amount=Decimal("200.00"))
        db.query.return_value.filter.return_value.first.side_effect = [expense, fund]

        with pytest.raises(ValueError, match="Insufficient"):
            svc.approve_expense(str(expense.id), BIZ, APPROVER)

    def test_approve_non_pending_raises(self):
        """Cannot approve expense that isn't pending."""
        svc, db = _make_service()
        expense = _mock_expense(status=ExpenseStatus.APPROVED)
        db.query.return_value.filter.return_value.first.return_value = expense

        with pytest.raises(ValueError, match="not in pending"):
            svc.approve_expense(str(expense.id), BIZ, APPROVER)

    def test_reject_expense(self):
        """Rejection sets reason and approver."""
        svc, db = _make_service()
        expense = _mock_expense()
        db.query.return_value.filter.return_value.first.return_value = expense

        svc.reject_expense(str(expense.id), BIZ, APPROVER, "Too expensive")

        assert expense.status == ExpenseStatus.REJECTED
        assert expense.rejection_reason == "Too expensive"
        assert expense.approved_by_id == APPROVER

    def test_reject_non_pending_raises(self):
        """Cannot reject expense that isn't pending."""
        svc, db = _make_service()
        expense = _mock_expense(status=ExpenseStatus.REJECTED)
        db.query.return_value.filter.return_value.first.return_value = expense

        with pytest.raises(ValueError, match="not in pending"):
            svc.reject_expense(str(expense.id), BIZ, APPROVER, "reason")

    def test_list_expenses_with_status_filter(self):
        """list_expenses supports optional status filter."""
        svc, db = _make_service()
        db.query.return_value.filter.return_value.filter.return_value.count.return_value = 1
        db.query.return_value.filter.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
            _mock_expense()
        ]
        items, total = svc.list_expenses(
            str(uuid.uuid4()), BIZ, status=ExpenseStatus.PENDING
        )
        assert total == 1


# ══════════════════════════════════════════════════════════════════════════════
# Replenishment tests
# ══════════════════════════════════════════════════════════════════════════════

class TestReplenishment:
    """Test fund replenishment."""

    def test_replenish_increases_balance(self):
        """Replenishment adds to current_balance."""
        svc, db = _make_service()
        fund = _mock_fund(current_balance=Decimal("500.00"))
        db.query.return_value.filter.return_value.first.return_value = fund

        svc.replenish_fund(str(fund.id), BIZ, Decimal("2000.00"), USER, "Monthly top-up")

        assert fund.current_balance == Decimal("2500.00")
        db.add.assert_called_once()  # replenishment record added


# ══════════════════════════════════════════════════════════════════════════════
# Disbursement tests
# ══════════════════════════════════════════════════════════════════════════════

class TestDisbursement:
    """Test cash disbursement lifecycle."""

    def test_create_disbursement(self):
        """Disbursement record is created with PENDING status."""
        svc, db = _make_service()
        # Mock the count query for disbursement numbering
        db.query.return_value.filter.return_value.scalar.return_value = 0

        svc.create_disbursement(
            fund_id=str(uuid.uuid4()),
            expense_id=None,
            amount=Decimal("300.00"),
            recipient_id=USER,
            disbursed_by=APPROVER,
        )
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.amount == Decimal("300.00")
        assert added.status == DisbursementStatus.PENDING.value

    def test_complete_disbursement(self):
        """Completing sets status to COMPLETED and records timestamp."""
        svc, db = _make_service()
        disb = MagicMock()
        disb.status = DisbursementStatus.PENDING.value
        db.query.return_value.filter.return_value.first.return_value = disb

        svc.complete_disbursement(str(uuid.uuid4()))
        assert disb.status == DisbursementStatus.COMPLETED.value
        assert disb.completed_at is not None


# ══════════════════════════════════════════════════════════════════════════════
# Receipt tests
# ══════════════════════════════════════════════════════════════════════════════

class TestReceiptManagement:
    """Test expense receipt operations."""

    def test_add_receipt(self):
        """Add receipt creates ExpenseReceipt record."""
        svc, db = _make_service()
        svc.add_receipt(
            expense_id=str(uuid.uuid4()),
            receipt_number="REC-001",
            vendor_name="Stationery Co",
            receipt_amount=Decimal("125.00"),
        )
        db.add.assert_called_once()

    def test_validate_receipt(self):
        """Validate receipt sets is_validated and validator info."""
        svc, db = _make_service()
        receipt = MagicMock()
        receipt.is_validated = False
        db.query.return_value.filter.return_value.first.return_value = receipt

        svc.validate_receipt(str(uuid.uuid4()), APPROVER, is_valid=True, notes="Looks correct")
        assert receipt.is_validated is True
        assert receipt.validated_by == APPROVER


# ══════════════════════════════════════════════════════════════════════════════
# Reconciliation tests
# ══════════════════════════════════════════════════════════════════════════════

class TestReconciliation:
    """Test fund reconciliation."""

    def test_create_reconciliation_calculates_variance(self):
        """Reconciliation calculates variance (actual - expected)."""
        svc, db = _make_service()
        fund = _mock_fund(current_balance=Decimal("3000.00"))
        # First query returns fund, second returns count
        db.query.return_value.filter.return_value.first.return_value = fund
        db.query.return_value.filter.return_value.scalar.return_value = 0

        svc.create_reconciliation(
            fund_id=str(fund.id),
            actual_balance=Decimal("2800.00"),
            performed_by=USER,
        )
        db.add.assert_called_once()
        recon = db.add.call_args[0][0]
        assert recon.expected_balance == Decimal("3000.00")
        assert recon.actual_balance == Decimal("2800.00")
        # variance = actual - expected = -200
        assert recon.variance == Decimal("-200.00")

    def test_approve_reconciliation_variance(self):
        """Approve reconciliation sets status and approver."""
        svc, db = _make_service()
        recon = MagicMock()
        recon.status = ReconciliationStatus.DISCREPANCY.value
        db.query.return_value.filter.return_value.first.return_value = recon

        svc.approve_reconciliation_variance(
            str(uuid.uuid4()), APPROVER, "Stock difference acceptable"
        )
        assert recon.status == ReconciliationStatus.APPROVED.value
        assert recon.variance_approved_by == APPROVER
