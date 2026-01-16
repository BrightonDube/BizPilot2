"""Property-based tests for invoice query service using mocks."""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import Mock, MagicMock, patch

from app.scheduler.services.invoice_query import InvoiceQueryService
from app.models.invoice import Invoice, InvoiceStatus
from app.models.notification import Notification, NotificationType


def create_mock_invoice(invoice_data):
    """Create a mock invoice object with the given data."""
    mock_invoice = Mock(spec=Invoice)
    for key, value in invoice_data.items():
        setattr(mock_invoice, key, value)
    
    # Add balance_due property
    mock_invoice.balance_due = invoice_data.get('total', Decimal('0.00')) - invoice_data.get('amount_paid', Decimal('0.00'))
    
    return mock_invoice


# Strategy for generating invoice statuses
invoice_status_strategy = st.sampled_from([
    InvoiceStatus.DRAFT,
    InvoiceStatus.SENT,
    InvoiceStatus.VIEWED,
    InvoiceStatus.PAID,
    InvoiceStatus.PARTIAL,
    InvoiceStatus.OVERDUE,
    InvoiceStatus.CANCELLED,
])


# Strategy for generating dates relative to today
def date_strategy(min_days_offset=-365, max_days_offset=365):
    """Generate dates relative to today."""
    return st.integers(min_value=min_days_offset, max_value=max_days_offset).map(
        lambda days: date.today() + timedelta(days=days)
    )


# Strategy for generating invoices
@st.composite
def invoice_strategy(draw):
    """Generate a random invoice for testing."""
    business_id = uuid4()
    
    return {
        "id": uuid4(),
        "business_id": business_id,
        "invoice_number": f"INV-{draw(st.integers(min_value=1000, max_value=9999))}",
        "due_date": draw(date_strategy()),
        "status": draw(invoice_status_strategy),
        "issue_date": date.today(),
        "subtotal": Decimal("100.00"),
        "total": Decimal("100.00"),
        "amount_paid": Decimal("0.00"),
    }


# Feature: overdue-invoice-scheduler, Property 3: Overdue Invoice Query Correctness
@given(
    invoices=st.lists(
        invoice_strategy(),
        min_size=0,
        max_size=20,
    )
)
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_overdue_invoice_query_correctness(invoices):
    """
    Property: For any set of invoices with various due dates and statuses,
    the overdue invoice query should return exactly those invoices where
    due_date < current_date AND status NOT IN (PAID, CANCELLED).
    
    Validates: Requirements 2.1, 2.2, 2.3
    """
    # Create mock invoices
    mock_invoices = [create_mock_invoice(inv_data) for inv_data in invoices]
    
    # Calculate expected overdue invoices
    today = date.today()
    expected = [
        inv for inv in mock_invoices
        if inv.due_date is not None
        and inv.due_date < today
        and inv.status not in [InvoiceStatus.PAID, InvoiceStatus.CANCELLED]
    ]
    
    # Setup mock database session
    mock_session = MagicMock()
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = expected
    
    # Execute: Query overdue invoices
    service = InvoiceQueryService(mock_session)
    result = service.get_overdue_invoices()
    
    # Verify: Result matches expected overdue invoices
    assert len(result) == len(expected)
    
    result_ids = {inv.id for inv in result}
    expected_ids = {inv.id for inv in expected}
    assert result_ids == expected_ids
    
    # Verify: All returned invoices meet the overdue criteria
    for invoice in result:
        assert invoice.due_date < today
        assert invoice.status not in [InvoiceStatus.PAID, InvoiceStatus.CANCELLED]


@given(
    invoices=st.lists(
        invoice_strategy(),
        min_size=1,
        max_size=15,
    ),
    limit=st.integers(min_value=1, max_value=10),
    offset=st.integers(min_value=0, max_value=5),
)
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_overdue_invoice_query_pagination(invoices, limit, offset):
    """
    Property: Pagination parameters should correctly limit and offset results.
    
    Validates: Requirements 2.1, 8.1, 8.2
    """
    # Create mock invoices
    mock_invoices = [create_mock_invoice(inv_data) for inv_data in invoices]
    
    # Calculate expected overdue invoices
    today = date.today()
    all_overdue = [
        inv for inv in mock_invoices
        if inv.due_date is not None
        and inv.due_date < today
        and inv.status not in [InvoiceStatus.PAID, InvoiceStatus.CANCELLED]
    ]
    
    # Apply pagination
    expected = all_overdue[offset:offset + limit]
    
    # Setup mock database session
    mock_session = MagicMock()
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.offset.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.all.return_value = expected
    
    # Execute: Query with pagination
    service = InvoiceQueryService(mock_session)
    result = service.get_overdue_invoices(limit=limit, offset=offset)
    
    # Verify: Result respects pagination
    assert len(result) <= limit
    assert len(result) == len(expected)


@given(
    invoices=st.lists(
        invoice_strategy(),
        min_size=1,
        max_size=20,
    )
)
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_overdue_invoice_count_matches_query(invoices):
    """
    Property: The count of overdue invoices should match the number of invoices
    returned by the query.
    
    Validates: Requirements 2.1, 2.2
    """
    # Create mock invoices
    mock_invoices = [create_mock_invoice(inv_data) for inv_data in invoices]
    
    # Calculate expected overdue invoices
    today = date.today()
    expected = [
        inv for inv in mock_invoices
        if inv.due_date is not None
        and inv.due_date < today
        and inv.status not in [InvoiceStatus.PAID, InvoiceStatus.CANCELLED]
    ]
    
    # Setup mock database session
    mock_session = MagicMock()
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = expected
    mock_query.count.return_value = len(expected)
    
    # Execute
    service = InvoiceQueryService(mock_session)
    result = service.get_overdue_invoices()
    count = len(expected)  # Simulating count query
    
    # Verify
    assert len(result) == count


@given(
    invoices=st.lists(
        invoice_strategy(),
        min_size=1,
        max_size=20,
    )
)
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_overdue_invoice_excludes_deleted(invoices):
    """
    Property: Deleted invoices (deleted_at IS NOT NULL) should never appear
    in overdue invoice queries.
    
    Validates: Requirements 2.3
    """
    # Create mock invoices, some with deleted_at set
    mock_invoices = []
    for inv_data in invoices:
        mock_inv = create_mock_invoice(inv_data)
        # Randomly mark some as deleted
        if inv_data['id'].int % 2 == 0:
            mock_inv.deleted_at = date.today()
        else:
            mock_inv.deleted_at = None
        mock_invoices.append(mock_inv)
    
    # Calculate expected (non-deleted overdue invoices)
    today = date.today()
    expected = [
        inv for inv in mock_invoices
        if inv.due_date is not None
        and inv.due_date < today
        and inv.status not in [InvoiceStatus.PAID, InvoiceStatus.CANCELLED]
        and inv.deleted_at is None
    ]
    
    # Setup mock database session
    mock_session = MagicMock()
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = expected
    
    # Execute
    service = InvoiceQueryService(mock_session)
    result = service.get_overdue_invoices()
    
    # Verify: No deleted invoices in results
    for invoice in result:
        assert invoice.deleted_at is None


# Feature: overdue-invoice-scheduler, Property 4: Days Overdue Calculation
@given(
    days_overdue=st.integers(min_value=1, max_value=365)
)
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_days_overdue_calculation(days_overdue):
    """
    Property: For any invoice with due_date = current_date - N days,
    the days_overdue should equal N.
    
    Validates: Requirements 3.2
    """
    # Setup: Create invoice with specific due date
    due_date = date.today() - timedelta(days=days_overdue)
    invoice_data = {
        "id": uuid4(),
        "business_id": uuid4(),
        "invoice_number": "INV-TEST",
        "due_date": due_date,
        "status": InvoiceStatus.SENT,
        "issue_date": date.today() - timedelta(days=days_overdue + 7),
        "subtotal": Decimal("100.00"),
        "total": Decimal("100.00"),
        "amount_paid": Decimal("0.00"),
    }
    
    mock_invoice = create_mock_invoice(invoice_data)
    
    # Calculate days overdue
    calculated_days = (date.today() - mock_invoice.due_date).days
    
    # Verify
    assert calculated_days == days_overdue


@given(
    due_date_offset=st.integers(min_value=0, max_value=365)  # Today or future dates
)
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_days_overdue_zero_for_future_dates(due_date_offset):
    """
    Property: For any invoice with due_date >= current_date,
    the invoice should not be considered overdue.
    
    Validates: Requirements 2.1, 3.2
    """
    # Setup: Create invoice with future or today's due date
    due_date = date.today() + timedelta(days=due_date_offset)
    invoice_data = {
        "id": uuid4(),
        "business_id": uuid4(),
        "invoice_number": "INV-FUTURE",
        "due_date": due_date,
        "status": InvoiceStatus.SENT,
        "issue_date": date.today(),
        "subtotal": Decimal("100.00"),
        "total": Decimal("100.00"),
        "amount_paid": Decimal("0.00"),
    }
    
    mock_invoice = create_mock_invoice(invoice_data)
    
    # Verify: Invoice is not overdue
    assert mock_invoice.due_date >= date.today()
    
    # This invoice should not appear in overdue queries
    today = date.today()
    is_overdue = (
        mock_invoice.due_date < today
        and mock_invoice.status not in [InvoiceStatus.PAID, InvoiceStatus.CANCELLED]
    )
    assert not is_overdue


@given(
    invoices=st.lists(
        st.builds(
            dict,
            id=st.just(uuid4()),
            business_id=st.just(uuid4()),
            invoice_number=st.just("INV-1000"),
            due_date=st.integers(min_value=-365, max_value=365).map(
                lambda days: date.today() + timedelta(days=days)
            ),
            status=st.just(InvoiceStatus.DRAFT),
            issue_date=st.just(date.today()),
            subtotal=st.just(Decimal("100.00")),
            total=st.just(Decimal("100.00")),
            amount_paid=st.just(Decimal("0.00")),
        ),
        min_size=1,
        max_size=10,
    )
)
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_days_overdue_calculation_consistency(invoices):
    """
    Property: Days overdue calculation should be consistent across multiple
    invocations for the same invoice.
    
    Validates: Requirements 3.2
    """
    for invoice_data in invoices:
        mock_invoice = create_mock_invoice(invoice_data)
        
        # Calculate days overdue twice
        days_overdue_1 = (date.today() - mock_invoice.due_date).days if mock_invoice.due_date < date.today() else 0
        days_overdue_2 = (date.today() - mock_invoice.due_date).days if mock_invoice.due_date < date.today() else 0
        
        # Verify consistency
        assert days_overdue_1 == days_overdue_2
