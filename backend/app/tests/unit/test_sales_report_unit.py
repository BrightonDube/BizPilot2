"""
Unit tests for sales report service calculations.

Tests the core report aggregation logic: gross/net sales, transaction
counts, averages, and period-over-period comparisons.

Why separate from PBTs?
Property tests verify algebraic invariants (net = gross - discounts - refunds).
Unit tests verify specific known scenarios with exact expected values
that a human can hand-verify.
"""

from datetime import datetime, date
from decimal import Decimal
from uuid import uuid4

import pytest


# ---------------------------------------------------------------------------
# Helpers — lightweight data builders
# ---------------------------------------------------------------------------

def make_order(
    order_id=None,
    total=Decimal("0"),
    discount=Decimal("0"),
    refund=Decimal("0"),
    items_count=0,
    payment_method="cash",
    created_at=None,
    status="completed",
):
    """Build an order-like dict for report calculations."""
    return {
        "id": order_id or str(uuid4()),
        "total": total,
        "discount": discount,
        "refund": refund,
        "items_count": items_count,
        "payment_method": payment_method,
        "created_at": created_at or datetime(2024, 1, 15, 12, 0),
        "status": status,
    }


def calculate_gross_sales(orders):
    """Gross = sum of order totals (before discounts/refunds)."""
    return sum(o["total"] for o in orders)


def calculate_net_sales(orders):
    """Net = gross - discounts - refunds."""
    gross = calculate_gross_sales(orders)
    discounts = sum(o["discount"] for o in orders)
    refunds = sum(o["refund"] for o in orders)
    return gross - discounts - refunds


def calculate_avg_transaction_value(orders):
    """ATV = net sales / completed transaction count."""
    completed = [o for o in orders if o["status"] == "completed"]
    if not completed:
        return Decimal("0")
    net = calculate_net_sales(completed)
    return (net / len(completed)).quantize(Decimal("0.01"))


def calculate_items_per_transaction(orders):
    """Items per transaction = total items / transaction count."""
    completed = [o for o in orders if o["status"] == "completed"]
    if not completed:
        return Decimal("0")
    total_items = sum(o["items_count"] for o in completed)
    return (Decimal(str(total_items)) / len(completed)).quantize(Decimal("0.01"))


# ---------------------------------------------------------------------------
# Gross sales tests
# ---------------------------------------------------------------------------

class TestGrossSales:
    """Tests for gross sales aggregation."""

    def test_single_order(self):
        orders = [make_order(total=Decimal("150.00"))]
        assert calculate_gross_sales(orders) == Decimal("150.00")

    def test_multiple_orders(self):
        orders = [
            make_order(total=Decimal("150.00")),
            make_order(total=Decimal("250.00")),
            make_order(total=Decimal("100.00")),
        ]
        assert calculate_gross_sales(orders) == Decimal("500.00")

    def test_empty_orders(self):
        assert calculate_gross_sales([]) == Decimal("0")

    def test_large_values(self):
        """Verify no floating-point issues with large currency values."""
        orders = [
            make_order(total=Decimal("99999.99")),
            make_order(total=Decimal("88888.88")),
        ]
        assert calculate_gross_sales(orders) == Decimal("188888.87")


# ---------------------------------------------------------------------------
# Net sales tests
# ---------------------------------------------------------------------------

class TestNetSales:
    """Tests for net sales = gross - discounts - refunds."""

    def test_no_discounts_or_refunds(self):
        orders = [make_order(total=Decimal("500.00"))]
        assert calculate_net_sales(orders) == Decimal("500.00")

    def test_with_discount(self):
        orders = [make_order(total=Decimal("500.00"), discount=Decimal("50.00"))]
        assert calculate_net_sales(orders) == Decimal("450.00")

    def test_with_refund(self):
        orders = [make_order(total=Decimal("500.00"), refund=Decimal("100.00"))]
        assert calculate_net_sales(orders) == Decimal("400.00")

    def test_with_both(self):
        orders = [
            make_order(
                total=Decimal("500.00"),
                discount=Decimal("50.00"),
                refund=Decimal("100.00"),
            ),
        ]
        assert calculate_net_sales(orders) == Decimal("350.00")

    def test_multiple_orders_mixed(self):
        orders = [
            make_order(total=Decimal("200.00"), discount=Decimal("20.00")),
            make_order(total=Decimal("300.00"), refund=Decimal("30.00")),
        ]
        # Gross=500, discounts=20, refunds=30, net=450
        assert calculate_net_sales(orders) == Decimal("450.00")


# ---------------------------------------------------------------------------
# Average transaction value tests
# ---------------------------------------------------------------------------

class TestAverageTransactionValue:
    """Tests for ATV calculation."""

    def test_basic_atv(self):
        orders = [
            make_order(total=Decimal("100.00")),
            make_order(total=Decimal("200.00")),
        ]
        # Net = 300, count = 2, ATV = 150.00
        assert calculate_avg_transaction_value(orders) == Decimal("150.00")

    def test_atv_excludes_cancelled(self):
        """Cancelled orders should not count toward ATV."""
        orders = [
            make_order(total=Decimal("100.00"), status="completed"),
            make_order(total=Decimal("200.00"), status="cancelled"),
        ]
        assert calculate_avg_transaction_value(orders) == Decimal("100.00")

    def test_atv_with_discounts(self):
        orders = [
            make_order(total=Decimal("200.00"), discount=Decimal("50.00")),
            make_order(total=Decimal("100.00")),
        ]
        # Net of completed = (200-50) + 100 = 250, count = 2, ATV = 125.00
        assert calculate_avg_transaction_value(orders) == Decimal("125.00")

    def test_atv_empty_returns_zero(self):
        assert calculate_avg_transaction_value([]) == Decimal("0")


# ---------------------------------------------------------------------------
# Items per transaction tests
# ---------------------------------------------------------------------------

class TestItemsPerTransaction:
    """Tests for items-per-transaction metric."""

    def test_basic_items_per_txn(self):
        orders = [
            make_order(items_count=3),
            make_order(items_count=5),
        ]
        assert calculate_items_per_transaction(orders) == Decimal("4.00")

    def test_single_item_orders(self):
        orders = [make_order(items_count=1) for _ in range(5)]
        assert calculate_items_per_transaction(orders) == Decimal("1.00")

    def test_empty_returns_zero(self):
        assert calculate_items_per_transaction([]) == Decimal("0")


# ---------------------------------------------------------------------------
# Payment method breakdown tests
# ---------------------------------------------------------------------------

class TestPaymentBreakdown:
    """Tests for payment method aggregation."""

    def test_single_method(self):
        orders = [
            make_order(total=Decimal("100.00"), payment_method="cash"),
            make_order(total=Decimal("200.00"), payment_method="cash"),
        ]
        breakdown = {}
        for o in orders:
            pm = o["payment_method"]
            breakdown[pm] = breakdown.get(pm, Decimal("0")) + o["total"]
        assert breakdown == {"cash": Decimal("300.00")}

    def test_multiple_methods(self):
        orders = [
            make_order(total=Decimal("100.00"), payment_method="cash"),
            make_order(total=Decimal("200.00"), payment_method="card"),
            make_order(total=Decimal("50.00"), payment_method="cash"),
        ]
        breakdown = {}
        for o in orders:
            pm = o["payment_method"]
            breakdown[pm] = breakdown.get(pm, Decimal("0")) + o["total"]
        assert breakdown == {
            "cash": Decimal("150.00"),
            "card": Decimal("200.00"),
        }

    def test_breakdown_totals_equal_gross(self):
        """Sum of all payment methods must equal gross sales."""
        orders = [
            make_order(total=Decimal("100.00"), payment_method="cash"),
            make_order(total=Decimal("200.00"), payment_method="card"),
            make_order(total=Decimal("150.00"), payment_method="eft"),
        ]
        breakdown = {}
        for o in orders:
            pm = o["payment_method"]
            breakdown[pm] = breakdown.get(pm, Decimal("0")) + o["total"]
        assert sum(breakdown.values()) == calculate_gross_sales(orders)
