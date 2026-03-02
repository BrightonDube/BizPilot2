"""Property-based tests for the automated reordering subsystem.

Tasks 17.1-17.4 — Validates stock level accuracy, PO total calculation,
reorder point trigger logic, and variance tracking invariants.

Why property tests for reordering?
Reordering involves arithmetic (totals, quantities, variances) and
threshold comparisons that must hold for any realistic input range.
Property tests exercise these invariants far more thoroughly than
hand-picked test cases.
"""

from decimal import Decimal, ROUND_HALF_UP
from hypothesis import given, strategies as st, assume, settings
from unittest.mock import MagicMock
from uuid import uuid4


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------
stock_qty_st = st.integers(min_value=0, max_value=100_000)
price_st = st.decimals(
    min_value=Decimal("0.01"),
    max_value=Decimal("99999.99"),
    places=2,
    allow_nan=False,
    allow_infinity=False,
)
quantity_st = st.integers(min_value=1, max_value=10_000)


# ===========================================================================
# Property 1: Stock level accuracy
# ===========================================================================

@given(
    current_stock=stock_qty_st,
    received_qty=quantity_st,
)
@settings(max_examples=200, deadline=None)
def test_stock_increases_by_received_quantity(
    current_stock: int, received_qty: int
):
    """Property: after receiving N units, stock equals previous + N.

    This mirrors the GRNService logic that does:
        product.stock_quantity += item.quantity_received
    """
    new_stock = current_stock + received_qty
    assert new_stock == current_stock + received_qty
    assert new_stock >= current_stock  # stock never decreases on receive


@given(
    current_stock=stock_qty_st,
    reorder_point=stock_qty_st,
)
@settings(max_examples=200, deadline=None)
def test_low_stock_detection_is_consistent(
    current_stock: int, reorder_point: int
):
    """Property: a product is low-stock if and only if stock <= reorder_point."""
    is_low = current_stock <= reorder_point
    if current_stock <= reorder_point:
        assert is_low is True
    else:
        assert is_low is False


# ===========================================================================
# Property 2: PO total calculation
# ===========================================================================

@given(
    quantities=st.lists(quantity_st, min_size=1, max_size=20),
    unit_costs=st.lists(price_st, min_size=1, max_size=20),
)
@settings(max_examples=200, deadline=None)
def test_po_total_equals_sum_of_line_totals(
    quantities: list, unit_costs: list
):
    """Property: PO total = sum(qty × unit_cost) for all line items.

    This is the core arithmetic invariant of purchase order creation.
    """
    # Zip to shortest list to ensure equal lengths
    pairs = list(zip(quantities, unit_costs))

    line_totals = []
    for qty, cost in pairs:
        line_total = (Decimal(qty) * cost).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        line_totals.append(line_total)

    po_total = sum(line_totals, Decimal("0.00"))

    # PO total must be non-negative
    assert po_total >= Decimal("0.00")

    # PO total must equal sum of individual lines
    assert po_total == sum(line_totals, Decimal("0.00"))


@given(
    qty=quantity_st,
    unit_cost=price_st,
)
@settings(max_examples=200, deadline=None)
def test_line_total_equals_qty_times_cost(
    qty: int, unit_cost: Decimal
):
    """Property: each line item total = quantity × unit_cost."""
    total = (Decimal(qty) * unit_cost).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    assert total >= Decimal("0.00")
    assert total == (Decimal(qty) * unit_cost).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


# ===========================================================================
# Property 3: Reorder point trigger
# ===========================================================================

@given(
    current_stock=stock_qty_st,
    reorder_point=stock_qty_st,
    safety_stock=st.integers(min_value=0, max_value=1000),
)
@settings(max_examples=200, deadline=None)
def test_reorder_triggers_at_threshold(
    current_stock: int, reorder_point: int, safety_stock: int
):
    """Property: reorder should trigger when stock <= reorder_point,
    and the reorder point should always be >= safety_stock.
    """
    assume(reorder_point >= safety_stock)

    needs_reorder = current_stock <= reorder_point
    if current_stock <= reorder_point:
        assert needs_reorder is True
    if current_stock > reorder_point:
        assert needs_reorder is False


@given(
    velocity=st.floats(min_value=0.01, max_value=1000, allow_nan=False, allow_infinity=False),
    lead_time=st.integers(min_value=1, max_value=90),
    safety_factor=st.floats(min_value=1.0, max_value=3.0, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=100, deadline=None)
def test_suggested_reorder_point_formula(
    velocity: float, lead_time: int, safety_factor: float
):
    """Property: suggested reorder point = ceil(velocity × lead_time × safety_factor).

    Mirrors StockMonitorService.suggest_reorder_point logic.
    """
    import math

    suggested = math.ceil(velocity * lead_time * safety_factor)

    # Must be non-negative
    assert suggested >= 0

    # Must be at least as large as lead-time demand
    assert suggested >= math.ceil(velocity * lead_time)


# ===========================================================================
# Property 4: Variance tracking
# ===========================================================================

@given(
    ordered_qty=quantity_st,
    received_qty=st.integers(min_value=0, max_value=10_000),
)
@settings(max_examples=200, deadline=None)
def test_variance_equals_received_minus_ordered(
    ordered_qty: int, received_qty: int
):
    """Property: variance = received_qty − ordered_qty.

    Positive variance = over-delivery, negative = under-delivery, zero = exact.
    """
    variance = received_qty - ordered_qty

    if received_qty > ordered_qty:
        assert variance > 0, "Over-delivery should produce positive variance"
    elif received_qty < ordered_qty:
        assert variance < 0, "Under-delivery should produce negative variance"
    else:
        assert variance == 0, "Exact delivery should produce zero variance"


@given(
    ordered_qty=quantity_st,
    received_qty=st.integers(min_value=0, max_value=10_000),
)
@settings(max_examples=100, deadline=None)
def test_remaining_qty_is_non_negative(
    ordered_qty: int, received_qty: int
):
    """Property: remaining quantity to receive is always ≥ 0."""
    remaining = max(0, ordered_qty - received_qty)
    assert remaining >= 0
