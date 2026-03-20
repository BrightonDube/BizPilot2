import os
import logging
from datetime import datetime
from uuid import UUID
from typing import List

from jinja2 import Environment, FileSystemLoader, select_autoescape, TemplateNotFound
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.services.email_service import EmailService
from app.models.invoice import Invoice
from app.models.shift import Shift
from app.models.business import Business
from app.models.user import User
from app.models.customer import Customer
from app.core.config import settings

logger = logging.getLogger(__name__)

# Setup Jinja2 environment for emails
TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")

env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=select_autoescape(['html', 'xml'])
)

def format_currency(value, currency="ZAR"):
    if value is None:
        return f"{currency} 0.00"
    return f"{currency} {float(value):,.2f}"

env.filters['currency'] = format_currency

class LowStockProduct:
    def __init__(self, name: str, stock_quantity: int, stock_threshold: int):
        self.name = name
        self.stock_quantity = stock_quantity
        self.stock_threshold = stock_threshold

async def render_email_template(template_name: str, context: dict) -> str:
    """Render a Jinja2 template for email."""
    try:
        template = env.get_template(template_name)
        # Add default context variables
        if 'year' not in context:
            context['year'] = datetime.now().year
        return template.render(**context)
    except TemplateNotFound:
        logger.error(f"Email template not found: {template_name}")
        raise ValueError(f"Email template not found: {template_name}")
    except Exception as e:
        logger.error(f"Error rendering email template {template_name}: {str(e)}")
        raise

async def send_invoice_email(invoice_id: UUID, recipient_email: str, business_id: UUID, db: AsyncSession) -> bool:
    """Send invoice email to customer with professional HTML formatting."""
    try:
        # Fetch data
        result = await db.execute(
            select(Invoice).where(Invoice.id == invoice_id, Invoice.business_id == business_id)
        )
        invoice = result.scalars().first()
        if not invoice:
            return False

        result_biz = await db.execute(select(Business).where(Business.id == business_id))
        business = result_biz.scalars().first()
        
        customer_name = "Customer"
        if invoice.customer_id:
            result_cust = await db.execute(select(Customer).where(Customer.id == invoice.customer_id))
            customer = result_cust.scalars().first()
            if customer:
                customer_name = customer.name

        context = {
            "business_name": business.name if business else "BizPilot Pro",
            "invoice_number": invoice.invoice_number,
            "customer_name": customer_name,
            "currency_symbol": "R", # Default for ZAR
            "amount": f"{invoice.total_amount:,.2f}",
            "invoice_url": f"{settings.FRONTEND_URL}/invoices/{invoice.id}"
        }

        html_content = await render_email_template("email/invoice_sent.html", context)
        text_content = f"New Invoice: {invoice.invoice_number}. Amount: R{invoice.total_amount:,.2f}. View at {context['invoice_url']}"

        email_service = EmailService()
        email_service.send_email(
            to_email=recipient_email,
            subject=f"New Invoice {invoice.invoice_number} from {context['business_name']}",
            body_text=text_content,
            body_html=html_content
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send invoice email: {str(e)}")
        return False

async def send_cashup_approved_email(shift_id: UUID, waiter_email: str, business_id: UUID, db: AsyncSession) -> bool:
    """Notify waiter that cashup has been approved by manager."""
    try:
        result = await db.execute(
            select(Shift).where(Shift.id == shift_id, Shift.business_id == business_id)
        )
        shift = result.scalars().first()
        if not shift:
            return False

        result_biz = await db.execute(select(Business).where(Business.id == business_id))
        business = result_biz.scalars().first()

        result_user = await db.execute(select(User).where(User.id == shift.user_id))
        waiter = result_user.scalars().first()

        context = {
            "business_name": business.name if business else "BizPilot Pro",
            "waiter_name": waiter.first_name if waiter else "Waiter",
            "shift_date": shift.shift_date.strftime("%Y-%m-%d"),
            "currency_symbol": "R",
            "total_amount": f"{shift.total_recorded:,.2f}" if hasattr(shift, 'total_recorded') else "0.00"
        }

        html_content = await render_email_template("email/cashup_approved.html", context)
        text_content = f"Your shift cashup for {context['shift_date']} has been approved. Total: R{context['total_amount']}"

        email_service = EmailService()
        email_service.send_email(
            to_email=waiter_email,
            subject=f"Shift Cashup Approved - {context['shift_date']}",
            body_text=text_content,
            body_html=html_content
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send cashup approved email: {str(e)}")
        return False

async def send_low_stock_alert(products: List[LowStockProduct], business_id: UUID, db: AsyncSession) -> bool:
    """Send low stock alert email to configured recipients."""
    try:
        result_biz = await db.execute(select(Business).where(Business.id == business_id))
        business = result_biz.scalars().first()

        # In a real app, we would fetch recipients from inventory_report_configs
        # For now, we'll use a placeholder or business email
        recipient_email = business.email if business and business.email else settings.EMAILS_FROM_EMAIL

        context = {
            "business_name": business.name if business else "BizPilot Pro",
            "products": products,
            "inventory_url": f"{settings.FRONTEND_URL}/inventory"
        }

        html_content = await render_email_template("email/low_stock_alert.html", context)
        text_content = "Low stock alert for items: " + ", ".join([p.name for p in products])

        email_service = EmailService()
        email_service.send_email(
            to_email=recipient_email,
            subject=f"Low Stock Alert - {context['business_name']}",
            body_text=text_content,
            body_html=html_content
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send low stock alert email: {str(e)}")
        return False
