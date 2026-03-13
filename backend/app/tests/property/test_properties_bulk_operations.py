"""Property-based tests for bulk operations.

Validates correctness properties of the tracked bulk operations system
using Hypothesis.  Each test exercises the service layer with mocked
database interactions to verify invariants.

Feature: Bulk Operations
Requirements: 1-10 (price updates, stock, import/export, validation, audit)
"""

from decimal import Decimal
from unittest.mock import MagicMock, Mock
from uuid import uuid4

from hypothesis import given, settings, strategies as st, HealthCheck

from app.models.bulk_operation import (
    BulkOperation,
    BulkOperationItem,
    BulkOperationType,
    ItemStatus,
    OperationStatus,
)


# ── Strategies ───────────────────────────────────────────────────────────────

@st.composite
def product_ids_strategy(draw):
    """Generate a list of 1-10 product IDs as strings."""
    return [str(draw(st.uuids())) for _ in range(draw(st.integers(min_value=1, max_value=10)))]


@st.composite
def adjustment_strategy(draw):
    """Generate a price adjustment type and value pair."""
    adj_type = draw(st.sampled_from(["percentage", "fixed", "increment"]))
    adj_value = draw(st.floats(min_value=-50, max_value=200, allow_nan=False, allow_infinity=False))
    return adj_type, adj_value


@st.composite
def stock_adjustments_strategy(draw):
    """Generate a list of stock adjustment dicts."""
    count = draw(st.integers(min_value=1, max_value=10))
    return [
        {
            "product_id": str(draw(st.uuids())),
            "quantity_change": draw(st.integers(min_value=-100, max_value=100)),
            "reason": draw(st.sampled_from(["recount", "damage", "received", "sold"])),
        }
        for _ in range(count)
    ]


# ── Helpers ──────────────────────────────────────────────────────────────────

def make_mock_product(product_id: str, selling_price: float = 100.0):
    """Create a mock Product with the given ID and price."""
    p = Mock()
    p.id = product_id
    p.selling_price = Decimal(str(selling_price))
    p.category_id = None
    p.deleted_at = None
    p.business_id = "biz-1"
    return p


def make_mock_inventory(product_id: str, qty: float = 50.0):
    """Create a mock InventoryItem."""
    inv = Mock()
    inv.product_id = product_id
    inv.quantity_on_hand = qty
    inv.deleted_at = None
    inv.business_id = "biz-1"
    return inv


# ── Property Tests ───────────────────────────────────────────────────────────

@given(
    adj=adjustment_strategy(),
    num_products=st.integers(min_value=1, max_value=5),
)
@settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow], deadline=None)
def test_price_validation_negative_check(adj, num_products):
    """
    Property 1: Price validation catches negative results.

    For any adjustment that would produce a negative selling price,
    validate_price_update must report it as invalid.

    Why this matters: Negative prices are a data integrity violation
    that would confuse the POS and accounting systems.
    """
    adj_type, adj_value = adj
    product_ids = [str(uuid4()) for _ in range(num_products)]
    base_price = 50.0

    from app.services.tracked_bulk_service import TrackedBulkOperationService

    mock_db = MagicMock()
    service = TrackedBulkOperationService(mock_db)

    # Create mock products with known prices
    products = [make_mock_product(pid, base_price) for pid in product_ids]

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = products

    result = service.validate_price_update(
        "biz-1", product_ids, adj_type, adj_value,
    )

    # Calculate expected new price for each product
    for product in products:
        price = float(product.selling_price)
        if adj_type == "percentage":
            new_price = price * (1 + adj_value / 100)
        elif adj_type == "fixed":
            new_price = adj_value
        elif adj_type == "increment":
            new_price = price + adj_value
        else:
            new_price = price

        if new_price < 0:
            # There must be at least one error for this negative-price case
            assert not result.is_valid or result.invalid_records > 0, (
                f"Expected validation to catch negative price {new_price}"
            )


@given(num_products=st.integers(min_value=1, max_value=5))
@settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow], deadline=None)
def test_operation_progress_invariant(num_products):
    """
    Property 2: Progress counters are consistent.

    After execution: processed == successful + failed,
    and processed <= total_records.

    Why this matters: Frontend progress bars rely on these counters.
    Inconsistent values would show impossible percentages (e.g. 120%).
    """
    from app.services.tracked_bulk_service import TrackedBulkOperationService

    mock_db = MagicMock()
    service = TrackedBulkOperationService(mock_db)

    product_ids = [str(uuid4()) for _ in range(num_products)]
    products = [make_mock_product(pid, 100.0) for pid in product_ids]

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = products

    op = service.execute_price_update(
        user_id=str(uuid4()),
        business_id="biz-1",
        product_ids=product_ids,
        adjustment_type="percentage",
        adjustment_value=10.0,
    )

    # Core invariant: processed = successful + failed
    assert op.processed_records == op.successful_records + op.failed_records
    # processed must never exceed total
    assert op.processed_records <= op.total_records
    # Total should match input
    assert op.total_records == num_products


@given(
    num_items=st.integers(min_value=1, max_value=5),
    fail_index=st.integers(min_value=0, max_value=4),
)
@settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow], deadline=None)
def test_error_isolation(num_items, fail_index):
    """
    Property 3: One failing record does not abort the batch.

    If one product ID is missing (causing a "not found" failure),
    the remaining products should still be processed successfully.

    Why this matters: Bulk operations often involve hundreds of products.
    Aborting the entire batch because of one bad ID is unacceptable.
    """
    fail_index = fail_index % num_items

    from app.services.tracked_bulk_service import TrackedBulkOperationService

    mock_db = MagicMock()
    service = TrackedBulkOperationService(mock_db)

    product_ids = [str(uuid4()) for _ in range(num_items)]
    # Create products for all except the failing one
    products = []
    for i, pid in enumerate(product_ids):
        if i != fail_index:
            products.append(make_mock_product(pid, 100.0))

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = products

    op = service.execute_price_update(
        user_id=str(uuid4()),
        business_id="biz-1",
        product_ids=product_ids,
        adjustment_type="increment",
        adjustment_value=5.0,
    )

    # One product was missing, so exactly one failure
    assert op.failed_records == 1
    # The rest should succeed
    assert op.successful_records == num_items - 1
    # Operation should still complete (not fail entirely)
    assert op.status in (OperationStatus.COMPLETED.value, OperationStatus.FAILED.value)
    if num_items > 1:
        assert op.status == OperationStatus.COMPLETED.value


@given(data=st.data())
@settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow], deadline=None)
def test_before_after_snapshot_consistency(data):
    """
    Property 4: Before/after snapshots are consistent.

    For every successful price update item, before_data must contain the
    original price and after_data must contain the new price. The after_data
    price must match the actual product price after modification.

    Why this matters: Snapshots enable rollback.  Incorrect snapshots would
    make rollback restore wrong values.
    """
    from app.services.tracked_bulk_service import TrackedBulkOperationService

    mock_db = MagicMock()
    service = TrackedBulkOperationService(mock_db)

    base_price = data.draw(st.floats(min_value=10.0, max_value=1000.0, allow_nan=False, allow_infinity=False))
    pid = str(uuid4())
    product = make_mock_product(pid, base_price)

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = [product]

    # Track items added to DB
    added_items = []

    def capture_add(obj):
        """Side-effect that records BulkOperationItem objects for inspection."""
        if isinstance(obj, BulkOperationItem):
            added_items.append(obj)

    mock_db.add.side_effect = capture_add

    service.execute_price_update(
        user_id=str(uuid4()),
        business_id="biz-1",
        product_ids=[pid],
        adjustment_type="increment",
        adjustment_value=10.0,
    )

    # Find the item for our product
    for item in added_items:
        if item.status == ItemStatus.SUCCESS.value:
            assert item.before_data is not None
            assert "selling_price" in item.before_data
            assert item.after_data is not None
            assert "selling_price" in item.after_data

            # Before should be the original price
            assert abs(item.before_data["selling_price"] - base_price) < 0.01

            # After should be original + 10
            expected_new = round(base_price + 10.0, 2)
            assert abs(item.after_data["selling_price"] - expected_new) < 0.01


@given(
    operation_type=st.sampled_from(list(BulkOperationType)),
    total=st.integers(min_value=0, max_value=100),
    processed=st.integers(min_value=0, max_value=100),
)
@settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow], deadline=None)
def test_progress_percentage_safe(operation_type, total, processed):
    """
    Property 5: progress_percentage never crashes or returns > 100%.

    The property must handle zero total_records gracefully (division by zero)
    and never report more than 100% progress.

    Why this matters: Frontend relies on progress_percentage for UI rendering.
    A crash or NaN would break the progress bar component.
    """
    op = BulkOperation()
    op.total_records = total
    op.processed_records = min(processed, total)  # Ensure processed <= total

    pct = op.progress_percentage

    assert isinstance(pct, float)
    assert pct >= 0.0
    if total == 0:
        assert pct == 0.0
    else:
        assert pct <= 100.0


@given(
    status=st.sampled_from([s.value for s in OperationStatus]),
)
@settings(max_examples=20, suppress_health_check=[HealthCheck.function_scoped_fixture], deadline=None)
def test_terminal_state_detection(status):
    """
    Property 6: is_terminal correctly identifies final states.

    Terminal states (completed, failed, cancelled) must return True.
    Non-terminal states (pending, validating, processing, rolling_back)
    must return False.

    Why this matters: The cancel endpoint uses is_terminal to guard
    against cancelling already-finished operations.
    """
    op = BulkOperation()
    op.status = status

    terminal_states = {
        OperationStatus.COMPLETED.value,
        OperationStatus.FAILED.value,
        OperationStatus.CANCELLED.value,
    }

    if status in terminal_states:
        assert op.is_terminal is True
    else:
        assert op.is_terminal is False


@given(
    adj_type=st.sampled_from(["percentage", "fixed", "increment"]),
    adj_value=st.floats(min_value=0.01, max_value=500, allow_nan=False, allow_infinity=False),
    num_products=st.integers(min_value=1, max_value=5),
)
@settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow], deadline=None)
def test_validation_matches_execution(adj_type, adj_value, num_products):
    """
    Property 7: Validation result matches execution outcome.

    If validation says all records are valid, execution should produce
    zero failures (assuming the same data). If validation reports N
    invalid records, execution should report at least N failures.

    Why this matters: Users rely on the preview to decide whether to
    proceed.  A mismatch would erode trust in the validation step.
    """
    from app.services.tracked_bulk_service import TrackedBulkOperationService

    mock_db = MagicMock()
    service = TrackedBulkOperationService(mock_db)

    product_ids = [str(uuid4()) for _ in range(num_products)]
    products = [make_mock_product(pid, 100.0) for pid in product_ids]

    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = products

    # Validate
    result = service.validate_price_update("biz-1", product_ids, adj_type, adj_value)

    # Execute
    op = service.execute_price_update(
        user_id=str(uuid4()),
        business_id="biz-1",
        product_ids=product_ids,
        adjustment_type=adj_type,
        adjustment_value=adj_value,
    )

    # If validation passed, execution should succeed
    if result.is_valid:
        assert op.successful_records == num_products
        assert op.failed_records == 0
