"""Service layer for payment method management and transaction processing.

Handles CRUD for configured payment methods and records every payment
attempt / refund in the transaction audit trail.

Why a service layer?
Keeps business rules (validation, refund limits, status transitions)
out of API endpoints and makes them testable in isolation.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.payment import (
    PaymentMethod,
    PaymentTransaction,
    PaymentTransactionStatus,
)


class PaymentService:
    """Business logic for integrated payments."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # -----------------------------------------------------------------------
    # Payment Methods CRUD
    # -----------------------------------------------------------------------

    def create_method(
        self,
        business_id: uuid.UUID,
        *,
        name: str,
        method_type: str,
        provider: Optional[str] = None,
        config: Optional[dict] = None,
        is_active: bool = True,
        sort_order: int = 0,
    ) -> PaymentMethod:
        """Register a new payment method for a business."""
        method = PaymentMethod(
            id=uuid.uuid4(),
            business_id=business_id,
            name=name,
            method_type=method_type,
            provider=provider,
            config=config,
            is_active=is_active,
            sort_order=sort_order,
        )
        self.db.add(method)
        self.db.commit()
        self.db.refresh(method)
        return method

    def list_methods(
        self,
        business_id: uuid.UUID,
        *,
        active_only: bool = True,
        page: int = 1,
        per_page: int = 20,
    ) -> tuple[list[PaymentMethod], int]:
        """Return payment methods for a business with pagination."""
        query = self.db.query(PaymentMethod).filter(
            PaymentMethod.business_id == business_id,
            PaymentMethod.deleted_at.is_(None),
        )
        if active_only:
            query = query.filter(PaymentMethod.is_active.is_(True))

        total = query.count()
        items = (
            query.order_by(PaymentMethod.sort_order)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_method(self, method_id: uuid.UUID) -> Optional[PaymentMethod]:
        """Get a single payment method by ID."""
        return (
            self.db.query(PaymentMethod)
            .filter(PaymentMethod.id == method_id, PaymentMethod.deleted_at.is_(None))
            .first()
        )

    def update_method(self, method_id: uuid.UUID, **kwargs) -> Optional[PaymentMethod]:
        """Update a payment method. Only non-None kwargs are applied."""
        method = self.get_method(method_id)
        if not method:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(method, key):
                setattr(method, key, value)
        self.db.commit()
        self.db.refresh(method)
        return method

    def delete_method(self, method_id: uuid.UUID) -> bool:
        """Soft-delete a payment method."""
        method = self.get_method(method_id)
        if not method:
            return False
        method.soft_delete()
        self.db.commit()
        return True

    # -----------------------------------------------------------------------
    # Payment Transactions
    # -----------------------------------------------------------------------

    def create_transaction(
        self,
        business_id: uuid.UUID,
        *,
        order_id: uuid.UUID,
        amount: Decimal,
        payment_method_id: Optional[uuid.UUID] = None,
        tip_amount: Decimal = Decimal("0"),
    ) -> PaymentTransaction:
        """Record a new payment attempt for an order."""
        txn = PaymentTransaction(
            id=uuid.uuid4(),
            business_id=business_id,
            order_id=order_id,
            payment_method_id=payment_method_id,
            amount=amount,
            tip_amount=tip_amount,
            status=PaymentTransactionStatus.PENDING.value,
        )
        self.db.add(txn)
        self.db.commit()
        self.db.refresh(txn)
        return txn

    def complete_transaction(self, txn_id: uuid.UUID, gateway_reference: Optional[str] = None) -> Optional[PaymentTransaction]:
        """Mark a transaction as completed."""
        txn = self.db.query(PaymentTransaction).filter(PaymentTransaction.id == txn_id).first()
        if not txn:
            return None
        txn.status = PaymentTransactionStatus.COMPLETED.value
        txn.gateway_reference = gateway_reference
        txn.processed_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(txn)
        return txn

    def refund_transaction(
        self,
        original_txn_id: uuid.UUID,
        amount: Decimal,
    ) -> Optional[PaymentTransaction]:
        """Create a refund transaction linked to the original.

        Why validate refund amount?
        Refunding more than the original payment is a financial loss and
        a common fraud vector.  We enforce amount <= original.amount.
        """
        original = self.db.query(PaymentTransaction).filter(
            PaymentTransaction.id == original_txn_id
        ).first()
        if not original:
            return None
        if amount > original.amount:
            return None  # Cannot refund more than original

        refund = PaymentTransaction(
            id=uuid.uuid4(),
            business_id=original.business_id,
            order_id=original.order_id,
            payment_method_id=original.payment_method_id,
            amount=amount,
            tip_amount=Decimal("0"),
            status=PaymentTransactionStatus.REFUNDED.value,
            refund_of_id=original.id,
            processed_at=datetime.now(timezone.utc),
        )
        self.db.add(refund)
        self.db.commit()
        self.db.refresh(refund)
        return refund

    def list_transactions(
        self,
        business_id: uuid.UUID,
        *,
        order_id: Optional[uuid.UUID] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> tuple[list[PaymentTransaction], int]:
        """List payment transactions with optional order filter."""
        query = self.db.query(PaymentTransaction).filter(
            PaymentTransaction.business_id == business_id,
        )
        if order_id:
            query = query.filter(PaymentTransaction.order_id == order_id)

        total = query.count()
        items = (
            query.order_by(PaymentTransaction.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total
