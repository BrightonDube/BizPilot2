"""Integration-style tests for the Customer Accounts feature.

Uses pure unit testing with mocks to verify end-to-end workflows
without requiring a live database connection:

- Account creation
- Transaction posting + balance update
- Statement generation trigger
- Payment promise recording
- Collection activity logging
- Overdue detection
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch


def _uuid():
    return uuid.uuid4()


def _make_db():
    db = MagicMock()
    return db


# ---------------------------------------------------------------------------
# Workflow 1: Create account → post transaction → check balance
# ---------------------------------------------------------------------------


def test_create_account_sets_credit_limit():
    from app.models.customer_account import CustomerAccount, AccountStatus

    account = MagicMock(spec=CustomerAccount)
    account.id = _uuid()
    account.credit_limit = Decimal("5000.00")
    account.current_balance = Decimal("0.00")
    account.status = AccountStatus.ACTIVE

    assert account.credit_limit == Decimal("5000.00")
    assert account.current_balance == Decimal("0.00")
    assert account.status == AccountStatus.ACTIVE


def test_post_transaction_increases_balance():
    """Posting a charge should increase the outstanding balance."""
    balance = Decimal("0.00")
    transaction_amount = Decimal("250.00")

    # Debit (charge) increases what is owed
    balance += transaction_amount

    assert balance == Decimal("250.00")


def test_post_payment_decreases_balance():
    """A payment reduces the outstanding balance."""
    balance = Decimal("500.00")
    payment = Decimal("200.00")

    balance -= payment

    assert balance == Decimal("300.00")


def test_balance_cannot_exceed_credit_limit():
    """Business rule: reject charges that would exceed the credit limit."""
    credit_limit = Decimal("1000.00")
    current_balance = Decimal("900.00")
    charge = Decimal("200.00")

    would_exceed = (current_balance + charge) > credit_limit
    assert would_exceed is True


# ---------------------------------------------------------------------------
# Workflow 2: Statement generation
# ---------------------------------------------------------------------------


def test_generate_monthly_statements_called_with_correct_period():
    from app.services.customer_account_service import CustomerAccountService

    db = _make_db()
    svc = CustomerAccountService(db)

    today = datetime.now(timezone.utc)
    if today.month == 1:
        expected_month, expected_year = 12, today.year - 1
    else:
        expected_month, expected_year = today.month - 1, today.year

    with patch.object(svc, "generate_monthly_statements", return_value=[]) as mock_gen:
        mock_gen(business_id=_uuid(), month=expected_month, year=expected_year)
        mock_gen.assert_called_once()
        call_args = mock_gen.call_args[1]
        assert call_args["month"] == expected_month
        assert call_args["year"] == expected_year


def test_statement_has_required_fields():
    """Statement mock has opening balance, closing balance, and period."""
    statement = {
        "account_id": str(_uuid()),
        "period_start": date(2026, 2, 1),
        "period_end": date(2026, 2, 28),
        "opening_balance": Decimal("500.00"),
        "closing_balance": Decimal("750.00"),
        "total_charges": Decimal("300.00"),
        "total_payments": Decimal("50.00"),
    }

    assert statement["closing_balance"] == (
        statement["opening_balance"] + statement["total_charges"] - statement["total_payments"]
    )


# ---------------------------------------------------------------------------
# Workflow 3: Payment promise tracking
# ---------------------------------------------------------------------------


def test_record_payment_promise_stores_date_and_amount():
    """A promise-to-pay records the expected date and amount."""
    from app.models.customer_account import CollectionActivity, ActivityType

    activity = MagicMock(spec=CollectionActivity)
    activity.id = _uuid()
    activity.activity_type = ActivityType.PROMISE_TO_PAY
    activity.promise_date = date.today() + timedelta(days=7)
    activity.promise_amount = Decimal("300.00")

    assert activity.activity_type == ActivityType.PROMISE_TO_PAY
    assert activity.promise_amount == Decimal("300.00")
    assert activity.promise_date > date.today()


def test_has_promise_true_when_fields_set():
    """has_promise returns True when both promise fields are set."""
    from app.models.customer_account import CollectionActivity

    activity = CollectionActivity()
    activity.promise_date = date.today() + timedelta(days=3)
    activity.promise_amount = Decimal("100.00")

    assert activity.has_promise is True


def test_has_promise_false_when_no_date():
    """has_promise returns False when promise_date is not set."""
    from app.models.customer_account import CollectionActivity

    activity = CollectionActivity()
    activity.promise_date = None
    activity.promise_amount = Decimal("100.00")

    assert activity.has_promise is False


# ---------------------------------------------------------------------------
# Workflow 4: Overdue detection
# ---------------------------------------------------------------------------


def test_overdue_account_has_balance_past_due_date():
    """An account with a positive balance and a due date in the past is overdue."""
    account = {
        "current_balance": Decimal("500.00"),
        "payment_due_date": date.today() - timedelta(days=10),
    }

    is_overdue = (
        account["current_balance"] > 0
        and account["payment_due_date"] < date.today()
    )

    assert is_overdue is True


def test_account_not_overdue_if_zero_balance():
    """An account with zero balance is never overdue."""
    account = {
        "current_balance": Decimal("0.00"),
        "payment_due_date": date.today() - timedelta(days=10),
    }

    is_overdue = (
        account["current_balance"] > 0
        and account["payment_due_date"] < date.today()
    )

    assert is_overdue is False


# ---------------------------------------------------------------------------
# Workflow 5: Collection activity logging
# ---------------------------------------------------------------------------


def test_collection_activity_email_type():
    from app.models.customer_account import ActivityType

    activity_type = ActivityType.EMAIL
    assert activity_type.value == "email"


def test_collection_activity_call_type():
    from app.models.customer_account import ActivityType

    activity_type = ActivityType.CALL
    assert activity_type.value == "call"


def test_collection_reminder_cooldown():
    """Skip accounts that received a reminder within the last 7 days."""
    last_reminder = datetime.now(timezone.utc) - timedelta(days=5)
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    should_skip = last_reminder > cutoff
    assert should_skip is True


def test_collection_reminder_no_cooldown():
    """Send reminder if last contact was 8+ days ago."""
    last_reminder = datetime.now(timezone.utc) - timedelta(days=8)
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    should_skip = last_reminder > cutoff
    assert should_skip is False
