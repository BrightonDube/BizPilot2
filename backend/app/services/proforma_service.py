"""Proforma invoice (quote) service."""

from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.proforma import ProformaInvoice, ProformaItem, QuoteStatus


class ProformaService:
    """Service for proforma invoice / quotation operations."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_quote_number(self, business_id: str) -> str:
        today = date.today().strftime("%Y%m%d")
        count = (
            self.db.query(func.count(ProformaInvoice.id))
            .filter(
                ProformaInvoice.business_id == business_id,
                func.cast(ProformaInvoice.quote_number, str).like(f"QT-{today}-%"),
            )
            .scalar()
            or 0
        )
        return f"QT-{today}-{count + 1:04d}"

    def create_quote(
        self,
        business_id: str,
        customer_id: Optional[str] = None,
        validity_days: int = 30,
        notes: Optional[str] = None,
        terms: Optional[str] = None,
        items: Optional[list] = None,
    ) -> ProformaInvoice:
        """Create a new proforma invoice (quote)."""
        quote_number = self._generate_quote_number(business_id)
        issue = date.today()
        expiry = issue + timedelta(days=validity_days)

        quote = ProformaInvoice(
            business_id=business_id,
            customer_id=customer_id,
            quote_number=quote_number,
            issue_date=issue,
            expiry_date=expiry,
            validity_days=validity_days,
            notes=notes,
            terms=terms,
        )
        self.db.add(quote)
        self.db.flush()

        if items:
            for item_data in items:
                self._add_item(quote, item_data)

        self._recalculate_totals(quote)
        self.db.commit()
        self.db.refresh(quote)
        return quote

    def _add_item(self, quote: ProformaInvoice, item_data: dict) -> ProformaItem:
        qty = Decimal(str(item_data.get("quantity", 1)))
        price = Decimal(str(item_data.get("unit_price", 0)))
        discount = Decimal(str(item_data.get("discount_pct", 0)))
        tax = Decimal(str(item_data.get("tax_rate", 15)))

        discounted = price * (1 - discount / 100)
        line_total = qty * discounted * (1 + tax / 100)

        item = ProformaItem(
            proforma_id=quote.id,
            product_id=item_data.get("product_id"),
            description=item_data.get("description", ""),
            quantity=qty,
            unit_price=price,
            discount_pct=discount,
            tax_rate=tax,
            line_total=line_total.quantize(Decimal("0.01")),
        )
        self.db.add(item)
        return item

    def _recalculate_totals(self, quote: ProformaInvoice) -> None:
        items = (
            self.db.query(ProformaItem)
            .filter(ProformaItem.proforma_id == quote.id, ProformaItem.deleted_at.is_(None))
            .all()
        )
        subtotal = Decimal("0")
        tax_total = Decimal("0")
        discount_total = Decimal("0")

        for item in items:
            base = item.quantity * item.unit_price
            disc = base * (item.discount_pct / 100)
            after_disc = base - disc
            tax = after_disc * (item.tax_rate / 100)
            subtotal += after_disc
            tax_total += tax
            discount_total += disc

        quote.subtotal = subtotal.quantize(Decimal("0.01"))
        quote.tax_amount = tax_total.quantize(Decimal("0.01"))
        quote.discount_amount = discount_total.quantize(Decimal("0.01"))
        quote.total = (subtotal + tax_total).quantize(Decimal("0.01"))

    def get_quote(self, quote_id: str, business_id: str) -> Optional[ProformaInvoice]:
        return (
            self.db.query(ProformaInvoice)
            .filter(
                ProformaInvoice.id == quote_id,
                ProformaInvoice.business_id == business_id,
                ProformaInvoice.deleted_at.is_(None),
            )
            .first()
        )

    def list_quotes(
        self,
        business_id: str,
        status: Optional[str] = None,
        customer_id: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[ProformaInvoice], int]:
        query = self.db.query(ProformaInvoice).filter(
            ProformaInvoice.business_id == business_id,
            ProformaInvoice.deleted_at.is_(None),
        )
        if status:
            query = query.filter(ProformaInvoice.status == status)
        if customer_id:
            query = query.filter(ProformaInvoice.customer_id == customer_id)

        total = query.count()
        items = (
            query.order_by(ProformaInvoice.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def update_status(
        self, quote_id: str, business_id: str, new_status: QuoteStatus
    ) -> Optional[ProformaInvoice]:
        quote = self.get_quote(quote_id, business_id)
        if not quote:
            return None
        quote.status = new_status
        self.db.commit()
        self.db.refresh(quote)
        return quote

    def approve_quote(self, quote_id: str, business_id: str) -> Optional[ProformaInvoice]:
        return self.update_status(quote_id, business_id, QuoteStatus.APPROVED)

    def reject_quote(self, quote_id: str, business_id: str) -> Optional[ProformaInvoice]:
        return self.update_status(quote_id, business_id, QuoteStatus.REJECTED)

    def convert_to_invoice(self, quote_id: str, business_id: str) -> dict:
        """Convert an approved quote into an invoice."""
        from app.models.invoice import Invoice, InvoiceItem, InvoiceStatus

        quote = self.get_quote(quote_id, business_id)
        if not quote:
            raise ValueError("Quote not found")
        if quote.status not in (QuoteStatus.APPROVED, QuoteStatus.SENT, QuoteStatus.DRAFT):
            raise ValueError(f"Cannot convert quote with status {quote.status.value}")

        # Generate invoice number
        today = date.today().strftime("%Y%m%d")
        count = self.db.query(func.count(Invoice.id)).filter(
            Invoice.business_id == business_id,
        ).scalar() or 0
        invoice_number = f"INV-{today}-{count + 1:04d}"

        invoice = Invoice(
            business_id=business_id,
            customer_id=quote.customer_id,
            invoice_number=invoice_number,
            status=InvoiceStatus.DRAFT,
            issue_date=date.today(),
            subtotal=quote.subtotal,
            tax_amount=quote.tax_amount,
            discount_amount=quote.discount_amount,
            total=quote.total,
            notes=quote.notes,
            terms_and_conditions=quote.terms,
        )
        self.db.add(invoice)
        self.db.flush()

        # Copy items
        items = (
            self.db.query(ProformaItem)
            .filter(ProformaItem.proforma_id == quote.id, ProformaItem.deleted_at.is_(None))
            .all()
        )
        for item in items:
            inv_item = InvoiceItem(
                invoice_id=invoice.id,
                product_id=item.product_id,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                tax_rate=item.tax_rate,
                line_total=item.line_total,
            )
            self.db.add(inv_item)

        quote.status = QuoteStatus.CONVERTED
        quote.converted_invoice_id = invoice.id
        self.db.commit()

        return {
            "quote_id": str(quote.id),
            "invoice_id": str(invoice.id),
            "invoice_number": invoice_number,
            "status": "converted",
        }

    def expire_old_quotes(self, business_id: str) -> int:
        """Mark expired quotes."""
        today = date.today()
        count = (
            self.db.query(ProformaInvoice)
            .filter(
                ProformaInvoice.business_id == business_id,
                ProformaInvoice.status.in_([QuoteStatus.DRAFT, QuoteStatus.SENT]),
                ProformaInvoice.expiry_date < today,
                ProformaInvoice.deleted_at.is_(None),
            )
            .update(
                {ProformaInvoice.status: QuoteStatus.EXPIRED},
                synchronize_session="fetch",
            )
        )
        self.db.commit()
        return count
