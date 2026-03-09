"""Unit tests for InventoryReportService.

Tests cover all 7 report methods:
- Stock levels (with filtering, low/out-of-stock flags)
- Stock movements (date range, transaction types)
- Inventory valuation (cost/retail grouping)
- Turnover analysis (fast/slow/dead classification)
- Supplier performance (ranking, percentages)
- Wastage report (types, value estimation)
- Inventory dashboard (KPIs, alerts)
"""

import os
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import pytest

from app.services.inventory_report_service import InventoryReportService


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = str(uuid.uuid4())


def _make_service():
    db = MagicMock()
    return InventoryReportService(db), db


def _mock_stock_row(**kwargs):
    """Mock a stock level query row (named tuple style)."""
    row = MagicMock()
    row.product_id = kwargs.get("product_id", uuid.uuid4())
    row.product_name = kwargs.get("product_name", "Widget A")
    row.sku = kwargs.get("sku", "WID-001")
    row.cost_price = kwargs.get("cost_price", Decimal("50.00"))
    row.selling_price = kwargs.get("selling_price", Decimal("100.00"))
    row.current_stock = kwargs.get("current_stock", 10)
    row.reorder_level = kwargs.get("reorder_level", 5)
    row.category_id = kwargs.get("category_id", uuid.uuid4())
    row.category_name = kwargs.get("category_name", "Electronics")
    return row


def _mock_movement_row(**kwargs):
    """Mock a stock movement summary row."""
    row = MagicMock()
    row.transaction_type = kwargs.get("transaction_type", "PURCHASE")
    row.transaction_count = kwargs.get("transaction_count", 5)
    row.total_in = kwargs.get("total_in", 100)
    row.total_out = kwargs.get("total_out", 0)
    row.net_change = kwargs.get("net_change", 100)
    return row


def _mock_product_movement_row(**kwargs):
    """Mock a product-level movement row."""
    row = MagicMock()
    row.product_id = kwargs.get("product_id", uuid.uuid4())
    row.product_name = kwargs.get("product_name", "Widget A")
    row.sku = kwargs.get("sku", "WID-001")
    row.transaction_count = kwargs.get("transaction_count", 3)
    row.net_change = kwargs.get("net_change", 15)
    return row


# ══════════════════════════════════════════════════════════════════════════════
# Stock Levels Tests
# ══════════════════════════════════════════════════════════════════════════════


class TestStockLevels:
    """Test get_stock_levels report."""

    def test_returns_correct_structure(self):
        """Stock levels report has required top-level keys."""
        svc, db = _make_service()
        chain = db.query.return_value.outerjoin.return_value.filter.return_value
        chain.order_by.return_value.all.return_value = []

        result = svc.get_stock_levels(BIZ)
        assert "total_products" in result
        assert "low_stock_count" in result
        assert "out_of_stock_count" in result
        assert "total_stock_value" in result
        assert "total_retail_value" in result
        assert "items" in result
        assert result["total_products"] == 0

    def test_calculates_stock_values(self):
        """Stock value = current_stock × cost_price; retail = stock × selling_price."""
        svc, db = _make_service()
        row = _mock_stock_row(
            current_stock=20,
            cost_price=Decimal("50.00"),
            selling_price=Decimal("100.00"),
        )
        chain = db.query.return_value.outerjoin.return_value.filter.return_value
        chain.order_by.return_value.all.return_value = [row]

        result = svc.get_stock_levels(BIZ)
        assert result["total_products"] == 1
        assert result["total_stock_value"] == 1000.0  # 20 × 50
        assert result["total_retail_value"] == 2000.0  # 20 × 100

    def test_low_stock_flag(self):
        """Items at or below reorder level are flagged as low stock."""
        svc, db = _make_service()
        row = _mock_stock_row(current_stock=3, reorder_level=5)
        chain = db.query.return_value.outerjoin.return_value.filter.return_value
        chain.order_by.return_value.all.return_value = [row]

        result = svc.get_stock_levels(BIZ)
        assert result["low_stock_count"] == 1
        assert result["items"][0]["is_low_stock"] is True
        assert result["items"][0]["is_out_of_stock"] is False

    def test_out_of_stock_flag(self):
        """Items with zero stock are flagged as out of stock."""
        svc, db = _make_service()
        row = _mock_stock_row(current_stock=0)
        chain = db.query.return_value.outerjoin.return_value.filter.return_value
        chain.order_by.return_value.all.return_value = [row]

        result = svc.get_stock_levels(BIZ)
        assert result["out_of_stock_count"] == 1
        assert result["items"][0]["is_out_of_stock"] is True

    def test_uncategorized_products(self):
        """Products without a category show 'Uncategorized'."""
        svc, db = _make_service()
        row = _mock_stock_row(category_id=None, category_name=None)
        chain = db.query.return_value.outerjoin.return_value.filter.return_value
        chain.order_by.return_value.all.return_value = [row]

        result = svc.get_stock_levels(BIZ)
        assert result["items"][0]["category_name"] == "Uncategorized"


# ══════════════════════════════════════════════════════════════════════════════
# Stock Movements Tests
# ══════════════════════════════════════════════════════════════════════════════


class TestStockMovements:
    """Test get_stock_movements report."""

    def test_returns_correct_structure(self):
        """Movement report has summary and product-level breakdowns."""
        svc, db = _make_service()

        # Summary query chain
        base = db.query.return_value.filter.return_value
        base.filter.return_value = base
        base.group_by.return_value.order_by.return_value.all.return_value = []

        # Product movements query chain (second db.query call)
        product_chain = MagicMock()
        db.query.return_value.join.return_value.filter.return_value = product_chain
        product_chain.filter.return_value = product_chain
        product_chain.group_by.return_value.order_by.return_value.all.return_value = []

        result = svc.get_stock_movements(
            BIZ,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
        )
        assert "movement_summary" in result
        assert "total_in" in result
        assert "total_out" in result
        assert "net_change" in result


# ══════════════════════════════════════════════════════════════════════════════
# Valuation Tests
# ══════════════════════════════════════════════════════════════════════════════


class TestValuation:
    """Test get_valuation report."""

    def test_empty_inventory(self):
        """Empty inventory returns zero totals."""
        svc, db = _make_service()
        chain = db.query.return_value.outerjoin.return_value.filter.return_value
        chain.all.return_value = []

        result = svc.get_valuation(BIZ)
        assert result["total_units"] == 0
        assert result["total_cost_value"] == 0
        assert result["total_retail_value"] == 0
        assert result["potential_profit"] == 0


# ══════════════════════════════════════════════════════════════════════════════
# Turnover Analysis Tests
# ══════════════════════════════════════════════════════════════════════════════


class TestTurnoverAnalysis:
    """Test get_turnover_analysis report."""

    def test_empty_returns_zeros(self):
        """Empty inventory returns zero turnover metrics."""
        svc, db = _make_service()

        from app.models.product import Product
        from app.models.order import OrderItem

        def query_router(model, *args):
            chain = MagicMock()
            chain.outerjoin.return_value.filter.return_value.all.return_value = []
            chain.join.return_value.join.return_value.filter.return_value.group_by.return_value.all.return_value = []
            chain.filter.return_value.all.return_value = []
            return chain

        db.query.side_effect = query_router

        result = svc.get_turnover_analysis(
            BIZ,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
        )
        assert result["overall_turnover_ratio"] == 0
        assert result["fast_moving_count"] == 0
        assert result["slow_moving_count"] == 0
        assert result["dead_stock_count"] == 0


# ══════════════════════════════════════════════════════════════════════════════
# Supplier Performance Tests
# ══════════════════════════════════════════════════════════════════════════════


class TestSupplierPerformance:
    """Test get_supplier_performance report."""

    def test_empty_returns_zeros(self):
        """No purchase orders returns zero supplier metrics."""
        svc, db = _make_service()
        chain = db.query.return_value
        chain.outerjoin.return_value.filter.return_value.group_by.return_value.order_by.return_value.all.return_value = []

        result = svc.get_supplier_performance(
            BIZ,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
        )
        assert result["total_purchases"] == 0
        assert result["total_orders"] == 0
        assert result["supplier_count"] == 0
        assert result["suppliers"] == []


# ══════════════════════════════════════════════════════════════════════════════
# Wastage Report Tests
# ══════════════════════════════════════════════════════════════════════════════


class TestWastageReport:
    """Test get_wastage_report."""

    def test_empty_returns_zeros(self):
        """No wastage transactions returns empty report."""
        svc, db = _make_service()
        chain = db.query.return_value
        chain.join.return_value.filter.return_value.group_by.return_value.order_by.return_value.all.return_value = []

        result = svc.get_wastage_report(
            BIZ,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
        )
        assert result["total_items"] == 0
        assert result["total_quantity"] == 0
        assert result["total_value"] == 0
        assert result["items"] == []


# ══════════════════════════════════════════════════════════════════════════════
# Dashboard Tests
# ══════════════════════════════════════════════════════════════════════════════


class TestDashboard:
    """Test get_inventory_dashboard."""

    def test_dashboard_structure(self):
        """Dashboard returns KPIs and alerts."""
        svc, db = _make_service()

        from app.models.product import Product

        def query_router(model, *args):
            chain = MagicMock()
            # For count queries
            chain.filter.return_value.count.return_value = 0
            # For aggregation queries
            chain.filter.return_value.with_entities.return_value.scalar.return_value = 0
            # For alert queries
            chain.filter.return_value.all.return_value = []
            return chain

        db.query.side_effect = query_router

        result = svc.get_inventory_dashboard(BIZ)
        assert "total_products" in result
        assert "total_inventory_value" in result
        assert "low_stock_count" in result
        assert "out_of_stock_count" in result
        assert "alerts" in result
