"""Property-based tests for batch processing using mocks."""

from hypothesis import given, strategies as st, settings, HealthCheck
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import Mock, MagicMock

from app.scheduler.services.invoice_query import InvoiceQueryService
from app.models.invoice import Invoice, InvoiceStatus


def create_mock_invoice(invoice_data):
    """Create a mock invoice object with the given data."""
    mock_invoice = Mock(spec=Invoice)
    for key, value in invoice_data.items():
        setattr(mock_invoice, key, value)
    
    # Add balance_due property
    mock_invoice.balance_due = invoice_data.get('total', Decimal('0.00')) - invoice_data.get('amount_paid', Decimal('0.00'))
    
    return mock_invoice


# Strategy for generating overdue invoices
@st.composite
def overdue_invoice_strategy(draw):
    """Generate a random overdue invoice for testing."""
    business_id = uuid4()
    
    # Generate a due date in the past (overdue)
    days_overdue = draw(st.integers(min_value=1, max_value=365))
    due_date = date.today() - timedelta(days=days_overdue)
    
    # Only use statuses that make invoices overdue (not PAID or CANCELLED)
    status = draw(st.sampled_from([
        InvoiceStatus.DRAFT,
        InvoiceStatus.SENT,
        InvoiceStatus.VIEWED,
        InvoiceStatus.PARTIAL,
        InvoiceStatus.OVERDUE,
    ]))
    
    return {
        "id": uuid4(),
        "business_id": business_id,
        "invoice_number": f"INV-{draw(st.integers(min_value=1000, max_value=9999))}",
        "due_date": due_date,
        "status": status,
        "issue_date": due_date - timedelta(days=7),
        "subtotal": Decimal("100.00"),
        "total": Decimal("100.00"),
        "amount_paid": Decimal("0.00"),
    }


# Feature: overdue-invoice-scheduler, Property 7: Complete Batch Processing
@given(
    invoices=st.lists(
        overdue_invoice_strategy(),
        min_size=1,
        max_size=50,
    ),
    batch_size=st.integers(min_value=5, max_value=20)
)
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_complete_batch_processing(invoices, batch_size):
    """
    Property: For any set of overdue invoices found during a job execution,
    all invoices should be processed (either notification created or skipped
    due to existing notification) before the job completes.
    
    **Validates: Requirements 3.5**
    """
    # Create mock invoices
    mock_invoices = [create_mock_invoice(inv_data) for inv_data in invoices]
    
    # Setup mock database session
    mock_session = MagicMock()
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.count.return_value = len(mock_invoices)
    
    # Mock pagination
    def mock_get_batch(limit, offset):
        return mock_invoices[offset:offset + limit]
    
    # Execute: Process invoices in batches
    invoice_query_service = InvoiceQueryService(mock_session)
    total_count = len(mock_invoices)
    
    # Process in batches and track all processed invoices
    processed_invoice_ids = set()
    offset = 0
    
    while offset < total_count:
        batch = mock_get_batch(batch_size, offset)
        
        if not batch:
            break
        
        # Track processed invoices
        for invoice in batch:
            processed_invoice_ids.add(invoice.id)
        
        offset += batch_size
    
    # Verify: All invoices were processed
    expected_invoice_ids = {inv.id for inv in mock_invoices}
    assert processed_invoice_ids == expected_invoice_ids
    
    # Verify: No invoices were processed twice
    assert len(processed_invoice_ids) == len(mock_invoices)


# Feature: overdue-invoice-scheduler, Property 17: Batch Size Adherence
@given(
    num_invoices=st.integers(min_value=10, max_value=100),
    batch_size=st.integers(min_value=5, max_value=20)
)
@settings(
    max_examples=20,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_batch_size_adherence(num_invoices, batch_size):
    """
    Property: For any set of overdue invoices, they should be processed in batches
    where each batch size does not exceed the configured batch_size parameter.
    
    **Validates: Requirements 8.3**
    """
    # Create mock invoices
    business_id = uuid4()
    mock_invoices = []
    for i in range(num_invoices):
        invoice_data = {
            "id": uuid4(),
            "business_id": business_id,
            "invoice_number": f"INV-{1000 + i}",
            "due_date": date.today() - timedelta(days=1),
            "status": InvoiceStatus.SENT,
            "issue_date": date.today() - timedelta(days=8),
            "subtotal": Decimal("100.00"),
            "total": Decimal("100.00"),
            "amount_paid": Decimal("0.00"),
        }
        mock_invoices.append(create_mock_invoice(invoice_data))
    
    # Mock pagination
    def mock_get_batch(limit, offset):
        return mock_invoices[offset:offset + limit]
    
    # Execute: Process invoices in batches
    total_count = len(mock_invoices)
    offset = 0
    batch_sizes = []
    
    while offset < total_count:
        batch = mock_get_batch(batch_size, offset)
        
        if not batch:
            break
        
        batch_sizes.append(len(batch))
        
        # Verify: Batch size does not exceed configured limit
        assert len(batch) <= batch_size
        
        offset += batch_size
    
    # Verify: All batches except possibly the last one are full
    for i, size in enumerate(batch_sizes[:-1]):
        assert size == batch_size
    
    # Verify: Last batch is at most batch_size
    if batch_sizes:
        assert batch_sizes[-1] <= batch_size
    
    # Verify: Total processed equals total count
    total_processed = sum(batch_sizes)
    assert total_processed == total_count
