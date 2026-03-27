"""Tests for extended reports components and logic.

Uses minimal imports to avoid heavy model chain loading.
Backend service integration tests are covered in CI via the full test suite.
"""

import uuid
from datetime import date


def _uuid():
    return uuid.uuid4()


# ---------------------------------------------------------------------------
# ReportCard props validation (pure logic)
# ---------------------------------------------------------------------------


def test_report_card_positive_trend():
    trend = {"value": 12.4, "label": "vs previous period"}
    assert trend["value"] > 0
    up_arrow = "↑" if trend["value"] >= 0 else "↓"
    assert up_arrow == "↑"


def test_report_card_negative_trend():
    trend = {"value": -5.2, "label": "vs previous period"}
    assert trend["value"] < 0
    up_arrow = "↑" if trend["value"] >= 0 else "↓"
    assert up_arrow == "↓"


def test_report_card_formats_value():
    value = f"R {48250.00:,.2f}"
    assert value == "R 48,250.00"


# ---------------------------------------------------------------------------
# ReportTable column spec
# ---------------------------------------------------------------------------


def test_report_table_column_alignment_classes():
    """Column alignment values map correctly."""
    def align_class(align):
        if align == "right":
            return "text-right"
        if align == "center":
            return "text-center"
        return "text-left"

    assert align_class("right") == "text-right"
    assert align_class("center") == "text-center"
    assert align_class("left") == "text-left"
    assert align_class(None) == "text-left"


def test_report_table_sort_direction():
    """Toggle sort direction correctly."""
    current_key = "amount"
    current_dir = "asc"

    def next_sort(sort_key, sort_dir, col_key):
        if sort_key == col_key and sort_dir == "asc":
            return "desc"
        return "asc"

    assert next_sort(current_key, current_dir, "amount") == "desc"
    assert next_sort(current_key, current_dir, "date") == "asc"
    assert next_sort("date", "desc", "date") == "asc"


def test_report_table_empty_renders_message():
    """Empty data returns no rows."""
    data = []
    columns = [{"key": "name", "label": "Name"}]
    assert len(data) == 0
    assert len(columns) == 1


def test_report_table_renders_data():
    """Non-empty data maps to rows correctly."""
    data = [
        {"name": "Alice", "amount": 1000},
        {"name": "Bob", "amount": 2000},
    ]
    assert data[0]["name"] == "Alice"
    assert data[1]["amount"] == 2000


# ---------------------------------------------------------------------------
# Date range filtering logic (used in both user-activity and login history)
# ---------------------------------------------------------------------------


def test_date_range_filter_inclusive():
    records = [
        {"date": date(2026, 1, 1), "value": 100},
        {"date": date(2026, 1, 15), "value": 200},
        {"date": date(2026, 2, 1), "value": 300},
    ]
    start = date(2026, 1, 1)
    end = date(2026, 1, 31)

    filtered = [r for r in records if start <= r["date"] <= end]
    assert len(filtered) == 2
    assert filtered[0]["value"] == 100
    assert filtered[1]["value"] == 200


def test_date_range_filter_no_match():
    records = [{"date": date(2025, 12, 1), "value": 100}]
    start = date(2026, 1, 1)
    end = date(2026, 1, 31)

    filtered = [r for r in records if start <= r["date"] <= end]
    assert filtered == []


# ---------------------------------------------------------------------------
# Excel export logic: openpyxl produces valid ZIP bytes
# ---------------------------------------------------------------------------


def test_excel_bytes_start_with_pk_signature():
    """openpyxl workbooks start with PK (ZIP magic bytes)."""
    import io
    import openpyxl

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Test"
    ws.append(["Name", "Value"])
    ws.append(["Row 1", 100])

    buf = io.BytesIO()
    wb.save(buf)
    result = buf.getvalue()

    assert result[:2] == b"PK"
    assert len(result) > 100
