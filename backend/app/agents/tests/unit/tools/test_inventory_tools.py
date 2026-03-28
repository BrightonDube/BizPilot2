"""
Unit tests for inventory_tools.

Tests: happy path, no business error, empty low-stock list.
"""

import pytest
from unittest.mock import patch, MagicMock

from app.agents.tools.inventory_tools import get_inventory_summary, get_low_stock_items


@pytest.mark.asyncio
async def test_get_inventory_summary_happy_path(mock_db, sample_user, sample_business):
    with patch("app.agents.tools.inventory_tools.get_business_id_for_user",
               return_value=str(sample_business.id)), \
         patch("app.agents.tools.inventory_tools.InventoryService") as mock_svc_cls:

        mock_svc_cls.return_value.get_inventory_summary.return_value = {
            "total_items": 50, "low_stock_count": 5, "total_value": 12000.0
        }

        result = await get_inventory_summary(db=mock_db, user=sample_user)

        assert "error" not in result


@pytest.mark.asyncio
async def test_get_inventory_summary_no_business(mock_db, sample_user):
    with patch("app.agents.tools.inventory_tools.get_business_id_for_user",
               return_value=None):

        result = await get_inventory_summary(db=mock_db, user=sample_user)

        assert "error" in result


@pytest.mark.asyncio
async def test_get_low_stock_items_happy_path(mock_db, sample_user, sample_business):
    with patch("app.agents.tools.inventory_tools.get_business_id_for_user",
               return_value=str(sample_business.id)), \
         patch("app.agents.tools.inventory_tools.InventoryService") as mock_svc_cls:

        item = MagicMock()
        item.product_id = "prod-1"
        item.quantity_on_hand = 2
        item.reorder_point = 10
        item.location = "Shelf A"
        mock_svc_cls.return_value.get_low_stock_items.return_value = [item]

        result = await get_low_stock_items(db=mock_db, user=sample_user)

        assert result["low_stock_count"] == 1
        assert result["items"][0]["quantity_on_hand"] == 2


@pytest.mark.asyncio
async def test_get_low_stock_items_no_business(mock_db, sample_user):
    with patch("app.agents.tools.inventory_tools.get_business_id_for_user",
               return_value=None):

        result = await get_low_stock_items(db=mock_db, user=sample_user)

        assert "error" in result


@pytest.mark.asyncio
async def test_get_low_stock_items_empty_list(mock_db, sample_user, sample_business):
    with patch("app.agents.tools.inventory_tools.get_business_id_for_user",
               return_value=str(sample_business.id)), \
         patch("app.agents.tools.inventory_tools.InventoryService") as mock_svc_cls:

        mock_svc_cls.return_value.get_low_stock_items.return_value = []

        result = await get_low_stock_items(db=mock_db, user=sample_user)

        assert result["low_stock_count"] == 0
        assert result["items"] == []
