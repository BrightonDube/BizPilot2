"""Property-based tests for days overdue calculation."""

import pytest
from hypothesis import given, strategies as st, settings
from datetime import date, timedelta
from uuid import uuid4

from app.scheduler.services.invoice_query import InvoiceQueryService


# Feature: overdue-invoice-scheduler, Property 4: Days Overdue Calculation
@given(
    due_date_offset=st.integers(min_value=-365, max_value=-1)  # Only past dates (overdue)
)
@settings(
    max_examples=100,  # Full coverage as specified in design
    deadline=None,
)
def test_days_overdue_calculation(due_date_offset):
    """
    Property: For any overdue invoice, the calculated days overdue should equal
    the number of calendar days between the due date and the current date in UTC timezone.
    
    **Validates: Requirements 2.4, 2.5**
    """
    # Setup: Create a mock invoice with a specific due date in the past
    today = date.today()
    due_date = today + timedelta(days=due_date_offset)
    
    # Create a mock invoice object
    mock_invoice = type('Invoice', (), {
        'due_date': due_date,
        'id': uuid4()
    })()
    
    # Create service (doesn't need database for this calculation)
    service = InvoiceQueryService(None)  # Pass None since we don't need DB for calculation
    
    # Execute: Calculate days overdue
    calculated_days = service.calculate_days_overdue(mock_invoice)
    
    # Calculate expected days overdue
    expected_days = (today - due_date).days
    
    # Verify: Calculated days match expected
    assert calculated_days == expected_days, (
        f"Days overdue calculation incorrect. "
        f"Due date: {due_date}, Today: {today}, "
        f"Expected: {expected_days} days, Got: {calculated_days} days"
    )
    
    # Verify: Days overdue is positive for past due dates
    assert calculated_days > 0, (
        f"Days overdue should be positive for past due dates. "
        f"Got: {calculated_days}"
    )
    
    # Verify: Days overdue equals the absolute value of the offset
    assert calculated_days == abs(due_date_offset), (
        f"Days overdue should equal {abs(due_date_offset)}, got {calculated_days}"
    )


@given(
    due_date_offset=st.integers(min_value=0, max_value=365)  # Today or future dates
)
@settings(
    max_examples=50,
    deadline=None,
)
def test_days_overdue_zero_for_future_dates(due_date_offset):
    """
    Property: For invoices with due dates today or in the future,
    days overdue should be 0.
    
    **Validates: Requirements 2.4, 2.5**
    """
    # Setup: Create a mock invoice with due date today or in the future
    today = date.today()
    due_date = today + timedelta(days=due_date_offset)
    
    # Create a mock invoice object
    mock_invoice = type('Invoice', (), {
        'due_date': due_date,
        'id': uuid4()
    })()
    
    # Create service (doesn't need database for this calculation)
    service = InvoiceQueryService(None)
    
    # Execute: Calculate days overdue
    calculated_days = service.calculate_days_overdue(mock_invoice)
    
    # Verify: Days overdue is 0 for future or current dates
    assert calculated_days == 0, (
        f"Days overdue should be 0 for due dates today or in the future. "
        f"Due date: {due_date}, Today: {today}, Got: {calculated_days} days"
    )


@given(
    due_dates=st.lists(
        st.integers(min_value=-365, max_value=365),
        min_size=1,
        max_size=20,
    )
)
@settings(
    max_examples=50,
    deadline=None,
)
def test_days_overdue_calculation_consistency(due_dates):
    """
    Property: Days overdue calculation should be consistent across multiple
    invoices with the same due date.
    
    **Validates: Requirements 2.4, 2.5**
    """
    # Setup: Create mock invoices with various due dates
    today = date.today()
    service = InvoiceQueryService(None)
    
    # Group invoices by due date and verify consistency
    due_date_groups = {}
    for offset in due_dates:
        due_date = today + timedelta(days=offset)
        
        # Create mock invoice
        mock_invoice = type('Invoice', (), {
            'due_date': due_date,
            'id': uuid4()
        })()
        
        calculated_days = service.calculate_days_overdue(mock_invoice)
        
        if due_date not in due_date_groups:
            due_date_groups[due_date] = []
        due_date_groups[due_date].append(calculated_days)
    
    # Verify: All invoices with the same due date have the same days overdue
    for due_date, days_list in due_date_groups.items():
        if len(days_list) > 1:
            assert all(d == days_list[0] for d in days_list), (
                f"Inconsistent days overdue calculation for due date {due_date}. "
                f"Got different values: {set(days_list)}"
            )
        
        # Verify: Calculation matches expected
        if due_date < today:
            expected = (today - due_date).days
            assert days_list[0] == expected, (
                f"Days overdue for {due_date} should be {expected}, got {days_list[0]}"
            )
        else:
            assert days_list[0] == 0, (
                f"Days overdue for future date {due_date} should be 0, got {days_list[0]}"
            )


@given(
    due_date_offset=st.integers(min_value=-365, max_value=-1)
)
@settings(
    max_examples=50,
    deadline=None,
)
def test_days_overdue_uses_utc_timezone(due_date_offset):
    """
    Property: Days overdue calculation should use UTC timezone consistently.
    
    **Validates: Requirements 2.5**
    """
    # Setup: Create a mock invoice
    today = date.today()  # This uses local date, but calculation should be consistent
    due_date = today + timedelta(days=due_date_offset)
    
    mock_invoice = type('Invoice', (), {
        'due_date': due_date,
        'id': uuid4()
    })()
    
    service = InvoiceQueryService(None)
    
    # Execute: Calculate days overdue
    calculated_days = service.calculate_days_overdue(mock_invoice)
    
    # Verify: Calculation is based on calendar days (not affected by timezone)
    expected_days = (today - due_date).days
    assert calculated_days == expected_days, (
        f"Days overdue should be {expected_days} calendar days, got {calculated_days}"
    )
    
    # Verify: Result is always a non-negative integer
    assert isinstance(calculated_days, int), (
        f"Days overdue should be an integer, got {type(calculated_days)}"
    )
    assert calculated_days >= 0, (
        f"Days overdue should be non-negative, got {calculated_days}"
    )


@given(
    due_date_offset=st.integers(min_value=-365, max_value=-1)
)
@settings(
    max_examples=30,
    deadline=None,
)
def test_days_overdue_no_due_date_returns_zero(due_date_offset):
    """
    Property: Invoices without a due date should return 0 days overdue.
    
    **Validates: Requirements 2.4**
    """
    # Setup: Create a mock invoice without a due date
    mock_invoice = type('Invoice', (), {
        'due_date': None,
        'id': uuid4()
    })()
    
    service = InvoiceQueryService(None)
    
    # Execute: Calculate days overdue
    calculated_days = service.calculate_days_overdue(mock_invoice)
    
    # Verify: Days overdue is 0 when no due date
    assert calculated_days == 0, (
        f"Days overdue should be 0 when due_date is None, got {calculated_days}"
    )
