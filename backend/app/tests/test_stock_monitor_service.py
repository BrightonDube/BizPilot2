"""Unit tests for StockMonitorService."""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import math
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.models.product import Product
from app.models.reorder import ProductReorderSettings
from app.services.stock_monitor_service import StockMonitorService


BIZ_ID = uuid4()
PRODUCT_ID = uuid4()
SUPPLIER_ID = uuid4()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _svc():
    db = MagicMock()
    return StockMonitorService(db), db


def _chain(first=None, rows=None, count=0):
    """Helper to create fluent query chain mocks."""
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.join = MagicMock(return_value=q)
    q.order_by = MagicMock(return_value=q)
    q.offset = MagicMock(return_value=q)
    q.limit = MagicMock(return_value=q)
    q.all = MagicMock(return_value=rows or [])
    q.first = MagicMock(return_value=first)
    q.count = MagicMock(return_value=count)
    q.scalar = MagicMock(return_value=0)
    return q


def _make_product(**overrides):
    p = MagicMock(spec=Product)
    p.id = overrides.get("id", PRODUCT_ID)
    p.business_id = overrides.get("business_id", str(BIZ_ID))
    p.name = overrides.get("name", "Widget")
    p.quantity = overrides.get("quantity", 10)
    p.deleted_at = overrides.get("deleted_at", None)
    return p


def _make_settings(**overrides):
    s = MagicMock(spec=ProductReorderSettings)
    s.product_id = overrides.get("product_id", PRODUCT_ID)
    s.business_id = overrides.get("business_id", str(BIZ_ID))
    s.reorder_point = overrides.get("reorder_point", 20)
    s.safety_stock = overrides.get("safety_stock", 5)
    s.auto_reorder = overrides.get("auto_reorder", False)
    s.preferred_supplier_id = overrides.get("preferred_supplier_id", SUPPLIER_ID)
    return s


# ===================================================================
# get_low_stock_items
# ===================================================================


class TestGetLowStockItems:
    """Tests for StockMonitorService.get_low_stock_items."""

    def test_single_low_stock_item(self):
        svc, db = _svc()
        product = _make_product(quantity=5)
        settings = _make_settings(reorder_point=20)
        chain = _chain(rows=[(product, settings)], count=1)
        db.query.return_value = chain

        results, total = svc.get_low_stock_items(BIZ_ID)

        assert total == 1
        assert len(results) == 1
        item = results[0]
        assert item["product_id"] == str(PRODUCT_ID)
        assert item["product_name"] == "Widget"
        assert item["current_stock"] == 5
        assert item["reorder_point"] == 20
        assert item["safety_stock"] == 5
        assert item["auto_reorder"] is False
        assert item["preferred_supplier_id"] == str(SUPPLIER_ID)

    def test_empty_results(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        results, total = svc.get_low_stock_items(BIZ_ID)

        assert total == 0
        assert results == []

    def test_multiple_low_stock_items(self):
        svc, db = _svc()
        pid1, pid2 = uuid4(), uuid4()
        p1 = _make_product(id=pid1, name="Item A", quantity=3)
        s1 = _make_settings(product_id=pid1, reorder_point=10, safety_stock=2)
        p2 = _make_product(id=pid2, name="Item B", quantity=0)
        s2 = _make_settings(product_id=pid2, reorder_point=5, safety_stock=1)
        chain = _chain(rows=[(p1, s1), (p2, s2)], count=2)
        db.query.return_value = chain

        results, total = svc.get_low_stock_items(BIZ_ID)

        assert total == 2
        assert len(results) == 2
        assert results[0]["product_name"] == "Item A"
        assert results[1]["product_name"] == "Item B"

    def test_no_preferred_supplier(self):
        svc, db = _svc()
        product = _make_product()
        settings = _make_settings(preferred_supplier_id=None)
        chain = _chain(rows=[(product, settings)], count=1)
        db.query.return_value = chain

        results, _ = svc.get_low_stock_items(BIZ_ID)

        assert results[0]["preferred_supplier_id"] is None

    def test_stock_quantity_none_defaults_to_zero(self):
        """If product.quantity is None, current_stock should be 0."""
        svc, db = _svc()
        product = _make_product(quantity=None)
        settings = _make_settings()
        chain = _chain(rows=[(product, settings)], count=1)
        db.query.return_value = chain

        results, _ = svc.get_low_stock_items(BIZ_ID)

        assert results[0]["current_stock"] == 0

    def test_pagination_defaults(self):
        """page=1, per_page=20 should offset(0).limit(20)."""
        svc, db = _svc()
        chain = _chain(count=0)
        db.query.return_value = chain

        svc.get_low_stock_items(BIZ_ID)

        chain.offset.assert_called_once_with(0)
        chain.limit.assert_called_once_with(20)

    def test_pagination_page_2(self):
        svc, db = _svc()
        chain = _chain(count=0)
        db.query.return_value = chain

        svc.get_low_stock_items(BIZ_ID, page=2, per_page=10)

        chain.offset.assert_called_once_with(10)
        chain.limit.assert_called_once_with(10)

    def test_pagination_page_3_per_page_5(self):
        svc, db = _svc()
        chain = _chain(count=0)
        db.query.return_value = chain

        svc.get_low_stock_items(BIZ_ID, page=3, per_page=5)

        chain.offset.assert_called_once_with(10)
        chain.limit.assert_called_once_with(5)

    def test_auto_reorder_true(self):
        svc, db = _svc()
        product = _make_product()
        settings = _make_settings(auto_reorder=True)
        chain = _chain(rows=[(product, settings)], count=1)
        db.query.return_value = chain

        results, _ = svc.get_low_stock_items(BIZ_ID)

        assert results[0]["auto_reorder"] is True


# ===================================================================
# calculate_sales_velocity
# ===================================================================


class TestCalculateSalesVelocity:
    """Tests for StockMonitorService.calculate_sales_velocity."""

    def test_normal_velocity(self):
        svc, db = _svc()
        chain = _chain()
        chain.scalar.return_value = 150
        db.query.return_value = chain

        result = svc.calculate_sales_velocity(PRODUCT_ID, BIZ_ID, lookback_days=30)

        assert result == round(150 / 30, 2)  # 5.0

    def test_zero_sales(self):
        svc, db = _svc()
        chain = _chain()
        chain.scalar.return_value = 0
        db.query.return_value = chain

        result = svc.calculate_sales_velocity(PRODUCT_ID, BIZ_ID)

        assert result == 0.0

    def test_lookback_days_zero(self):
        """lookback_days <= 0 should return 0.0 immediately."""
        svc, db = _svc()
        chain = _chain()
        chain.scalar.return_value = 100
        db.query.return_value = chain

        result = svc.calculate_sales_velocity(PRODUCT_ID, BIZ_ID, lookback_days=0)

        assert result == 0.0

    def test_lookback_days_negative(self):
        svc, db = _svc()
        chain = _chain()
        chain.scalar.return_value = 50
        db.query.return_value = chain

        result = svc.calculate_sales_velocity(PRODUCT_ID, BIZ_ID, lookback_days=-5)

        assert result == 0.0

    def test_fractional_velocity(self):
        svc, db = _svc()
        chain = _chain()
        chain.scalar.return_value = 10
        db.query.return_value = chain

        result = svc.calculate_sales_velocity(PRODUCT_ID, BIZ_ID, lookback_days=30)

        assert result == round(10 / 30, 2)  # 0.33

    def test_decimal_total_sold(self):
        """func.sum may return a Decimal; ensure float conversion works."""
        svc, db = _svc()
        chain = _chain()
        chain.scalar.return_value = Decimal("300")
        db.query.return_value = chain

        result = svc.calculate_sales_velocity(PRODUCT_ID, BIZ_ID, lookback_days=30)

        assert result == 10.0
        assert isinstance(result, float)

    def test_custom_lookback_days(self):
        svc, db = _svc()
        chain = _chain()
        chain.scalar.return_value = 70
        db.query.return_value = chain

        result = svc.calculate_sales_velocity(PRODUCT_ID, BIZ_ID, lookback_days=7)

        assert result == 10.0

    def test_query_chain_calls(self):
        """Ensure join and filter are called on the query chain."""
        svc, db = _svc()
        chain = _chain()
        chain.scalar.return_value = 0
        db.query.return_value = chain

        svc.calculate_sales_velocity(PRODUCT_ID, BIZ_ID)

        chain.join.assert_called_once()
        chain.filter.assert_called_once()


# ===================================================================
# calculate_stockout_date
# ===================================================================


class TestCalculateStockoutDate:
    """Tests for StockMonitorService.calculate_stockout_date."""

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_with_explicit_stock_positive_velocity(self, mock_vel):
        mock_vel.return_value = 5.0
        svc, db = _svc()

        result = svc.calculate_stockout_date(
            PRODUCT_ID, BIZ_ID, current_stock=100
        )

        assert result == math.ceil(100 / 5.0)  # 20
        mock_vel.assert_called_once_with(
            PRODUCT_ID, BIZ_ID, lookback_days=30
        )

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_with_explicit_stock_zero_velocity(self, mock_vel):
        """Zero velocity => None (no sales, can't project)."""
        mock_vel.return_value = 0.0
        svc, _ = _svc()

        result = svc.calculate_stockout_date(
            PRODUCT_ID, BIZ_ID, current_stock=50
        )

        assert result is None

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_with_explicit_stock_negative_velocity(self, mock_vel):
        mock_vel.return_value = -1.0
        svc, _ = _svc()

        result = svc.calculate_stockout_date(
            PRODUCT_ID, BIZ_ID, current_stock=50
        )

        assert result is None

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_stock_none_fetches_from_db(self, mock_vel):
        """When current_stock is None, product is fetched from the database."""
        mock_vel.return_value = 2.0
        svc, db = _svc()
        product = _make_product(quantity=40)
        chain = _chain(first=product)
        db.query.return_value = chain

        result = svc.calculate_stockout_date(PRODUCT_ID, BIZ_ID)

        assert result == math.ceil(40 / 2.0)  # 20
        db.query.assert_called_once()

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_stock_none_product_not_found(self, mock_vel):
        """Product not found in DB => return None without calling velocity."""
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.calculate_stockout_date(PRODUCT_ID, BIZ_ID)

        assert result is None
        mock_vel.assert_not_called()

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_stock_none_product_stock_is_none(self, mock_vel):
        """Product exists but stock_quantity is None => treated as 0."""
        mock_vel.return_value = 3.0
        svc, db = _svc()
        product = _make_product(quantity=None)
        chain = _chain(first=product)
        db.query.return_value = chain

        result = svc.calculate_stockout_date(PRODUCT_ID, BIZ_ID)

        # current_stock = 0, velocity = 3.0 => ceil(0/3) = 0
        assert result == 0

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_fractional_days_rounded_up(self, mock_vel):
        """math.ceil should round up fractional day counts."""
        mock_vel.return_value = 3.0
        svc, _ = _svc()

        result = svc.calculate_stockout_date(
            PRODUCT_ID, BIZ_ID, current_stock=10
        )

        # 10 / 3.0 = 3.33 => ceil => 4
        assert result == 4

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_exact_division(self, mock_vel):
        mock_vel.return_value = 5.0
        svc, _ = _svc()

        result = svc.calculate_stockout_date(
            PRODUCT_ID, BIZ_ID, current_stock=25
        )

        assert result == 5

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_custom_lookback_days_passed(self, mock_vel):
        mock_vel.return_value = 1.0
        svc, _ = _svc()

        svc.calculate_stockout_date(
            PRODUCT_ID, BIZ_ID, current_stock=10, lookback_days=60
        )

        mock_vel.assert_called_once_with(
            PRODUCT_ID, BIZ_ID, lookback_days=60
        )

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_zero_stock_positive_velocity(self, mock_vel):
        """Zero stock with positive velocity => 0 days to stockout."""
        mock_vel.return_value = 5.0
        svc, _ = _svc()

        result = svc.calculate_stockout_date(
            PRODUCT_ID, BIZ_ID, current_stock=0
        )

        assert result == 0

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_large_stock_small_velocity(self, mock_vel):
        mock_vel.return_value = 0.01
        svc, _ = _svc()

        result = svc.calculate_stockout_date(
            PRODUCT_ID, BIZ_ID, current_stock=1000
        )

        assert result == math.ceil(1000 / 0.01)  # 100000


# ===================================================================
# suggest_reorder_point
# ===================================================================


class TestSuggestReorderPoint:
    """Tests for StockMonitorService.suggest_reorder_point."""

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_default_parameters(self, mock_vel):
        mock_vel.return_value = 5.0
        svc, _ = _svc()

        result = svc.suggest_reorder_point(PRODUCT_ID, BIZ_ID)

        # velocity=5 * lead_time=7 * safety_factor=1.5 = 52.5 => ceil => 53
        assert result == math.ceil(5.0 * 7 * 1.5)
        assert result == 53

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_custom_lead_time(self, mock_vel):
        mock_vel.return_value = 10.0
        svc, _ = _svc()

        result = svc.suggest_reorder_point(
            PRODUCT_ID, BIZ_ID, lead_time_days=14
        )

        # 10 * 14 * 1.5 = 210
        assert result == 210

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_custom_safety_factor(self, mock_vel):
        mock_vel.return_value = 4.0
        svc, _ = _svc()

        result = svc.suggest_reorder_point(
            PRODUCT_ID, BIZ_ID, safety_factor=2.0
        )

        # 4 * 7 * 2.0 = 56
        assert result == 56

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_zero_velocity(self, mock_vel):
        """Zero sales => reorder point is 0."""
        mock_vel.return_value = 0.0
        svc, _ = _svc()

        result = svc.suggest_reorder_point(PRODUCT_ID, BIZ_ID)

        assert result == 0

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_fractional_result_rounded_up(self, mock_vel):
        mock_vel.return_value = 0.33
        svc, _ = _svc()

        result = svc.suggest_reorder_point(PRODUCT_ID, BIZ_ID)

        # 0.33 * 7 * 1.5 = 3.465 => ceil => 4
        assert result == math.ceil(0.33 * 7 * 1.5)
        assert result == 4

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_custom_lookback_days_forwarded(self, mock_vel):
        mock_vel.return_value = 1.0
        svc, _ = _svc()

        svc.suggest_reorder_point(PRODUCT_ID, BIZ_ID, lookback_days=60)

        mock_vel.assert_called_once_with(
            PRODUCT_ID, BIZ_ID, lookback_days=60
        )

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_all_custom_parameters(self, mock_vel):
        mock_vel.return_value = 8.0
        svc, _ = _svc()

        result = svc.suggest_reorder_point(
            PRODUCT_ID,
            BIZ_ID,
            lead_time_days=3,
            safety_factor=1.0,
            lookback_days=14,
        )

        # 8 * 3 * 1.0 = 24
        assert result == 24
        mock_vel.assert_called_once_with(
            PRODUCT_ID, BIZ_ID, lookback_days=14
        )

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_high_velocity_high_lead_time(self, mock_vel):
        mock_vel.return_value = 50.0
        svc, _ = _svc()

        result = svc.suggest_reorder_point(
            PRODUCT_ID, BIZ_ID, lead_time_days=30, safety_factor=2.0
        )

        # 50 * 30 * 2.0 = 3000
        assert result == 3000

    @patch.object(StockMonitorService, "calculate_sales_velocity")
    def test_safety_factor_less_than_one(self, mock_vel):
        """Safety factor < 1 reduces the reorder point below raw lead-time demand."""
        mock_vel.return_value = 10.0
        svc, _ = _svc()

        result = svc.suggest_reorder_point(
            PRODUCT_ID, BIZ_ID, safety_factor=0.5
        )

        # 10 * 7 * 0.5 = 35
        assert result == 35
