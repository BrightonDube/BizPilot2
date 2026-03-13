"""Proforma invoice (quote) service.

Handles creation, management, approval workflows, duplication,
conversion, validity tracking, and auditing for proforma invoices.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy import String, func, or_
from sqlalchemy.orm import Session

from app.models.proforma import (
    ProformaApproval,
    ProformaAudit,
    ProformaInvoice,
    ProformaItem,
    QuoteStatus,
)


class ProformaService:
    """Service for proforma invoice / quotation operations."""

    def __init__(self, db: Session):
        self.db = db

    # ── Quote Number Generation ───────────────────────────────────────

    def _generate_quote_number(self, business_id: str) -> str:
        """Generate a unique quote number in QT-YYYYMMDD-XXXX format."""
        today = date.today().strftime("%Y%m%d")
        count = (
            self.db.query(func.count(ProformaInvoice.id))
            .filter(
                ProformaInvoice.business_id == business_id,
                func.cast(ProformaInvoice.quote_number, String).like(f"QT-{today}-%"),
            )
            .scalar()
            or 0
        )
        return f"QT-{today}-{count + 1:04d}"

    # ── Creation ──────────────────────────────────────────────────────

    def create_quote(
        self,
        business_id: str,
        customer_id: Optional[str] = None,
        validity_days: int = 30,
        notes: Optional[str] = None,
        terms: Optional[str] = None,
        items: Optional[list] = None,
        discount_pct: Decimal = Decimal("0"),
        created_by: Optional[str] = None,
    ) -> ProformaInvoice:
        """Create a new proforma invoice (quote).

        Args:
            business_id: Owning business UUID.
            customer_id: Optional customer UUID.
            validity_days: Days until expiry (default 30).
            notes: Free-text notes.
            terms: Terms and conditions text.
            items: List of line item dicts.
            discount_pct: Quote-level discount percentage.
            created_by: UUID of the creating user.

        Returns:
            The newly created ProformaInvoice.
        """
        quote_number = self._generate_quote_number(business_id)
        issue = date.today()
        expiry = issue + timedelta(days=validity_days)

        quote = ProformaInvoice(
            business_id=business_id,
            customer_id=customer_id,
            created_by=created_by,
            quote_number=quote_number,
            issue_date=issue,
            expiry_date=expiry,
            validity_days=validity_days,
            notes=notes,
            terms=terms,
            discount_pct=discount_pct,
        )
        self.db.add(quote)
        self.db.flush()

        if items:
            for item_data in items:
                self._add_item(quote, item_data)

        self._recalculate_totals(quote)
        quote.generate_approval_token()

        self._audit(quote.id, "created", created_by, details=f"Quote {quote_number} created")
        self.db.commit()
        self.db.refresh(quote)
        return quote

    # ── Item Management ───────────────────────────────────────────────

    def _add_item(self, quote: ProformaInvoice, item_data: dict) -> ProformaItem:
        """Add a line item to a quote and compute its line total."""
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
        """Recalculate subtotal, tax, discount, and total for the quote."""
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

        # Apply quote-level discount
        quote_disc_pct = quote.discount_pct or Decimal("0")
        if quote_disc_pct > 0:
            quote_disc_amount = subtotal * (quote_disc_pct / 100)
            subtotal -= quote_disc_amount
            tax_total = subtotal * Decimal("0.15")  # Recalculate tax on discounted subtotal
            discount_total += quote_disc_amount

        quote.subtotal = subtotal.quantize(Decimal("0.01"))
        quote.tax_amount = tax_total.quantize(Decimal("0.01"))
        quote.discount_amount = discount_total.quantize(Decimal("0.01"))
        quote.total = (subtotal + tax_total).quantize(Decimal("0.01"))

    # ── CRUD ──────────────────────────────────────────────────────────

    def get_quote(self, quote_id: str, business_id: str) -> Optional[ProformaInvoice]:
        """Retrieve a single quote by ID and business."""
        return (
            self.db.query(ProformaInvoice)
            .filter(
                ProformaInvoice.id == quote_id,
                ProformaInvoice.business_id == business_id,
                ProformaInvoice.deleted_at.is_(None),
            )
            .first()
        )

    def get_quote_by_token(self, token: str) -> Optional[ProformaInvoice]:
        """Retrieve a quote by its shareable approval token."""
        return (
            self.db.query(ProformaInvoice)
            .filter(
                ProformaInvoice.approval_token == token,
                ProformaInvoice.deleted_at.is_(None),
            )
            .first()
        )

    def list_quotes(
        self,
        business_id: str,
        status: Optional[str] = None,
        customer_id: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[ProformaInvoice], int]:
        """List quotes with filtering, search, and pagination.

        Args:
            search: Filters by quote_number or customer name (partial match).
        """
        query = self.db.query(ProformaInvoice).filter(
            ProformaInvoice.business_id == business_id,
            ProformaInvoice.deleted_at.is_(None),
        )
        if status:
            query = query.filter(ProformaInvoice.status == status)
        if customer_id:
            query = query.filter(ProformaInvoice.customer_id == customer_id)
        if search:
            query = query.filter(
                or_(
                    ProformaInvoice.quote_number.ilike(f"%{search}%"),
                    ProformaInvoice.notes.ilike(f"%{search}%"),
                )
            )

        total = query.count()
        items = (
            query.order_by(ProformaInvoice.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def update_quote(
        self,
        quote_id: str,
        business_id: str,
        user_id: Optional[str] = None,
        **kwargs,
    ) -> Optional[ProformaInvoice]:
        """Update a draft quote's editable fields.

        Only quotes in DRAFT status can be edited directly.
        Sent quotes require creating a revision instead.
        """
        quote = self.get_quote(quote_id, business_id)
        if not quote:
            return None
        if quote.status != QuoteStatus.DRAFT:
            raise ValueError("Only draft quotes can be edited. Create a revision for sent quotes.")

        old_values = {}
        new_values = {}
        editable = {"customer_id", "validity_days", "notes", "terms", "discount_pct"}

        for key, value in kwargs.items():
            if key in editable and value is not None:
                old_values[key] = str(getattr(quote, key, None))
                setattr(quote, key, value)
                new_values[key] = str(value)

        # Replace items if provided
        items_data = kwargs.get("items")
        if items_data is not None:
            # Remove existing items
            self.db.query(ProformaItem).filter(
                ProformaItem.proforma_id == quote.id
            ).delete()
            for item_data in items_data:
                self._add_item(quote, item_data)

        # Recalculate expiry if validity_days changed
        if "validity_days" in kwargs and kwargs["validity_days"] is not None:
            quote.expiry_date = quote.issue_date + timedelta(days=quote.validity_days)

        self._recalculate_totals(quote)
        self._audit(quote.id, "edited", user_id, old_values, new_values, "Quote updated")
        self.db.commit()
        self.db.refresh(quote)
        return quote

    def duplicate_quote(
        self,
        quote_id: str,
        business_id: str,
        user_id: Optional[str] = None,
    ) -> ProformaInvoice:
        """Create a new draft quote by duplicating an existing one.

        The new quote gets a fresh quote number, issue date, and expiry.
        Items are copied but the status resets to DRAFT.
        """
        original = self.get_quote(quote_id, business_id)
        if not original:
            raise ValueError("Quote not found")

        items_data = []
        for item in original.items or []:
            if item.deleted_at:
                continue
            items_data.append({
                "product_id": str(item.product_id) if item.product_id else None,
                "description": item.description,
                "quantity": str(item.quantity),
                "unit_price": str(item.unit_price),
                "discount_pct": str(item.discount_pct),
                "tax_rate": str(item.tax_rate),
            })

        new_quote = self.create_quote(
            business_id=business_id,
            customer_id=str(original.customer_id) if original.customer_id else None,
            validity_days=original.validity_days or 30,
            notes=original.notes,
            terms=original.terms,
            items=items_data,
            discount_pct=original.discount_pct or Decimal("0"),
            created_by=user_id,
        )
        return new_quote

    # ── Status Management ─────────────────────────────────────────────

    def update_status(
        self,
        quote_id: str,
        business_id: str,
        new_status: QuoteStatus,
        user_id: Optional[str] = None,
    ) -> Optional[ProformaInvoice]:
        """Transition a quote to a new status with audit logging."""
        quote = self.get_quote(quote_id, business_id)
        if not quote:
            return None
        old_status = quote.status.value if hasattr(quote.status, "value") else str(quote.status)
        quote.status = new_status
        self._audit(
            quote.id, "status_change", user_id,
            {"status": old_status},
            {"status": new_status.value},
        )
        self.db.commit()
        self.db.refresh(quote)
        return quote

    def send_quote(self, quote_id: str, business_id: str, user_id: Optional[str] = None) -> Optional[ProformaInvoice]:
        """Mark a quote as sent to the customer."""
        quote = self.get_quote(quote_id, business_id)
        if not quote:
            return None
        if quote.status not in (QuoteStatus.DRAFT,):
            raise ValueError(f"Cannot send quote with status {quote.status.value}")
        return self.update_status(quote_id, business_id, QuoteStatus.SENT, user_id)

    def cancel_quote(
        self,
        quote_id: str,
        business_id: str,
        reason: str,
        user_id: Optional[str] = None,
    ) -> Optional[ProformaInvoice]:
        """Cancel a quote with a reason (Requirement 2.6)."""
        quote = self.get_quote(quote_id, business_id)
        if not quote:
            return None
        if quote.status in (QuoteStatus.CONVERTED, QuoteStatus.CANCELLED):
            raise ValueError(f"Cannot cancel quote with status {quote.status.value}")
        quote.cancellation_reason = reason
        quote.cancelled_at = datetime.now(timezone.utc)
        return self.update_status(quote_id, business_id, QuoteStatus.CANCELLED, user_id)

    def extend_validity(
        self,
        quote_id: str,
        business_id: str,
        additional_days: int,
        user_id: Optional[str] = None,
    ) -> Optional[ProformaInvoice]:
        """Extend the validity period of a quote (Requirement 6.5)."""
        quote = self.get_quote(quote_id, business_id)
        if not quote:
            return None
        old_expiry = quote.expiry_date.isoformat() if quote.expiry_date else None
        quote.validity_days = (quote.validity_days or 30) + additional_days
        quote.expiry_date = (quote.expiry_date or date.today()) + timedelta(days=additional_days)

        # Reactivate expired quotes
        if quote.status == QuoteStatus.EXPIRED:
            quote.status = QuoteStatus.DRAFT

        self._audit(
            quote.id, "validity_extended", user_id,
            {"expiry_date": old_expiry},
            {"expiry_date": quote.expiry_date.isoformat()},
            f"Extended by {additional_days} days",
        )
        self.db.commit()
        self.db.refresh(quote)
        return quote

    # ── Approval Workflow ─────────────────────────────────────────────

    def record_view(self, token: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> Optional[ProformaInvoice]:
        """Record that a customer viewed the quote via shareable link."""
        quote = self.get_quote_by_token(token)
        if not quote:
            return None
        if not quote.viewed_at:
            quote.viewed_at = datetime.now(timezone.utc)
            if quote.status == QuoteStatus.SENT:
                quote.status = QuoteStatus.VIEWED

        approval = ProformaApproval(
            proforma_id=quote.id,
            action="viewed",
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(approval)
        self._audit(quote.id, "viewed", details="Customer viewed quote via shareable link")
        self.db.commit()
        self.db.refresh(quote)
        return quote

    def approve_quote(
        self,
        quote_id: str,
        business_id: str,
        customer_name: Optional[str] = None,
        customer_email: Optional[str] = None,
        signature_data: Optional[str] = None,
        notes: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Optional[ProformaInvoice]:
        """Approve a quote with optional signature capture (Requirement 3)."""
        quote = self.get_quote(quote_id, business_id)
        if not quote:
            return None

        now = datetime.now(timezone.utc)
        quote.status = QuoteStatus.APPROVED
        quote.approved_at = now
        quote.approved_by_name = customer_name

        approval = ProformaApproval(
            proforma_id=quote.id,
            action="approved",
            customer_name=customer_name,
            customer_email=customer_email,
            signature_data=signature_data,
            notes=notes,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(approval)
        self._audit(quote.id, "approved", details=f"Approved by {customer_name or 'customer'}")
        self.db.commit()
        self.db.refresh(quote)
        return quote

    def approve_quote_by_token(
        self,
        token: str,
        customer_name: Optional[str] = None,
        customer_email: Optional[str] = None,
        signature_data: Optional[str] = None,
        notes: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Optional[ProformaInvoice]:
        """Approve a quote using the shareable token (customer-facing)."""
        quote = self.get_quote_by_token(token)
        if not quote:
            return None
        if quote.status not in (QuoteStatus.SENT, QuoteStatus.VIEWED):
            raise ValueError(f"Quote cannot be approved in status {quote.status.value}")
        return self.approve_quote(
            str(quote.id), str(quote.business_id),
            customer_name, customer_email, signature_data, notes,
            ip_address, user_agent,
        )

    def reject_quote(
        self,
        quote_id: str,
        business_id: str,
        reason: Optional[str] = None,
        customer_name: Optional[str] = None,
        customer_email: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> Optional[ProformaInvoice]:
        """Reject a quote with an optional reason (Requirement 3.8)."""
        quote = self.get_quote(quote_id, business_id)
        if not quote:
            return None

        now = datetime.now(timezone.utc)
        quote.status = QuoteStatus.REJECTED
        quote.rejection_reason = reason
        quote.rejected_at = now

        approval = ProformaApproval(
            proforma_id=quote.id,
            action="rejected",
            customer_name=customer_name,
            customer_email=customer_email,
            notes=reason,
            ip_address=ip_address,
        )
        self.db.add(approval)
        self._audit(quote.id, "rejected", details=f"Rejected: {reason or 'no reason given'}")
        self.db.commit()
        self.db.refresh(quote)
        return quote

    def reject_quote_by_token(
        self,
        token: str,
        reason: Optional[str] = None,
        customer_name: Optional[str] = None,
        customer_email: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> Optional[ProformaInvoice]:
        """Reject a quote using the shareable token (customer-facing)."""
        quote = self.get_quote_by_token(token)
        if not quote:
            return None
        if quote.status not in (QuoteStatus.SENT, QuoteStatus.VIEWED):
            raise ValueError(f"Quote cannot be rejected in status {quote.status.value}")
        return self.reject_quote(
            str(quote.id), str(quote.business_id),
            reason, customer_name, customer_email, ip_address,
        )

    # ── Conversion ────────────────────────────────────────────────────

    def convert_to_invoice(
        self,
        quote_id: str,
        business_id: str,
        selected_item_ids: Optional[List[str]] = None,
        use_current_prices: bool = False,
        user_id: Optional[str] = None,
    ) -> dict:
        """Convert an approved quote into an invoice.

        Supports partial conversion by specifying ``selected_item_ids``.
        If ``use_current_prices`` is True, items use current catalog
        prices instead of the original quote prices.
        """
        from app.models.invoice import Invoice, InvoiceItem, InvoiceStatus

        quote = self.get_quote(quote_id, business_id)
        if not quote:
            raise ValueError("Quote not found")
        if quote.status not in (QuoteStatus.APPROVED, QuoteStatus.SENT, QuoteStatus.DRAFT):
            raise ValueError(f"Cannot convert quote with status {quote.status.value}")

        # Determine which items to convert
        items = (
            self.db.query(ProformaItem)
            .filter(ProformaItem.proforma_id == quote.id, ProformaItem.deleted_at.is_(None))
            .all()
        )
        if selected_item_ids:
            items = [i for i in items if str(i.id) in selected_item_ids]
            if not items:
                raise ValueError("No matching items found for conversion")

        # Generate invoice number
        today = date.today().strftime("%Y%m%d")
        count = self.db.query(func.count(Invoice.id)).filter(
            Invoice.business_id == business_id,
        ).scalar() or 0
        invoice_number = f"INV-{today}-{count + 1:04d}"

        # Calculate totals from selected items
        inv_subtotal = Decimal("0")
        inv_tax = Decimal("0")
        inv_discount = Decimal("0")

        invoice = Invoice(
            business_id=business_id,
            customer_id=quote.customer_id,
            invoice_number=invoice_number,
            status=InvoiceStatus.DRAFT,
            issue_date=date.today(),
            notes=quote.notes,
            terms=quote.terms,
        )
        self.db.add(invoice)
        self.db.flush()

        for item in items:
            base = item.quantity * item.unit_price
            disc = base * (item.discount_pct / 100)
            after_disc = base - disc
            tax = after_disc * (item.tax_rate / 100)

            inv_item = InvoiceItem(
                invoice_id=invoice.id,
                product_id=item.product_id,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                tax_rate=item.tax_rate,
            )
            self.db.add(inv_item)
            item.is_converted = True

            inv_subtotal += after_disc
            inv_tax += tax
            inv_discount += disc

        invoice.subtotal = inv_subtotal.quantize(Decimal("0.01"))
        invoice.tax_amount = inv_tax.quantize(Decimal("0.01"))
        invoice.discount_amount = inv_discount.quantize(Decimal("0.01"))
        invoice.total = (inv_subtotal + inv_tax).quantize(Decimal("0.01"))

        # Check if all items are now converted (full vs partial)
        all_items = (
            self.db.query(ProformaItem)
            .filter(ProformaItem.proforma_id == quote.id, ProformaItem.deleted_at.is_(None))
            .all()
        )
        all_converted = all(i.is_converted for i in all_items)

        if all_converted:
            quote.status = QuoteStatus.CONVERTED
        quote.converted_invoice_id = invoice.id
        quote.converted_at = datetime.now(timezone.utc)

        self._audit(
            quote.id, "converted", user_id,
            details=f"Converted to invoice {invoice_number} ({'full' if all_converted else 'partial'})",
        )
        self.db.commit()

        return {
            "quote_id": str(quote.id),
            "invoice_id": str(invoice.id),
            "invoice_number": invoice_number,
            "status": "converted" if all_converted else "partially_converted",
            "items_converted": len(items),
        }

    # ── Expiry ────────────────────────────────────────────────────────

    def expire_old_quotes(self, business_id: str) -> int:
        """Mark expired quotes past their validity date."""
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

    # ── Audit ─────────────────────────────────────────────────────────

    def _audit(
        self,
        proforma_id,
        action: str,
        performed_by=None,
        old_value: dict = None,
        new_value: dict = None,
        details: str = None,
    ) -> None:
        """Create an audit trail entry for a proforma invoice."""
        entry = ProformaAudit(
            proforma_id=proforma_id,
            action=action,
            performed_by=performed_by,
            old_value=old_value,
            new_value=new_value,
            details=details,
        )
        self.db.add(entry)

    def get_audit_trail(self, quote_id: str) -> List[ProformaAudit]:
        """Get the full audit trail for a quote."""
        return (
            self.db.query(ProformaAudit)
            .filter(ProformaAudit.proforma_id == quote_id)
            .order_by(ProformaAudit.created_at.desc())
            .all()
        )
