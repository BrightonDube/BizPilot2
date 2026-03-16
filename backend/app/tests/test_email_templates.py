import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from uuid import uuid4

from app.services.email_template_service import (
    render_email_template,
    send_invoice_email,
    send_low_stock_alert,
    LowStockProduct
)
from app.models.invoice import Invoice
from app.models.business import Business

@pytest.mark.asyncio
async def test_render_invoice_email_template_produces_valid_html():
    context = {
        "business_name": "Test Business",
        "invoice_number": "INV-001",
        "customer_name": "John Doe",
        "currency_symbol": "R",
        "amount": "1,000.00",
        "invoice_url": "http://example.com/invoice/1"
    }
    html = await render_email_template("email/invoice_sent.html", context)
    assert "<!DOCTYPE html>" in html
    assert "INV-001" in html
    assert "John Doe" in html
    assert "Test Business" in html

@pytest.mark.asyncio
async def test_email_template_includes_business_branding():
    context = {
        "business_name": "Super Branding Corp",
        "invoice_number": "INV-001",
        "customer_name": "John Doe",
        "currency_symbol": "R",
        "amount": "1,000.00",
        "invoice_url": "http://example.com/invoice/1"
    }
    html = await render_email_template("email/invoice_sent.html", context)
    assert "Super Branding Corp" in html
    # Check if header from base.html is present
    assert "<h1>Super Branding Corp</h1>" in html

@pytest.mark.asyncio
async def test_send_invoice_email_calls_email_service_with_correct_recipient():
    mock_db = AsyncMock()
    invoice_id = uuid4()
    business_id = uuid4()
    recipient = "customer@example.com"

    invoice = MagicMock(spec=Invoice)
    invoice.id = invoice_id
    invoice.invoice_number = "INV-001"
    invoice.total_amount = 500.00
    invoice.customer_id = None
    
    business = MagicMock(spec=Business)
    business.name = "Test Biz"

    # Mock DB responses
    mock_result_invoice = MagicMock()
    mock_result_invoice.scalars.return_value.first.return_value = invoice
    
    mock_result_biz = MagicMock()
    mock_result_biz.scalars.return_value.first.return_value = business
    
    # Sequential side effects for db.execute
    mock_db.execute.side_effect = [mock_result_invoice, mock_result_biz]

    with patch("app.services.email_service.EmailService.send_email") as mock_send:
        await send_invoice_email(invoice_id, recipient, business_id, mock_db)
        
        mock_send.assert_called_once()
        args, kwargs = mock_send.call_args
        assert kwargs["to_email"] == recipient
        assert "INV-001" in kwargs["subject"]
        assert "Test Biz" in kwargs["subject"]
        assert "body_html" in kwargs
        assert "INV-001" in kwargs["body_html"]

@pytest.mark.asyncio
async def test_send_low_stock_alert_uses_configured_recipients():
    mock_db = AsyncMock()
    business_id = uuid4()
    
    business = MagicMock(spec=Business)
    business.name = "Test Biz"
    business.email = "manager@example.com"

    mock_result_biz = MagicMock()
    mock_result_biz.scalars.return_value.first.return_value = business
    mock_db.execute.return_value = mock_result_biz

    products = [
        LowStockProduct("Milk", 2, 5),
        LowStockProduct("Eggs", 1, 10)
    ]

    with patch("app.services.email_service.EmailService.send_email") as mock_send:
        await send_low_stock_alert(products, business_id, mock_db)
        
        mock_send.assert_called_once()
        args, kwargs = mock_send.call_args
        assert kwargs["to_email"] == "manager@example.com"
        assert "Milk" in kwargs["body_html"]
        assert "Eggs" in kwargs["body_html"]

@pytest.mark.asyncio
async def test_all_templates_extend_base_template():
    # We can check this by verifying that a footer string from base.html is in all rendered outputs
    footer_marker = "Sent with BizPilot Pro"
    
    templates = [
        ("email/invoice_sent.html", {"invoice_number": "1", "customer_name": "C", "amount": "0", "invoice_url": "U"}),
        ("email/order_confirmation.html", {"order_number": "1", "customer_name": "C", "amount": "0", "order_url": "U"}),
        ("email/cashup_approved.html", {"waiter_name": "W", "shift_date": "D", "total_amount": "0"}),
        ("email/low_stock_alert.html", {"products": [], "inventory_url": "U"}),
        ("email/welcome.html", {"business_name": "B", "user_name": "U", "dashboard_url": "D"}),
        ("email/password_reset.html", {"user_name": "U", "reset_url": "R", "expiry_time": "T"}),
    ]
    
    for template_path, context in templates:
        html = await render_email_template(template_path, context)
        assert footer_marker in html, f"Template {template_path} does not seem to extend base.html"
