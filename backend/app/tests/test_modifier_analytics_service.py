"""Unit tests for ModifierAnalyticsService.

Covers modifier selection frequency, modifier revenue, combo performance,
modifier rankings (all ordering modes), and the summary dashboard endpoint.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")

import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.services.modifier_analytics_service import ModifierAnalyticsService


BIZ_ID = str(uuid.uuid4())
PRODUCT_ID = str(uuid.uuid4())
LOCATION_ID = str(uuid.uuid4())


def _chain(first=None, rows=None, count=0, scalar=None):
    """Reusable mock that supports the common SQLAlchemy chained-call pattern."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.group_by.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = scalar
    return c


def _make_freq_row(modifier_name, group_name, selection_count):
    """Build a mock row returned by selection-frequency queries."""
    row = MagicMock()
    row.modifier_name = modifier_name
    row.group_name = group_name
    row.selection_count = selection_count
    return row


def _make_revenue_row(modifier_name, group_name, total_revenue, selection_count):
    row = MagicMock()
    row.modifier_name = modifier_name
    row.group_name = group_name
    row.total_revenue = total_revenue
    row.selection_count = selection_count
    return row


def _make_ranking_row(modifier_name, group_name, selection_count, total_revenue, avg_price):
    row = MagicMock()
    row.modifier_name = modifier_name
    row.group_name = group_name
    row.selection_count = selection_count
    row.total_revenue = total_revenue
    row.avg_price = avg_price
    return row


def _make_combo(combo_id, display_name, combo_price, original_price, is_active=True, sort_order=0):
    combo = MagicMock()
    combo.id = combo_id
    combo.display_name = display_name
    combo.combo_price = combo_price
    combo.original_price = original_price
    combo.is_active = is_active
    combo.sort_order = sort_order
    return combo


def _make_summary_totals(total_selections, total_revenue):
    row = MagicMock()
    row.total_selections = total_selections
    row.total_revenue = total_revenue
    return row


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def svc(db):
    return ModifierAnalyticsService(db)


# ── Modifier Selection Frequency ─────────────────────────────────


class TestGetModifierSelectionFrequency:
    def test_returns_formatted_rows(self, svc, db):
        rows = [
            _make_freq_row("Extra Cheese", "Toppings", 42),
            _make_freq_row("Bacon", "Toppings", 30),
        ]
        db.query.return_value = _chain(rows=rows)

        result = svc.get_modifier_selection_frequency(BIZ_ID)

        assert len(result) == 2
        assert result[0] == {
            "modifier_name": "Extra Cheese",
            "group_name": "Toppings",
            "selection_count": 42,
        }
        assert result[1]["modifier_name"] == "Bacon"

    def test_returns_empty_list_when_no_data(self, svc, db):
        db.query.return_value = _chain(rows=[])
        result = svc.get_modifier_selection_frequency(BIZ_ID)
        assert result == []

    def test_respects_limit_parameter(self, svc, db):
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.get_modifier_selection_frequency(BIZ_ID, limit=5)
        chain.limit.assert_called_with(5)

    def test_applies_date_filters(self, svc, db):
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.get_modifier_selection_frequency(
            BIZ_ID,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        # Two additional .filter() calls for date range
        assert chain.filter.call_count >= 2

    def test_applies_product_id_filter(self, svc, db):
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.get_modifier_selection_frequency(BIZ_ID, product_id=PRODUCT_ID)
        # At least the initial filter + product_id filter
        assert chain.filter.call_count >= 2

    def test_default_limit_is_20(self, svc, db):
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.get_modifier_selection_frequency(BIZ_ID)
        chain.limit.assert_called_with(20)


# ── Modifier Revenue ─────────────────────────────────────────────


class TestGetModifierRevenue:
    def test_returns_formatted_rows(self, svc, db):
        rows = [
            _make_revenue_row("Extra Cheese", "Toppings", Decimal("420.00"), 42),
            _make_revenue_row("Bacon", "Toppings", Decimal("300.00"), 30),
        ]
        db.query.return_value = _chain(rows=rows)

        result = svc.get_modifier_revenue(BIZ_ID)

        assert len(result) == 2
        assert result[0] == {
            "modifier_name": "Extra Cheese",
            "group_name": "Toppings",
            "total_revenue": 420.00,
            "selection_count": 42,
        }

    def test_handles_null_revenue(self, svc, db):
        rows = [_make_revenue_row("Sauce", "Extras", None, 5)]
        db.query.return_value = _chain(rows=rows)

        result = svc.get_modifier_revenue(BIZ_ID)
        assert result[0]["total_revenue"] == 0.0

    def test_returns_empty_list(self, svc, db):
        db.query.return_value = _chain(rows=[])
        result = svc.get_modifier_revenue(BIZ_ID)
        assert result == []

    def test_applies_date_filters(self, svc, db):
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.get_modifier_revenue(
            BIZ_ID,
            start_date=date(2024, 6, 1),
            end_date=date(2024, 6, 30),
        )
        assert chain.filter.call_count >= 2

    def test_respects_limit(self, svc, db):
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.get_modifier_revenue(BIZ_ID, limit=10)
        chain.limit.assert_called_with(10)


# ── Combo Performance ────────────────────────────────────────────


class TestGetComboPerformance:
    def test_returns_formatted_combos(self, svc, db):
        c1_id = uuid.uuid4()
        combos = [
            _make_combo(c1_id, "Family Meal", Decimal("99.99"), Decimal("129.99")),
        ]
        db.query.return_value = _chain(rows=combos)

        result = svc.get_combo_performance(BIZ_ID)

        assert len(result) == 1
        assert result[0]["combo_id"] == str(c1_id)
        assert result[0]["name"] == "Family Meal"
        assert result[0]["combo_price"] == 99.99
        assert result[0]["original_price"] == 129.99
        assert result[0]["savings_per_combo"] == pytest.approx(30.00)
        assert result[0]["is_active"] is True

    def test_returns_empty_list(self, svc, db):
        db.query.return_value = _chain(rows=[])
        result = svc.get_combo_performance(BIZ_ID)
        assert result == []

    def test_respects_limit(self, svc, db):
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.get_combo_performance(BIZ_ID, limit=3)
        chain.limit.assert_called_with(3)

    def test_savings_calculation_is_accurate(self, svc, db):
        c_id = uuid.uuid4()
        combos = [
            _make_combo(c_id, "Burger Combo", Decimal("49.50"), Decimal("65.00")),
        ]
        db.query.return_value = _chain(rows=combos)

        result = svc.get_combo_performance(BIZ_ID)
        assert result[0]["savings_per_combo"] == pytest.approx(15.50)


# ── Modifier Rankings ────────────────────────────────────────────


class TestGetModifierRankings:
    def _rows(self):
        return [
            _make_ranking_row("Extra Cheese", "Toppings", 100, Decimal("1000.00"), Decimal("10.00")),
            _make_ranking_row("Bacon", "Toppings", 80, Decimal("960.00"), Decimal("12.00")),
            _make_ranking_row("Lettuce", "Veggies", 50, Decimal("250.00"), Decimal("5.00")),
        ]

    def test_popular_order_returns_ranks(self, svc, db):
        db.query.return_value = _chain(rows=self._rows())

        result = svc.get_modifier_rankings(BIZ_ID, order_by="popular")

        assert len(result) == 3
        assert result[0]["rank"] == 1
        assert result[1]["rank"] == 2
        assert result[2]["rank"] == 3
        assert result[0]["modifier_name"] == "Extra Cheese"

    def test_unpopular_order(self, svc, db):
        chain = _chain(rows=self._rows())
        db.query.return_value = chain

        svc.get_modifier_rankings(BIZ_ID, order_by="unpopular")
        # verify order_by was called (chain is mocked, so just confirm call happened)
        chain.order_by.assert_called()

    def test_revenue_order(self, svc, db):
        chain = _chain(rows=self._rows())
        db.query.return_value = chain

        svc.get_modifier_rankings(BIZ_ID, order_by="revenue")
        chain.order_by.assert_called()

    def test_aov_impact_falls_through_to_popular(self, svc, db):
        chain = _chain(rows=self._rows())
        db.query.return_value = chain

        svc.get_modifier_rankings(BIZ_ID, order_by="aov_impact")
        chain.order_by.assert_called()

    def test_handles_null_revenue_and_avg(self, svc, db):
        rows = [_make_ranking_row("Plain", "Basic", 5, None, None)]
        db.query.return_value = _chain(rows=rows)

        result = svc.get_modifier_rankings(BIZ_ID)
        assert result[0]["total_revenue"] == 0.0
        assert result[0]["avg_price"] == 0.0

    def test_returns_empty_list(self, svc, db):
        db.query.return_value = _chain(rows=[])
        result = svc.get_modifier_rankings(BIZ_ID)
        assert result == []

    def test_default_limit_is_10(self, svc, db):
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.get_modifier_rankings(BIZ_ID)
        chain.limit.assert_called_with(10)

    def test_date_filter_applied(self, svc, db):
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.get_modifier_rankings(
            BIZ_ID,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 3, 31),
        )
        assert chain.filter.call_count >= 2


# ── Summary Stats ────────────────────────────────────────────────


class TestGetModifierSummary:
    def _side_effect(self, totals_row, mod_order_count, total_orders):
        """Build db.query side_effect for the three queries in get_modifier_summary."""
        calls = iter([
            _chain(first=totals_row),           # totals query
            _chain(scalar=mod_order_count),      # orders with modifiers
            _chain(scalar=total_orders),         # total orders
        ])

        def _se(*args):
            return next(calls)

        return _se

    def test_returns_all_summary_fields(self, svc, db):
        totals = _make_summary_totals(150, Decimal("3000.00"))
        db.query.side_effect = self._side_effect(totals, 80, 200)

        result = svc.get_modifier_summary(BIZ_ID)

        assert result["total_selections"] == 150
        assert result["total_revenue"] == 3000.00
        assert result["orders_with_modifiers"] == 80
        assert result["total_orders"] == 200
        assert result["modifier_adoption_rate"] == 40.0

    def test_zero_orders_returns_zero_adoption(self, svc, db):
        totals = _make_summary_totals(0, Decimal("0"))
        db.query.side_effect = self._side_effect(totals, 0, 0)

        result = svc.get_modifier_summary(BIZ_ID)

        assert result["modifier_adoption_rate"] == 0
        assert result["total_orders"] == 0

    def test_all_orders_have_modifiers(self, svc, db):
        totals = _make_summary_totals(50, Decimal("500.00"))
        db.query.side_effect = self._side_effect(totals, 50, 50)

        result = svc.get_modifier_summary(BIZ_ID)
        assert result["modifier_adoption_rate"] == 100.0

    def test_handles_none_totals(self, svc, db):
        db.query.side_effect = self._side_effect(None, 0, 0)

        result = svc.get_modifier_summary(BIZ_ID)
        assert result["total_selections"] == 0
        assert result["total_revenue"] == 0.0

    def test_adoption_rate_rounds_to_one_decimal(self, svc, db):
        totals = _make_summary_totals(33, Decimal("330.00"))
        db.query.side_effect = self._side_effect(totals, 33, 100)

        result = svc.get_modifier_summary(BIZ_ID)
        assert result["modifier_adoption_rate"] == 33.0

    def test_with_date_filters(self, svc, db):
        totals = _make_summary_totals(10, Decimal("100.00"))
        db.query.side_effect = self._side_effect(totals, 5, 20)

        result = svc.get_modifier_summary(
            BIZ_ID,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
        )
        assert result["modifier_adoption_rate"] == 25.0

    def test_null_scalar_returns_zero(self, svc, db):
        totals = _make_summary_totals(10, Decimal("100.00"))
        db.query.side_effect = self._side_effect(totals, None, None)

        result = svc.get_modifier_summary(BIZ_ID)
        assert result["orders_with_modifiers"] == 0
        assert result["total_orders"] == 0
        assert result["modifier_adoption_rate"] == 0
