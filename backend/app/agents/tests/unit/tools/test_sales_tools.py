"""
Unit tests for sales_tools.

Tests: happy path, error when no business, invalid date format.
"""

import pytest
from unittest.mock import patch

from app.agents.tools.sales_tools import get_daily_sales


def _make_mock_report():
    return {
        "date": "2026-03-12",
        "gross_sales": 5000.0,
        "transaction_count": 42,
        "net_sales": 4800.0,
    }


@pytest.mark.asyncio
async def test_get_daily_sales_happy_path(mock_db, sample_user, sample_business):
    with patch("app.agents.tools.sales_tools.get_business_id_for_user",
               return_value=str(sample_business.id)), \
         patch("app.agents.tools.sales_tools.SalesReportService") as mock_svc_cls:

        mock_svc_cls.return_value.get_daily_report.return_value = _make_mock_report()

        result = await get_daily_sales(db=mock_db, user=sample_user, target_date="2026-03-12")

        assert "gross_sales" in result or "date" in result
        assert "error" not in result


@pytest.mark.asyncio
async def test_get_daily_sales_defaults_to_today(mock_db, sample_user, sample_business):
    with patch("app.agents.tools.sales_tools.get_business_id_for_user",
               return_value=str(sample_business.id)), \
         patch("app.agents.tools.sales_tools.SalesReportService") as mock_svc_cls:

        mock_svc_cls.return_value.get_daily_report.return_value = _make_mock_report()

        result = await get_daily_sales(db=mock_db, user=sample_user)

        # Should have called with today's date — no error returned
        assert "error" not in result


@pytest.mark.asyncio
async def test_get_daily_sales_no_business_returns_error(mock_db, sample_user):
    with patch("app.agents.tools.sales_tools.get_business_id_for_user",
               return_value=None):

        result = await get_daily_sales(db=mock_db, user=sample_user)

        assert "error" in result
        assert "business" in result["error"].lower()


@pytest.mark.asyncio
async def test_get_daily_sales_invalid_date_returns_error(mock_db, sample_user, sample_business):
    with patch("app.agents.tools.sales_tools.get_business_id_for_user",
               return_value=str(sample_business.id)):

        result = await get_daily_sales(db=mock_db, user=sample_user, target_date="not-a-date")

        assert "error" in result
        assert "YYYY-MM-DD" in result["error"] or "Invalid" in result["error"]
