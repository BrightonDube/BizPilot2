"""Unit tests for ExpenseService."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")

import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.models.expense import Expense, ExpenseTrackingCategory, ExpenseTrackingStatus
from app.services.expense_service import ExpenseService


BIZ_ID = uuid.uuid4()
USER_ID = uuid.uuid4()
APPROVER_ID = uuid.uuid4()
CAT_ID = uuid.uuid4()
EXPENSE_ID = uuid.uuid4()


def _chain(first=None, rows=None, count=0):
    """Reusable mock supporting SQLAlchemy chained-call pattern."""
    c = MagicMock()
    c.filter.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.join.return_value = c
    c.outerjoin.return_value = c
    c.group_by.return_value = c
    c.with_entities.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = 0
    return c


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def svc(db):
    return ExpenseService(db)


# ── Categories ───────────────────────────────────────────────────


class TestCreateCategory:
    def test_creates_category_minimal(self, svc, db):
        svc.create_category(BIZ_ID, "Office Supplies")
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, ExpenseTrackingCategory)
        assert added.name == "Office Supplies"
        assert added.business_id == BIZ_ID
        assert added.description is None
        assert added.budget_limit is None

    def test_creates_category_with_all_fields(self, svc, db):
        svc.create_category(
            BIZ_ID,
            "Travel",
            description="Travel expenses",
            budget_limit=Decimal("5000.00"),
        )
        added = db.add.call_args[0][0]
        assert added.description == "Travel expenses"
        assert added.budget_limit == Decimal("5000.00")


class TestListCategories:
    def test_returns_active_categories(self, svc, db):
        cats = [MagicMock(spec=ExpenseTrackingCategory), MagicMock(spec=ExpenseTrackingCategory)]
        db.query.return_value = _chain(rows=cats)
        result = svc.list_categories(BIZ_ID)
        assert result == cats
        assert len(result) == 2

    def test_returns_empty_list(self, svc, db):
        db.query.return_value = _chain()
        result = svc.list_categories(BIZ_ID)
        assert result == []


class TestUpdateCategory:
    def test_updates_fields(self, svc, db):
        cat = MagicMock(spec=ExpenseTrackingCategory)
        cat.name = "Old"
        db.query.return_value = _chain(first=cat)
        result = svc.update_category(CAT_ID, BIZ_ID, name="New")
        assert result is cat
        assert cat.name == "New"
        db.commit.assert_called()
        db.refresh.assert_called_once_with(cat)

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)
        result = svc.update_category(CAT_ID, BIZ_ID, name="New")
        assert result is None
        db.commit.assert_not_called()


class TestDeleteCategory:
    def test_soft_deletes(self, svc, db):
        cat = MagicMock(spec=ExpenseTrackingCategory)
        db.query.return_value = _chain(first=cat)
        result = svc.delete_category(CAT_ID, BIZ_ID)
        assert result is True
        cat.soft_delete.assert_called_once()
        db.commit.assert_called()

    def test_returns_false_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)
        result = svc.delete_category(CAT_ID, BIZ_ID)
        assert result is False
        db.commit.assert_not_called()


# ── Expenses ─────────────────────────────────────────────────────


class TestCreateExpense:
    def test_creates_expense_defaults_date_to_today(self, svc, db):
        svc.create_expense(BIZ_ID, USER_ID, Decimal("250.00"), "Stationery")
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, Expense)
        assert added.business_id == BIZ_ID
        assert added.submitted_by == USER_ID
        assert added.amount == Decimal("250.00")
        assert added.description == "Stationery"
        assert added.expense_date == date.today()

    def test_creates_expense_with_all_fields(self, svc, db):
        d = date(2024, 6, 15)
        svc.create_expense(
            BIZ_ID,
            USER_ID,
            Decimal("100.00"),
            "Taxi",
            category_id=CAT_ID,
            vendor="Uber",
            expense_date=d,
            payment_method="card",
            receipt_url="https://example.com/receipt.pdf",
            notes="Airport transfer",
        )
        added = db.add.call_args[0][0]
        assert added.category_id == CAT_ID
        assert added.vendor == "Uber"
        assert added.expense_date == d
        assert added.payment_method == "card"
        assert added.receipt_url == "https://example.com/receipt.pdf"
        assert added.notes == "Airport transfer"


class TestListExpenses:
    def test_returns_paginated_items(self, svc, db):
        expenses = [MagicMock(spec=Expense)]
        db.query.return_value = _chain(rows=expenses, count=1)
        items, total = svc.list_expenses(BIZ_ID)
        assert items == expenses
        assert total == 1

    def test_returns_empty(self, svc, db):
        db.query.return_value = _chain(count=0)
        items, total = svc.list_expenses(BIZ_ID)
        assert items == []
        assert total == 0

    def test_applies_all_filters(self, svc, db):
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.list_expenses(
            BIZ_ID,
            category_id=CAT_ID,
            status=ExpenseTrackingStatus.PENDING,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            page=2,
            per_page=10,
        )
        # base filter + category + status + start_date + end_date = 5 filter calls
        assert chain.filter.call_count == 5
        chain.offset.assert_called_once_with(10)
        chain.limit.assert_called_once_with(10)

    def test_pagination_offset(self, svc, db):
        chain = _chain(count=50)
        db.query.return_value = chain
        svc.list_expenses(BIZ_ID, page=3, per_page=15)
        chain.offset.assert_called_once_with(30)
        chain.limit.assert_called_once_with(15)


class TestGetExpense:
    def test_returns_expense(self, svc, db):
        expense = MagicMock(spec=Expense)
        db.query.return_value = _chain(first=expense)
        result = svc.get_expense(EXPENSE_ID, BIZ_ID)
        assert result is expense

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)
        result = svc.get_expense(EXPENSE_ID, BIZ_ID)
        assert result is None


class TestUpdateExpense:
    def test_updates_fields(self, svc, db):
        expense = MagicMock(spec=Expense)
        expense.description = "Old"
        db.query.return_value = _chain(first=expense)
        result = svc.update_expense(EXPENSE_ID, BIZ_ID, description="New")
        assert result is expense
        assert expense.description == "New"
        db.commit.assert_called()
        db.refresh.assert_called_once_with(expense)

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)
        result = svc.update_expense(EXPENSE_ID, BIZ_ID, description="New")
        assert result is None
        db.commit.assert_not_called()


class TestApproveExpense:
    def test_sets_approved_status_and_approver(self, svc, db):
        expense = MagicMock(spec=Expense)
        db.query.return_value = _chain(first=expense)
        result = svc.approve_expense(EXPENSE_ID, BIZ_ID, APPROVER_ID)
        assert result is expense
        assert expense.status == ExpenseTrackingStatus.APPROVED
        assert expense.approved_by == APPROVER_ID
        db.commit.assert_called()
        db.refresh.assert_called_once_with(expense)

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)
        result = svc.approve_expense(EXPENSE_ID, BIZ_ID, APPROVER_ID)
        assert result is None
        db.commit.assert_not_called()


class TestRejectExpense:
    def test_sets_rejected_status(self, svc, db):
        expense = MagicMock(spec=Expense)
        db.query.return_value = _chain(first=expense)
        result = svc.reject_expense(EXPENSE_ID, BIZ_ID)
        assert result is expense
        assert expense.status == ExpenseTrackingStatus.REJECTED
        db.commit.assert_called()
        db.refresh.assert_called_once_with(expense)

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)
        result = svc.reject_expense(EXPENSE_ID, BIZ_ID)
        assert result is None
        db.commit.assert_not_called()


class TestMarkPaid:
    def test_sets_paid_status(self, svc, db):
        expense = MagicMock(spec=Expense)
        db.query.return_value = _chain(first=expense)
        result = svc.mark_paid(EXPENSE_ID, BIZ_ID)
        assert result is expense
        assert expense.status == ExpenseTrackingStatus.PAID
        db.commit.assert_called()
        db.refresh.assert_called_once_with(expense)

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)
        result = svc.mark_paid(EXPENSE_ID, BIZ_ID)
        assert result is None
        db.commit.assert_not_called()


class TestDeleteExpense:
    def test_soft_deletes(self, svc, db):
        expense = MagicMock(spec=Expense)
        db.query.return_value = _chain(first=expense)
        result = svc.delete_expense(EXPENSE_ID, BIZ_ID)
        assert result is True
        expense.soft_delete.assert_called_once()
        db.commit.assert_called()

    def test_returns_false_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)
        result = svc.delete_expense(EXPENSE_ID, BIZ_ID)
        assert result is False
        db.commit.assert_not_called()


# ── Summary ──────────────────────────────────────────────────────


class TestGetSummary:
    def test_returns_aggregated_data(self, svc, db):
        chain = _chain()
        chain.scalar.return_value = Decimal("1500.00")
        chain.all.side_effect = [
            # by_category rows: (name, amount)
            [("Office", Decimal("800.00")), ("Travel", Decimal("700.00"))],
            # by_status rows: (status, amount)
            [
                (ExpenseTrackingStatus.PENDING, Decimal("500.00")),
                (ExpenseTrackingStatus.APPROVED, Decimal("1000.00")),
            ],
            # by_month rows: (year, month, amount)
            [(2024, 1, Decimal("600.00")), (2024, 2, Decimal("900.00"))],
        ]
        db.query.return_value = chain

        result = svc.get_summary(BIZ_ID)

        assert result["total"] == 1500.00
        assert len(result["by_category"]) == 2
        assert result["by_category"][0] == {"category": "Office", "total": 800.00}
        assert result["by_category"][1] == {"category": "Travel", "total": 700.00}
        assert len(result["by_status"]) == 2
        assert result["by_status"][0] == {"status": "pending", "total": 500.00}
        assert result["by_status"][1] == {"status": "approved", "total": 1000.00}
        assert len(result["by_month"]) == 2
        assert result["by_month"][0] == {"year": 2024, "month": 1, "total": 600.00}
        assert result["by_month"][1] == {"year": 2024, "month": 2, "total": 900.00}

    def test_empty_summary(self, svc, db):
        chain = _chain()
        chain.scalar.return_value = Decimal("0")
        chain.all.side_effect = [[], [], []]
        db.query.return_value = chain

        result = svc.get_summary(BIZ_ID)

        assert result["total"] == 0.0
        assert result["by_category"] == []
        assert result["by_status"] == []
        assert result["by_month"] == []

    def test_uncategorised_label(self, svc, db):
        chain = _chain()
        chain.scalar.return_value = Decimal("200.00")
        chain.all.side_effect = [
            [(None, Decimal("200.00"))],
            [(ExpenseTrackingStatus.PENDING, Decimal("200.00"))],
            [(2024, 3, Decimal("200.00"))],
        ]
        db.query.return_value = chain

        result = svc.get_summary(BIZ_ID)
        assert result["by_category"][0]["category"] == "Uncategorised"

    def test_applies_date_filters(self, svc, db):
        chain = _chain()
        chain.scalar.return_value = Decimal("0")
        chain.all.side_effect = [[], [], []]
        db.query.return_value = chain

        svc.get_summary(
            BIZ_ID,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 6, 30),
        )
        # base filter + start_date + end_date = 3 filter calls
        assert chain.filter.call_count == 3
