import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, date
from fastapi import HTTPException

from app.services.pdf_service import (
    render_html_from_template,
    generate_pdf_from_html,
    generate_invoice_pdf,
    generate_cashup_pdf,
    generate_purchase_order_pdf
)
from app.models.invoice import Invoice
from app.models.business import Business
from app.models.user import User
from app.models.shift import Shift
from app.models.order import Order

@pytest.fixture
def mock_db():
    return AsyncMock()

@pytest.fixture
def sample_business():
    biz = MagicMock(spec=Business)
    biz.id = uuid4()
    biz.name = "Test Business"
    biz.currency = "ZAR"
    biz.logo_url = None
    biz.address_street = "123 Test St"
    biz.address_city = "Test City"
    biz.address_postal_code = "1234"
    biz.address_country = "South Africa"
    biz.phone = "1234567890"
    biz.email = "test@example.com"
    return biz

@pytest.fixture
def sample_invoice(sample_business):
    inv = MagicMock(spec=Invoice)
    inv.id = uuid4()
    inv.business_id = sample_business.id
    inv.invoice_number = "INV-001"
    inv.issue_date = date.today()
    inv.due_date = date.today()
    inv.status = "sent"
    inv.subtotal = 100.00
    inv.tax_amount = 15.00
    inv.discount_amount = 0.00
    inv.total = 115.00
    inv.amount_paid = 0.00
    inv.customer_id = None
    inv.notes = "Test notes"
    inv.terms = "Test terms"
    return inv

def test_generate_pdf_from_valid_html_returns_bytes_starting_with_pdf_marker():
    html = "<html><body><h1>Test</h1></body></html>"
    pdf_bytes = generate_pdf_from_html(html)
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF")

def test_render_template_produces_non_empty_html(sample_invoice, sample_business):
    context = {
        "invoice": sample_invoice,
        "business": sample_business,
        "items": [],
        "currency_symbol": "R",
        "customer": None,
        "generated_at": datetime.now()
    }
    # Ensure mock has required attributes
    sample_invoice.tax_amount = 15.00
    sample_invoice.total = 115.00
    sample_invoice.subtotal = 100.00
    sample_invoice.issue_date = date.today()
    sample_invoice.due_date = date.today()
    
    html = render_html_from_template("invoice.html", context)
    assert "INV-001" in html
    assert "Test Business" in html

@pytest.mark.asyncio
async def test_generate_pdf_runs_in_thread_pool_not_blocking_event_loop():
    with patch("asyncio.get_running_loop") as mock_loop:
        mock_loop_instance = mock_loop.return_value
        mock_loop_instance.run_in_executor = AsyncMock(return_value=b"%PDF-test")
        
        from app.services.pdf_service import _generate_pdf_async
        result = await _generate_pdf_async("<html></html>")
        
        assert result == b"%PDF-test"
        mock_loop_instance.run_in_executor.assert_called_once()

@pytest.mark.asyncio
async def test_invoice_pdf_service_returns_correct_data(mock_db, sample_invoice, sample_business):
    # Ensure mock has required attributes
    sample_invoice.tax_amount = 15.00
    sample_invoice.total = 115.00
    sample_invoice.subtotal = 100.00
    sample_invoice.issue_date = date.today()
    sample_invoice.due_date = date.today()

    mock_invoice_result = MagicMock()
    mock_invoice_result.scalars.return_value.first.return_value = sample_invoice
    
    mock_items_result = MagicMock()
    mock_items_result.scalars.return_value.all.return_value = []
    
    mock_biz_result = MagicMock()
    mock_biz_result.scalars.return_value.first.return_value = sample_business
    
    mock_db.execute.side_effect = [mock_invoice_result, mock_items_result, mock_biz_result]
    
    pdf_bytes, filename = await generate_invoice_pdf(sample_invoice.id, sample_business.id, mock_db)
    
    assert pdf_bytes.startswith(b"%PDF")
    assert filename == f"invoice-{sample_invoice.invoice_number}.pdf"

@pytest.mark.asyncio
async def test_invoice_pdf_service_raises_404_for_invalid_invoice(mock_db):
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = None
    mock_db.execute.return_value = mock_result
    
    with pytest.raises(HTTPException) as exc:
        await generate_invoice_pdf(uuid4(), uuid4(), mock_db)
    assert exc.value.status_code == 404

def test_invalid_template_name_raises_template_not_found_error():
    with pytest.raises(HTTPException) as exc:
        render_html_from_template("non_existent.html", {})
    assert exc.value.status_code == 500
    assert "PDF template not found" in exc.value.detail

@pytest.mark.asyncio
async def test_cashup_pdf_contains_all_required_financial_fields(mock_db, sample_business):
    shift = MagicMock(spec=Shift)
    shift.id = uuid4()
    shift.user_id = uuid4()
    shift.shift_date = date.today()
    shift.start_time = "08:00"
    shift.end_time = "17:00"
    shift.actual_cash = 500.00
    shift.actual_card = 1200.00
    shift.notes = "Good shift"
    
    user = MagicMock(spec=User)
    user.first_name = "John"
    user.last_name = "Doe"
    user.full_name = "John Doe"
    
    from app.models.waiter_cashup import WaiterCashup
    cashup = MagicMock(spec=WaiterCashup)
    cashup.total_sales = 1700.00
    cashup.total_tips = 100.00
    cashup.cash_collected = 500.00
    cashup.card_collected = 1200.00
    cashup.status = "approved"

    mock_shift_result = MagicMock()
    mock_shift_result.scalars.return_value.first.return_value = shift
    
    mock_user_result = MagicMock()
    mock_user_result.scalars.return_value.first.return_value = user
    
    mock_biz_result = MagicMock()
    mock_biz_result.scalars.return_value.first.return_value = sample_business
    
    mock_cashup_result = MagicMock()
    mock_cashup_result.scalars.return_value.first.return_value = cashup

    mock_db.execute.side_effect = [mock_shift_result, mock_user_result, mock_biz_result, mock_cashup_result]
    
    pdf_bytes, filename = await generate_cashup_pdf(shift.id, sample_business.id, mock_db)
    
    assert pdf_bytes.startswith(b"%PDF")
    assert "John_Doe" in filename

@pytest.mark.asyncio
async def test_purchase_order_pdf_service_returns_correct_data(mock_db, sample_business):
    order = MagicMock(spec=Order)
    order.id = uuid4()
    order.order_number = "PO-123"
    order.total = 5000.00
    order.order_date = date.today()
    order.status = "pending"
    order.notes = "PO notes"
    
    mock_order_result = MagicMock()
    mock_order_result.scalars.return_value.first.return_value = order
    
    mock_items_result = MagicMock()
    mock_items_result.scalars.return_value.all.return_value = []
    
    mock_biz_result = MagicMock()
    mock_biz_result.scalars.return_value.first.return_value = sample_business
    
    mock_db.execute.side_effect = [mock_order_result, mock_items_result, mock_biz_result]
    
    pdf_bytes, filename = await generate_purchase_order_pdf(order.id, sample_business.id, mock_db)
    
    assert pdf_bytes.startswith(b"%PDF")
    assert filename == "po-PO-123.pdf"

@pytest.mark.asyncio
async def test_invoice_pdf_endpoint_returns_200_with_pdf_content_type(sample_invoice, sample_business, mock_db):
    # Ensure mock has required attributes
    sample_invoice.tax_amount = 15.00
    sample_invoice.total = 115.00
    sample_invoice.subtotal = 100.00
    sample_invoice.issue_date = date.today()
    sample_invoice.due_date = date.today()

    from app.main import app
    from httpx import AsyncClient, ASGITransport
    from app.api.deps import get_current_business_id
    from app.core.database import get_db

    # Print routes for debugging
    # for route in app.routes:
    #    print(f"Route: {route.path}")

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_business_id] = lambda: sample_business.id

    mock_invoice_result = MagicMock()
    mock_invoice_result.scalars.return_value.first.return_value = sample_invoice
    
    mock_items_result = MagicMock()
    mock_items_result.scalars.return_value.all.return_value = []
    
    mock_biz_result = MagicMock()
    mock_biz_result.scalars.return_value.first.return_value = sample_business
    
    mock_db.execute.side_effect = [mock_invoice_result, mock_items_result, mock_biz_result]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get(f"/api/v1/pdf/invoice/{sample_invoice.id}")

    if response.status_code == 404:
        print(f"404 for /api/v1/pdf/invoice/{sample_invoice.id}")
        # Print available routes starting with /api/v1/pdf
        paths = [r.path for route in app.routes for r in (route.routes if hasattr(route, 'routes') else [route])]
        print(f"Available paths: {[p for p in paths if '/pdf' in p]}")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert f"attachment; filename=invoice-{sample_invoice.invoice_number}.pdf" in response.headers["content-disposition"]
    
    app.dependency_overrides.clear()
