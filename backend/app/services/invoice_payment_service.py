"""Invoice payment service for Paystack integration."""

import os
from decimal import Decimal
from typing import Optional, Tuple
from datetime import date
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.invoice import Invoice, InvoiceStatus
from app.services.paystack_service import paystack_service, PaystackTransaction


# Paystack fee structure (as of 2024):
# - Local cards: 1.5% + ZAR 2 (capped at ZAR 50)
# - International cards: 3.9% + ZAR 2
# We use local rates and add a small buffer
PAYSTACK_FEE_PERCENT = Decimal("1.5")
PAYSTACK_FEE_FLAT = Decimal("2.00")
PAYSTACK_FEE_CAP = Decimal("50.00")


def calculate_gateway_fees(amount: Decimal) -> Decimal:
    """Calculate Paystack gateway fees for an amount.
    
    Fee structure: 1.5% + R2, capped at R50
    """
    percentage_fee = amount * (PAYSTACK_FEE_PERCENT / 100)
    total_fee = percentage_fee + PAYSTACK_FEE_FLAT
    
    # Apply cap
    if total_fee > PAYSTACK_FEE_CAP:
        return PAYSTACK_FEE_CAP
    
    return total_fee.quantize(Decimal("0.01"))


class InvoicePaymentService:
    """Service for processing invoice payments via Paystack."""

    def __init__(self, db: Session):
        self.db = db

    def get_invoice(self, invoice_id: str, business_id: str) -> Optional[Invoice]:
        """Get an invoice by ID and business."""
        return self.db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.business_id == business_id,
            Invoice.deleted_at.is_(None),
        ).first()

    def get_invoice_by_reference(self, reference: str) -> Optional[Invoice]:
        """Get an invoice by payment reference."""
        return self.db.query(Invoice).filter(
            Invoice.payment_reference == reference,
            Invoice.deleted_at.is_(None),
        ).first()

    async def initiate_payment(
        self,
        invoice: Invoice,
        user_email: str,
        callback_url: str,
    ) -> Tuple[Optional[PaystackTransaction], Decimal, Decimal]:
        """Initiate a Paystack payment for an invoice.
        
        Returns:
            Tuple of (PaystackTransaction, gateway_fees, total_with_fees) or (None, 0, 0) on failure
        """
        # Calculate the balance due
        balance_due = Decimal(str(invoice.balance_due))
        
        if balance_due <= 0:
            return None, Decimal("0"), Decimal("0")
        
        # Calculate gateway fees
        gateway_fees = calculate_gateway_fees(balance_due)
        total_with_fees = balance_due + gateway_fees
        
        # Convert to cents (Paystack uses smallest currency unit)
        # Use Decimal arithmetic to avoid floating-point precision errors
        amount_cents = int((total_with_fees * 100).to_integral_value())
        
        # Generate a unique reference
        reference = paystack_service.generate_reference(prefix="INV")
        
        # Initialize the transaction
        metadata = {
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "business_id": str(invoice.business_id),
            "invoice_total": str(balance_due),
            "gateway_fees": str(gateway_fees),
        }
        
        transaction = await paystack_service.initialize_transaction(
            email=user_email,
            amount_cents=amount_cents,
            reference=reference,
            callback_url=callback_url,
            metadata=metadata,
        )
        
        if transaction:
            # Store the reference and fees on the invoice
            invoice.payment_reference = reference
            invoice.payment_gateway_fees = gateway_fees
            invoice.gateway_status = "pending"
            self.db.commit()
        
        return transaction, gateway_fees, total_with_fees

    async def verify_payment(self, reference: str) -> Tuple[bool, str, Optional[Invoice]]:
        """Verify a Paystack payment and update the invoice.
        
        Returns:
            Tuple of (success, message, invoice)
        """
        # Find the invoice by reference
        invoice = self.get_invoice_by_reference(reference)
        
        if not invoice:
            return False, "Invoice not found for this payment reference", None
        
        # Verify with Paystack
        tx_data = await paystack_service.verify_transaction(reference)
        
        if not tx_data:
            invoice.gateway_status = "verification_failed"
            self.db.commit()
            return False, "Could not verify payment with Paystack", invoice
        
        status = tx_data.get("status")
        
        if status == "success":
            # Payment successful - update invoice
            amount_paid_cents = tx_data.get("amount", 0)
            amount_paid = Decimal(str(amount_paid_cents / 100))
            
            # The amount includes fees, so we need to subtract fees to get invoice payment
            gateway_fees = invoice.payment_gateway_fees or Decimal("0")
            invoice_payment = amount_paid - gateway_fees
            
            # Update invoice
            invoice.amount_paid = (invoice.amount_paid or Decimal("0")) + invoice_payment
            invoice.gateway_status = "success"
            
            # Update status based on payment
            if invoice.amount_paid >= invoice.total:
                invoice.status = InvoiceStatus.PAID
                invoice.paid_date = date.today()
            elif invoice.amount_paid > 0:
                invoice.status = InvoiceStatus.PARTIAL
            
            self.db.commit()
            return True, "Payment successful", invoice
        
        elif status == "abandoned":
            invoice.gateway_status = "abandoned"
            self.db.commit()
            return False, "Payment was abandoned", invoice
        
        elif status == "failed":
            invoice.gateway_status = "failed"
            self.db.commit()
            return False, "Payment failed", invoice
        
        else:
            invoice.gateway_status = status or "unknown"
            self.db.commit()
            return False, f"Payment status: {status}", invoice

    def reset_payment_reference(self, invoice: Invoice) -> None:
        """Reset payment reference for a new payment attempt."""
        invoice.payment_reference = None
        invoice.gateway_status = None
        self.db.commit()
