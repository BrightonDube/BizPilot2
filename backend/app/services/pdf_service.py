import logging
import os
import asyncio
from typing import Tuple
from uuid import UUID
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jinja2 import Environment, FileSystemLoader, select_autoescape, TemplateNotFound
from weasyprint import HTML

from app.models.invoice import Invoice, InvoiceItem
from app.models.order import Order, OrderItem
from app.models.shift import Shift
from app.models.user import User
from app.models.business import Business
from app.models.customer import Customer

logger = logging.getLogger(__name__)

# Setup Jinja2 environment
TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates", "pdf")

if not os.path.exists(TEMPLATE_DIR):
    os.makedirs(TEMPLATE_DIR, exist_ok=True)

env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=select_autoescape(['html', 'xml'])
)

def format_currency(value, currency="ZAR"):
    if value is None:
        return f"{currency} 0.00"
    return f"{currency} {float(value):,.2f}"

def format_date(value, format="%Y-%m-%d"):
    if value is None:
        return ""
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except ValueError:
            return value
    return value.strftime(format)

env.filters['currency'] = format_currency
env.filters['date'] = format_date

_pdf_executor = ThreadPoolExecutor(max_workers=4)

def render_html_from_template(template_name: str, context: dict) -> str:
    try:
        template = env.get_template(template_name)
        return template.render(**context)
    except TemplateNotFound:
        logger.error(f"Template not found: {template_name}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF template not found: {template_name}"
        )
    except Exception as e:
        logger.error(f"Error rendering template {template_name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error rendering PDF template"
        )

def generate_pdf_from_html(html_content: str) -> bytes:
    try:
        return HTML(string=html_content).write_pdf()
    except Exception as e:
        logger.error(f"WeasyPrint error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PDF generation failed"
        )

async def _generate_pdf_async(html_content: str) -> bytes:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_pdf_executor, generate_pdf_from_html, html_content)

async def generate_invoice_pdf(invoice_id: UUID, business_id: UUID, db: AsyncSession) -> Tuple[bytes, str]:
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.business_id == business_id)
    )
    invoice = result.scalars().first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    result_items = await db.execute(
        select(InvoiceItem).where(InvoiceItem.invoice_id == invoice_id)
    )
    items = result_items.scalars().all()

    result_biz = await db.execute(
        select(Business).where(Business.id == business_id)
    )
    business = result_biz.scalars().first()

    customer = None
    if invoice.customer_id:
        result_cust = await db.execute(select(Customer).where(Customer.id == invoice.customer_id))
        customer = result_cust.scalars().first()

    context = {
        "invoice": invoice,
        "items": items,
        "business": business,
        "customer": customer,
        "generated_at": datetime.now()
    }

    html = render_html_from_template("invoice.html", context)
    pdf_bytes = await _generate_pdf_async(html)
    
    filename = f"invoice-{invoice.invoice_number}.pdf"
    return pdf_bytes, filename

async def generate_cashup_pdf(shift_id: UUID, business_id: UUID, db: AsyncSession) -> Tuple[bytes, str]:
    result = await db.execute(
        select(Shift).where(Shift.id == shift_id, Shift.business_id == business_id)
    )
    shift = result.scalars().first()

    if not shift:
         raise HTTPException(status_code=404, detail="Shift not found")

    result_user = await db.execute(select(User).where(User.id == shift.user_id))
    user = result_user.scalars().first()
    
    result_biz = await db.execute(
        select(Business).where(Business.id == business_id)
    )
    business = result_biz.scalars().first()
    
    context = {
        "shift": shift,
        "waiter": user,
        "business": business,
        "generated_at": datetime.now()
    }
    
    html = render_html_from_template("cashup_report.html", context)
    pdf_bytes = await _generate_pdf_async(html)
    
    waiter_name = f"{user.first_name}_{user.last_name}" if user else "unknown"
    date_str = shift.shift_date.strftime("%Y%m%d")
    filename = f"cashup-{waiter_name}-{date_str}.pdf"
    return pdf_bytes, filename

async def generate_purchase_order_pdf(po_id: UUID, business_id: UUID, db: AsyncSession) -> Tuple[bytes, str]:
    result = await db.execute(
        select(Order).where(Order.id == po_id, Order.business_id == business_id)
    )
    order = result.scalars().first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
        
    result_items = await db.execute(select(OrderItem).where(OrderItem.order_id == po_id))
    items = result_items.scalars().all()
    
    result_biz = await db.execute(select(Business).where(Business.id == business_id))
    business = result_biz.scalars().first()
    
    context = {
        "order": order,
        "items": items,
        "business": business,
        "supplier": None,
        "generated_at": datetime.now()
    }
    
    html = render_html_from_template("purchase_order.html", context)
    pdf_bytes = await _generate_pdf_async(html)
    
    po_number = getattr(order, 'order_number', str(order.id)[:8])
    filename = f"po-{po_number}.pdf"
    return pdf_bytes, filename
