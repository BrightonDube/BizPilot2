"""Invoice service for business logic."""

from typing import List, Optional, Tuple
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.models.invoice import Invoice, InvoiceItem, InvoiceStatus
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate, InvoiceItemCreate


class InvoiceService:
    """Service for invoice operations."""

    def __init__(self, db: Session):
        self.db = db

    def generate_invoice_number(self, business_id: str) -> str:
        """Generate a unique invoice number."""
        count = self.db.query(Invoice).filter(
            Invoice.business_id == business_id
        ).count()
        
        # Format: INV-YYYYMMDD-XXXXX
        today = datetime.now().strftime("%Y%m%d")
        return f"INV-{today}-{(count + 1):05d}"

    def get_invoices(
        self,
        business_id: str,
        page: int = 1,
        per_page: int = 20,
        search: Optional[str] = None,
        customer_id: Optional[str] = None,
        status: Optional[InvoiceStatus] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        overdue_only: bool = False,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> Tuple[List[Invoice], int]:
        """Get invoices with filtering and pagination."""
        query = self.db.query(Invoice).filter(
            Invoice.business_id == business_id,
            Invoice.deleted_at.is_(None),
        )
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Invoice.invoice_number.ilike(search_term),
                    Invoice.notes.ilike(search_term),
                )
            )
        
        if customer_id:
            query = query.filter(Invoice.customer_id == customer_id)
        
        if status:
            query = query.filter(Invoice.status == status)
        
        if date_from:
            query = query.filter(Invoice.issue_date >= date_from)
        if date_to:
            query = query.filter(Invoice.issue_date <= date_to)
        
        if overdue_only:
            query = query.filter(
                Invoice.due_date < date.today(),
                Invoice.status.notin_([InvoiceStatus.PAID, InvoiceStatus.CANCELLED]),
            )
        
        total = query.count()
        
        sort_column = getattr(Invoice, sort_by, Invoice.created_at)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
        
        offset = (page - 1) * per_page
        invoices = query.offset(offset).limit(per_page).all()
        
        return invoices, total

    def get_invoice(self, invoice_id: str, business_id: str) -> Optional[Invoice]:
        """Get an invoice by ID."""
        return self.db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.business_id == business_id,
            Invoice.deleted_at.is_(None),
        ).first()

    def get_invoice_by_number(self, invoice_number: str, business_id: str) -> Optional[Invoice]:
        """Get an invoice by invoice number."""
        return self.db.query(Invoice).filter(
            Invoice.invoice_number == invoice_number,
            Invoice.business_id == business_id,
            Invoice.deleted_at.is_(None),
        ).first()

    def create_invoice(self, business_id: str, data: InvoiceCreate) -> Invoice:
        """Create a new invoice with items."""
        invoice = Invoice(
            business_id=business_id,
            invoice_number=self.generate_invoice_number(business_id),
            customer_id=data.customer_id,
            order_id=data.order_id,
            status=data.status,
            issue_date=data.issue_date,
            due_date=data.due_date,
            billing_address=data.billing_address.model_dump() if data.billing_address else None,
            notes=data.notes,
            terms=data.terms,
            footer=data.footer,
        )
        self.db.add(invoice)
        self.db.flush()
        
        for item_data in data.items:
            item = self._create_invoice_item(invoice.id, item_data)
            self.db.add(item)
        
        self._calculate_invoice_totals(invoice)
        
        self.db.commit()
        self.db.refresh(invoice)
        return invoice

    def _create_invoice_item(self, invoice_id: UUID, data: InvoiceItemCreate) -> InvoiceItem:
        """Create an invoice item."""
        line_total = data.unit_price * data.quantity
        discount_amount = line_total * (data.discount_percent / 100)
        taxable_amount = line_total - discount_amount
        tax_amount = taxable_amount * (data.tax_rate / 100)
        total = taxable_amount + tax_amount
        
        return InvoiceItem(
            invoice_id=invoice_id,
            product_id=data.product_id,
            description=data.description,
            quantity=data.quantity,
            unit_price=data.unit_price,
            tax_rate=data.tax_rate,
            tax_amount=tax_amount,
            discount_percent=data.discount_percent,
            discount_amount=discount_amount,
            total=total,
        )

    def _calculate_invoice_totals(self, invoice: Invoice) -> None:
        """Calculate invoice totals from items."""
        items = self.db.query(InvoiceItem).filter(
            InvoiceItem.invoice_id == invoice.id,
            InvoiceItem.deleted_at.is_(None),
        ).all()
        
        subtotal = sum(item.unit_price * item.quantity for item in items)
        tax_amount = sum(item.tax_amount or 0 for item in items)
        item_discounts = sum(item.discount_amount or 0 for item in items)
        
        invoice.subtotal = subtotal
        invoice.tax_amount = tax_amount
        invoice.total = subtotal + tax_amount - (invoice.discount_amount or 0) - item_discounts

    def update_invoice(self, invoice: Invoice, data: InvoiceUpdate) -> Invoice:
        """Update an invoice."""
        update_data = data.model_dump(exclude_unset=True)
        
        if "billing_address" in update_data and update_data["billing_address"]:
            update_data["billing_address"] = update_data["billing_address"].model_dump() if hasattr(update_data["billing_address"], 'model_dump') else update_data["billing_address"]
        
        for field, value in update_data.items():
            setattr(invoice, field, value)
        
        self._calculate_invoice_totals(invoice)
        
        self.db.commit()
        self.db.refresh(invoice)
        return invoice

    def record_payment(
        self,
        invoice: Invoice,
        amount: Decimal,
        payment_method: str,
    ) -> Invoice:
        """Record a payment for an invoice."""
        invoice.amount_paid += amount
        
        if invoice.amount_paid >= invoice.total:
            invoice.status = InvoiceStatus.PAID
            invoice.paid_date = date.today()
        elif invoice.amount_paid > 0:
            invoice.status = InvoiceStatus.PARTIAL
        
        self.db.commit()
        self.db.refresh(invoice)
        return invoice

    def send_invoice(self, invoice: Invoice) -> Invoice:
        """Mark invoice as sent."""
        invoice.status = InvoiceStatus.SENT
        self.db.commit()
        self.db.refresh(invoice)
        return invoice

    def delete_invoice(self, invoice: Invoice) -> None:
        """Soft delete an invoice."""
        invoice.deleted_at = datetime.utcnow()
        self.db.commit()

    def get_invoice_items(self, invoice_id: str) -> List[InvoiceItem]:
        """Get items for an invoice."""
        return self.db.query(InvoiceItem).filter(
            InvoiceItem.invoice_id == invoice_id,
            InvoiceItem.deleted_at.is_(None),
        ).all()

    def get_invoice_stats(self, business_id: str) -> dict:
        """Get invoice statistics."""
        invoices = self.db.query(Invoice).filter(
            Invoice.business_id == business_id,
            Invoice.deleted_at.is_(None),
        )
        
        total_invoices = invoices.count()
        total_amount = self.db.query(func.sum(Invoice.total)).filter(
            Invoice.business_id == business_id,
            Invoice.deleted_at.is_(None),
        ).scalar() or 0
        total_paid = self.db.query(func.sum(Invoice.amount_paid)).filter(
            Invoice.business_id == business_id,
            Invoice.deleted_at.is_(None),
        ).scalar() or 0
        
        overdue = invoices.filter(
            Invoice.due_date < date.today(),
            Invoice.status.notin_([InvoiceStatus.PAID, InvoiceStatus.CANCELLED]),
        )
        overdue_count = overdue.count()
        overdue_amount = self.db.query(func.sum(Invoice.total - Invoice.amount_paid)).filter(
            Invoice.business_id == business_id,
            Invoice.deleted_at.is_(None),
            Invoice.due_date < date.today(),
            Invoice.status.notin_([InvoiceStatus.PAID, InvoiceStatus.CANCELLED]),
        ).scalar() or 0
        
        return {
            "total_invoices": total_invoices,
            "total_amount": Decimal(str(total_amount)),
            "total_paid": Decimal(str(total_paid)),
            "total_outstanding": Decimal(str(total_amount - total_paid)),
            "overdue_count": overdue_count,
            "overdue_amount": Decimal(str(overdue_amount)),
        }
