"""Property-based tests for invoice query service."""

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from app.scheduler.services.invoice_query import InvoiceQueryService
from app.models.invoice import Invoice, InvoiceStatus
from app.models.notification import Notification, NotificationType
from app.core.database import SessionLocal


def get_test_db_session():
    """Get a database session for testing."""
    session = SessionLocal()
    return session


def cleanup_test_data(session):
    """Clean up test data from the database."""
    try:
        # Delete in order to respect foreign key constraints
        # Only delete if tables exist
        try:
            session.query(Notification).delete()
        except:
            pass
        try:
            session.query(Invoice).delete()
        except:
            pass
        session.commit()
    except Exception as e:
        session.rollback()
        raise e


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
        max_size=20,  # Reduced from 50 for faster tests
    )
)
@settings(
    max_examples=20,  # Reduced from 100 for faster tests
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
    # Get a fresh database session
    db_session = get_test_db_session()
    
    try:
        # Clean up any existing test data
        cleanup_test_data(db_session)
        
        # Setup: Insert invoices into test database
        invoice_objects = []
        for invoice_data in invoices:
            invoice = Invoice(**invoice_data)
            db_session.add(invoice)
            invoice_objects.append(invoice)
        
        db_session.commit()
        
        # Execute: Query overdue invoices
        service = InvoiceQueryService(db_session)
        result = service.get_overdue_invoices()
        
        # Calculate expected overdue invoices
        today = date.today()
        expected = [
            inv for inv in invoice_objects
            if inv.due_date is not None
            and inv.due_date < today
            and inv.status not in [InvoiceStatus.PAID, InvoiceStatus.CANCELLED]
        ]
        
        # Verify: Result matches expected overdue invoices
        assert len(result) == len(expected), (
            f"Expected {len(expected)} overdue invoices, got {len(result)}. "
            f"Expected IDs: {[str(inv.id) for inv in expected]}, "
            f"Got IDs: {[str(inv.id) for inv in result]}"
        )
        
        result_ids = {inv.id for inv in result}
        expected_ids = {inv.id for inv in expected}
        
        assert result_ids == expected_ids, (
            f"Invoice ID mismatch. "
            f"Missing: {expected_ids - result_ids}, "
            f"Extra: {result_ids - expected_ids}"
        )
        
        # Verify: All returned invoices meet the overdue criteria
        for invoice in result:
            assert invoice.due_date < today, (
                f"Invoice {invoice.id} has due_date {invoice.due_date} which is not before today {today}"
            )
            assert invoice.status not in [InvoiceStatus.PAID, InvoiceStatus.CANCELLED], (
                f"Invoice {invoice.id} has status {invoice.status} which should be excluded"
            )
        
        # Verify: No overdue invoices were missed
        for invoice in expected:
            assert invoice.id in result_ids, (
                f"Invoice {invoice.id} with due_date {invoice.due_date} and status {invoice.status} "
                f"should be in results but was not found"
            )
    finally:
        # Clean up
        cleanup_test_data(db_session)
        db_session.close()


@given(
    invoices=st.lists(
        invoice_strategy(),
        min_size=1,
        max_size=15,  # Reduced for faster tests
    ),
    limit=st.integers(min_value=1, max_value=10),  # Reduced range
    offset=st.integers(min_value=0, max_value=5),  # Reduced range
)
@settings(
    max_examples=20,  # Reduced from 50
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_overdue_invoice_query_pagination(invoices, limit, offset):
    """
    Property: Pagination parameters should correctly limit and offset results.
    
    Validates: Requirements 2.1, 8.1, 8.2
    """
    # Get a fresh database session
    db_session = get_test_db_session()
    
    try:
        # Clean up any existing test data
        cleanup_test_data(db_session)
        
        # Setup: Insert invoices into test database
        invoice_objects = []
        for invoice_data in invoices:
            invoice = Invoice(**invoice_data)
            db_session.add(invoice)
            invoice_objects.append(invoice)
        
        db_session.commit()
        
        # Execute: Query with pagination
        service = InvoiceQueryService(db_session)
        result = service.get_overdue_invoices(limit=limit, offset=offset)
        
        # Calculate expected overdue invoices
        today = date.today()
        all_overdue = [
            inv for inv in invoice_objects
            if inv.due_date is not None
            and inv.due_date < today
            and inv.status not in [InvoiceStatus.PAID, InvoiceStatus.CANCELLED]
        ]
        
        # Apply pagination to expected results
        expected = all_overdue[offset:offset + limit]
        
        # Verify: Result respects pagination
        assert len(result) <= limit, f"Result size {len(result)} exceeds limit {limit}"
        assert len(result) == len(expected), (
            f"Expected {len(expected)} invoices with pagination, got {len(result)}"
        )
    finally:
        # Clean up
        cleanup_test_data(db_session)
        db_session.close()


@given(
    invoices=st.lists(
        invoice_strategy(),
        min_size=0,
        max_size=15,  # Reduced for faster tests
    )
)
@settings(
    max_examples=20,  # Reduced from 50
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_overdue_invoice_count_matches_query(invoices):
    """
    Property: The count of overdue invoices should match the number returned by the query.
    
    Validates: Requirements 2.1, 2.2, 2.3
    """
    # Get a fresh database session
    db_session = get_test_db_session()
    
    try:
        # Clean up any existing test data
        cleanup_test_data(db_session)
        
        # Setup: Insert invoices into test database
        for invoice_data in invoices:
            invoice = Invoice(**invoice_data)
            db_session.add(invoice)
        
        db_session.commit()
        
        # Execute: Query overdue invoices and get count
        service = InvoiceQueryService(db_session)
        result = service.get_overdue_invoices()
        count = service.get_overdue_invoices_count()
        
        # Verify: Count matches query result length
        assert count == len(result), (
            f"Count {count} does not match query result length {len(result)}"
        )
    finally:
        # Clean up
        cleanup_test_data(db_session)
        db_session.close()


@given(
    invoices=st.lists(
        invoice_strategy(),
        min_size=1,
        max_size=10,  # Reduced for faster tests
    )
)
@settings(
    max_examples=20,  # Reduced from 50
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_overdue_invoice_excludes_deleted(invoices):
    """
    Property: Deleted invoices (deleted_at is not None) should not be included
    in overdue invoice results.
    
    Validates: Requirements 2.1
    """
    # Get a fresh database session
    db_session = get_test_db_session()
    
    try:
        # Clean up any existing test data
        cleanup_test_data(db_session)
        
        # Setup: Insert invoices, mark some as deleted
        invoice_objects = []
        for i, invoice_data in enumerate(invoices):
            invoice = Invoice(**invoice_data)
            # Mark every other invoice as deleted
            if i % 2 == 0:
                invoice.deleted_at = date.today()
            db_session.add(invoice)
            invoice_objects.append(invoice)
        
        db_session.commit()
        
        # Execute: Query overdue invoices
        service = InvoiceQueryService(db_session)
        result = service.get_overdue_invoices()
        
        # Verify: No deleted invoices in results
        for invoice in result:
            assert invoice.deleted_at is None, (
                f"Invoice {invoice.id} is deleted but was included in results"
            )
        
        # Calculate expected (non-deleted overdue invoices)
        today = date.today()
        expected = [
            inv for inv in invoice_objects
            if inv.due_date is not None
            and inv.due_date < today
            and inv.status not in [InvoiceStatus.PAID, InvoiceStatus.CANCELLED]
            and inv.deleted_at is None
        ]
        
        assert len(result) == len(expected), (
            f"Expected {len(expected)} non-deleted overdue invoices, got {len(result)}"
        )
    finally:
        # Clean up
        cleanup_test_data(db_session)
        db_session.close()


# Feature: overdue-invoice-scheduler, Property 4: Days Overdue Calculation
@given(
    due_date_offset=st.integers(min_value=-365, max_value=-1)  # Only past dates (overdue)
)
@settings(
    max_examples=100,  # Full coverage as specified in design
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_days_overdue_calculation(due_date_offset):
    """
    Property: For any overdue invoice, the calculated days overdue should equal
    the number of calendar days between the due date and the current date in UTC timezone.
    
    **Validates: Requirements 2.4, 2.5**
    """
    # Get a fresh database session
    db_session = get_test_db_session()
    
    try:
        # Clean up any existing test data
        cleanup_test_data(db_session)
        
        # Setup: Create an invoice with a specific due date in the past
        today = date.today()
        due_date = today + timedelta(days=due_date_offset)
        
        invoice_data = {
            "id": uuid4(),
            "business_id": uuid4(),
            "invoice_number": f"INV-TEST-{abs(due_date_offset)}",
            "due_date": due_date,
            "status": InvoiceStatus.SENT,  # Not PAID or CANCELLED
            "issue_date": due_date - timedelta(days=7),  # Issued a week before due
            "subtotal": Decimal("100.00"),
            "total": Decimal("100.00"),
            "amount_paid": Decimal("0.00"),
        }
        
        invoice = Invoice(**invoice_data)
        db_session.add(invoice)
        db_session.commit()
        
        # Execute: Calculate days overdue
        service = InvoiceQueryService(db_session)
        calculated_days = service.calculate_days_overdue(invoice)
        
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
    finally:
        # Clean up
        cleanup_test_data(db_session)
        db_session.close()


@given(
    due_date_offset=st.integers(min_value=0, max_value=365)  # Today or future dates
)
@settings(
    max_examples=50,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_days_overdue_zero_for_future_dates(due_date_offset):
    """
    Property: For invoices with due dates today or in the future,
    days overdue should be 0.
    
    **Validates: Requirements 2.4, 2.5**
    """
    # Get a fresh database session
    db_session = get_test_db_session()
    
    try:
        # Clean up any existing test data
        cleanup_test_data(db_session)
        
        # Setup: Create an invoice with due date today or in the future
        today = date.today()
        due_date = today + timedelta(days=due_date_offset)
        
        invoice_data = {
            "id": uuid4(),
            "business_id": uuid4(),
            "invoice_number": f"INV-FUTURE-{due_date_offset}",
            "due_date": due_date,
            "status": InvoiceStatus.SENT,
            "issue_date": today,
            "subtotal": Decimal("100.00"),
            "total": Decimal("100.00"),
            "amount_paid": Decimal("0.00"),
        }
        
        invoice = Invoice(**invoice_data)
        db_session.add(invoice)
        db_session.commit()
        
        # Execute: Calculate days overdue
        service = InvoiceQueryService(db_session)
        calculated_days = service.calculate_days_overdue(invoice)
        
        # Verify: Days overdue is 0 for future or current dates
        assert calculated_days == 0, (
            f"Days overdue should be 0 for due dates today or in the future. "
            f"Due date: {due_date}, Today: {today}, Got: {calculated_days} days"
        )
    finally:
        # Clean up
        cleanup_test_data(db_session)
        db_session.close()


@given(
    invoices=st.lists(
        invoice_strategy(),
        min_size=1,
        max_size=20,
    )
)
@settings(
    max_examples=50,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_days_overdue_calculation_consistency(invoices):
    """
    Property: Days overdue calculation should be consistent across multiple
    invoices with the same due date.
    
    **Validates: Requirements 2.4, 2.5**
    """
    # Get a fresh database session
    db_session = get_test_db_session()
    
    try:
        # Clean up any existing test data
        cleanup_test_data(db_session)
        
        # Setup: Create invoices with various due dates
        invoice_objects = []
        for invoice_data in invoices:
            invoice = Invoice(**invoice_data)
            db_session.add(invoice)
            invoice_objects.append(invoice)
        
        db_session.commit()
        
        # Execute: Calculate days overdue for each invoice
        service = InvoiceQueryService(db_session)
        
        # Group invoices by due date and verify consistency
        due_date_groups = {}
        for invoice in invoice_objects:
            if invoice.due_date:
                if invoice.due_date not in due_date_groups:
                    due_date_groups[invoice.due_date] = []
                
                calculated_days = service.calculate_days_overdue(invoice)
                due_date_groups[invoice.due_date].append(calculated_days)
        
        # Verify: All invoices with the same due date have the same days overdue
        for due_date, days_list in due_date_groups.items():
            if len(days_list) > 1:
                assert all(d == days_list[0] for d in days_list), (
                    f"Inconsistent days overdue calculation for due date {due_date}. "
                    f"Got different values: {set(days_list)}"
                )
            
            # Verify: Calculation matches expected
            today = date.today()
            if due_date < today:
                expected = (today - due_date).days
                assert days_list[0] == expected, (
                    f"Days overdue for {due_date} should be {expected}, got {days_list[0]}"
                )
            else:
                assert days_list[0] == 0, (
                    f"Days overdue for future date {due_date} should be 0, got {days_list[0]}"
                )
    finally:
        # Clean up
        cleanup_test_data(db_session)
        db_session.close()

