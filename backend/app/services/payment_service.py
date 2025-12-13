"""Payment service for business logic."""

from typing import Optional, Tuple, List
from datetime import date
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.payment import Payment, PaymentStatus, PaymentMethod
from app.models.invoice import Invoice
from app.models.customer import Customer
from app.models.business_user import BusinessUser
from app.schemas.payment import PaymentCreate, PaymentUpdate, PaymentResponse


class PaymentService:
    """Service for payment operations."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_payment_number(self, business_id: UUID) -> str:
        """Generate a unique payment number."""
        today = date.today()
        prefix = f"PAY-{today.strftime('%Y%m%d')}"
        
        # Count existing payments for this business today
        count = self.db.query(Payment).filter(
            Payment.business_id == business_id,
            Payment.payment_number.like(f"{prefix}%")
        ).count()
        
        return f"{prefix}-{str(count + 1).zfill(5)}"

    def _get_user_business_id(self, user_id: UUID) -> Optional[UUID]:
        """Get the business ID for a user."""
        business_user = self.db.query(BusinessUser).filter(
            BusinessUser.user_id == user_id
        ).first()
        return business_user.business_id if business_user else None

    def list_payments(
        self,
        user_id: UUID,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        payment_method: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Tuple[List[PaymentResponse], int]:
        """List payments with filtering."""
        business_id = self._get_user_business_id(user_id)
        if not business_id:
            return [], 0

        query = self.db.query(Payment).filter(Payment.business_id == business_id)

        if status:
            query = query.filter(Payment.status == status)
        if payment_method:
            query = query.filter(Payment.payment_method == payment_method)
        if start_date:
            query = query.filter(Payment.payment_date >= start_date)
        if end_date:
            query = query.filter(Payment.payment_date <= end_date)

        total = query.count()
        payments = query.order_by(Payment.created_at.desc()).offset(skip).limit(limit).all()

        result = []
        for payment in payments:
            invoice_number = None
            customer_name = None
            
            if payment.invoice_id:
                invoice = self.db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
                if invoice:
                    invoice_number = invoice.invoice_number
            
            if payment.customer_id:
                customer = self.db.query(Customer).filter(Customer.id == payment.customer_id).first()
                if customer:
                    customer_name = f"{customer.first_name} {customer.last_name}" if customer.first_name else customer.company_name
            
            result.append(PaymentResponse(
                id=payment.id,
                payment_number=payment.payment_number,
                invoice_id=payment.invoice_id,
                invoice_number=invoice_number,
                customer_id=payment.customer_id,
                customer_name=customer_name,
                amount=float(payment.amount),
                payment_method=payment.payment_method.value if payment.payment_method else "cash",
                status=payment.status.value if payment.status else "pending",
                payment_date=payment.payment_date,
                reference=payment.reference,
                notes=payment.notes,
            ))

        return result, total

    def create_payment(self, payment_data: PaymentCreate, user_id: UUID) -> PaymentResponse:
        """Create a new payment."""
        business_id = self._get_user_business_id(user_id)
        if not business_id:
            raise ValueError("User not associated with a business")

        payment = Payment(
            business_id=business_id,
            payment_number=self._generate_payment_number(business_id),
            invoice_id=payment_data.invoice_id,
            customer_id=payment_data.customer_id,
            amount=payment_data.amount,
            payment_method=PaymentMethod(payment_data.payment_method),
            status=PaymentStatus.COMPLETED,
            payment_date=payment_data.payment_date,
            reference=payment_data.reference,
            notes=payment_data.notes,
        )

        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)

        # Update invoice amount_paid if linked
        if payment.invoice_id:
            invoice = self.db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
            if invoice:
                invoice.amount_paid = float(invoice.amount_paid or 0) + payment_data.amount
                self.db.commit()

        return self._to_response(payment)

    def get_payment(self, payment_id: UUID, user_id: UUID) -> Optional[PaymentResponse]:
        """Get a payment by ID."""
        business_id = self._get_user_business_id(user_id)
        if not business_id:
            return None

        payment = self.db.query(Payment).filter(
            Payment.id == payment_id,
            Payment.business_id == business_id
        ).first()

        return self._to_response(payment) if payment else None

    def update_payment(
        self, payment_id: UUID, payment_data: PaymentUpdate, user_id: UUID
    ) -> Optional[PaymentResponse]:
        """Update a payment."""
        business_id = self._get_user_business_id(user_id)
        if not business_id:
            return None

        payment = self.db.query(Payment).filter(
            Payment.id == payment_id,
            Payment.business_id == business_id
        ).first()

        if not payment:
            return None

        for field, value in payment_data.model_dump(exclude_unset=True).items():
            if field == "payment_method" and value:
                setattr(payment, field, PaymentMethod(value))
            elif field == "status" and value:
                setattr(payment, field, PaymentStatus(value))
            elif value is not None:
                setattr(payment, field, value)

        self.db.commit()
        self.db.refresh(payment)
        return self._to_response(payment)

    def delete_payment(self, payment_id: UUID, user_id: UUID) -> bool:
        """Delete a payment."""
        business_id = self._get_user_business_id(user_id)
        if not business_id:
            return False

        payment = self.db.query(Payment).filter(
            Payment.id == payment_id,
            Payment.business_id == business_id
        ).first()

        if not payment:
            return False

        self.db.delete(payment)
        self.db.commit()
        return True

    def _to_response(self, payment: Payment) -> PaymentResponse:
        """Convert payment model to response."""
        invoice_number = None
        customer_name = None

        if payment.invoice_id:
            invoice = self.db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
            if invoice:
                invoice_number = invoice.invoice_number

        if payment.customer_id:
            customer = self.db.query(Customer).filter(Customer.id == payment.customer_id).first()
            if customer:
                customer_name = f"{customer.first_name} {customer.last_name}" if customer.first_name else customer.company_name

        return PaymentResponse(
            id=payment.id,
            payment_number=payment.payment_number,
            invoice_id=payment.invoice_id,
            invoice_number=invoice_number,
            customer_id=payment.customer_id,
            customer_name=customer_name,
            amount=float(payment.amount),
            payment_method=payment.payment_method.value if payment.payment_method else "cash",
            status=payment.status.value if payment.status else "pending",
            payment_date=payment.payment_date,
            reference=payment.reference,
            notes=payment.notes,
        )
