"""Service layer for payment method management and transaction processing.

Handles CRUD for configured payment methods and records every payment
attempt / refund in the transaction audit trail.

Why a service layer?
Keeps business rules (validation, refund limits, status transitions)
out of API endpoints and makes them testable in isolation.
"""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models.payment import (
    CashDrawerSession,
    CashDrawerStatus,
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

    # -----------------------------------------------------------------------
    # Payment Reports
    # -----------------------------------------------------------------------

    def get_payment_summary(
        self,
        business_id: uuid.UUID,
        *,
        days: int = 30,
    ) -> Dict[str, Any]:
        """Generate a payment summary report for the given period.

        Returns total revenue, tip total, refund total, transaction counts,
        average transaction amount, and success rate.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        base_q = self.db.query(PaymentTransaction).filter(
            PaymentTransaction.business_id == business_id,
            PaymentTransaction.created_at >= cutoff,
        )

        total_txns = base_q.count()

        completed_q = base_q.filter(
            PaymentTransaction.status == PaymentTransactionStatus.COMPLETED.value
        )
        completed_count = completed_q.count()
        completed_agg = completed_q.with_entities(
            func.coalesce(func.sum(PaymentTransaction.amount), 0),
            func.coalesce(func.sum(PaymentTransaction.tip_amount), 0),
        ).first()

        total_revenue = float(completed_agg[0]) if completed_agg else 0.0
        total_tips = float(completed_agg[1]) if completed_agg else 0.0

        refund_agg = base_q.filter(
            PaymentTransaction.status == PaymentTransactionStatus.REFUNDED.value
        ).with_entities(
            func.count(PaymentTransaction.id),
            func.coalesce(func.sum(PaymentTransaction.amount), 0),
        ).first()

        refund_count = refund_agg[0] if refund_agg else 0
        refund_total = float(refund_agg[1]) if refund_agg else 0.0

        failed_count = base_q.filter(
            PaymentTransaction.status == PaymentTransactionStatus.FAILED.value
        ).count()

        avg_amount = (total_revenue / completed_count) if completed_count > 0 else 0.0
        success_rate = (
            round(completed_count / total_txns * 100, 1) if total_txns > 0 else 0.0
        )

        return {
            "period_days": days,
            "total_transactions": total_txns,
            "completed_count": completed_count,
            "failed_count": failed_count,
            "refund_count": refund_count,
            "total_revenue": round(total_revenue, 2),
            "total_tips": round(total_tips, 2),
            "refund_total": round(refund_total, 2),
            "net_revenue": round(total_revenue - refund_total, 2),
            "avg_transaction_amount": round(avg_amount, 2),
            "success_rate_pct": success_rate,
        }

    def get_report_by_method(
        self,
        business_id: uuid.UUID,
        *,
        days: int = 30,
    ) -> List[Dict[str, Any]]:
        """Break down payment totals by payment method type.

        Joins PaymentTransaction → PaymentMethod to group by method_type.
        Returns count, total, avg, and success rate per method.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        rows = (
            self.db.query(
                PaymentMethod.method_type,
                PaymentMethod.name,
                func.count(PaymentTransaction.id).label("txn_count"),
                func.coalesce(func.sum(PaymentTransaction.amount), 0).label(
                    "total_amount"
                ),
                func.coalesce(func.sum(PaymentTransaction.tip_amount), 0).label(
                    "total_tips"
                ),
                func.sum(
                    case(
                        (
                            PaymentTransaction.status
                            == PaymentTransactionStatus.COMPLETED.value,
                            1,
                        ),
                        else_=0,
                    )
                ).label("completed_count"),
            )
            .join(
                PaymentMethod,
                PaymentTransaction.payment_method_id == PaymentMethod.id,
            )
            .filter(
                PaymentTransaction.business_id == business_id,
                PaymentTransaction.created_at >= cutoff,
            )
            .group_by(PaymentMethod.method_type, PaymentMethod.name)
            .order_by(func.sum(PaymentTransaction.amount).desc())
            .all()
        )

        results = []
        for row in rows:
            count = row.txn_count or 0
            total = float(row.total_amount or 0)
            completed = row.completed_count or 0
            results.append({
                "method_type": row.method_type,
                "method_name": row.name,
                "transaction_count": count,
                "total_amount": round(total, 2),
                "total_tips": round(float(row.total_tips or 0), 2),
                "avg_amount": round(total / count, 2) if count > 0 else 0.0,
                "success_rate_pct": (
                    round(completed / count * 100, 1) if count > 0 else 0.0
                ),
            })
        return results

    def get_transactions_for_export(
        self,
        business_id: uuid.UUID,
        *,
        days: int = 30,
        method_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Return transaction data formatted for CSV/JSON export.

        Gateway responses are excluded and gateway references are masked
        for security.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        query = (
            self.db.query(PaymentTransaction)
            .outerjoin(
                PaymentMethod,
                PaymentTransaction.payment_method_id == PaymentMethod.id,
            )
            .filter(
                PaymentTransaction.business_id == business_id,
                PaymentTransaction.created_at >= cutoff,
            )
        )

        if method_type:
            query = query.filter(PaymentMethod.method_type == method_type)
        if status:
            query = query.filter(PaymentTransaction.status == status)

        query = query.order_by(PaymentTransaction.created_at.desc())
        transactions = query.all()

        return [
            {
                "id": str(txn.id),
                "order_id": str(txn.order_id),
                "amount": float(txn.amount),
                "tip_amount": float(txn.tip_amount),
                "status": txn.status,
                "gateway_reference": self.mask_reference(txn.gateway_reference),
                "processed_at": (
                    txn.processed_at.isoformat() if txn.processed_at else None
                ),
                "created_at": txn.created_at.isoformat(),
            }
            for txn in transactions
        ]

    # -----------------------------------------------------------------------
    # Security Helpers
    # -----------------------------------------------------------------------

    # -----------------------------------------------------------------------
    # Cash Drawer Sessions
    # -----------------------------------------------------------------------

    def open_cash_drawer(
        self,
        business_id: uuid.UUID,
        opened_by_id: uuid.UUID,
        opening_float: Decimal,
        notes: Optional[str] = None,
    ) -> CashDrawerSession:
        """Open a new cash drawer session. Raises if one is already open."""
        existing = (
            self.db.query(CashDrawerSession)
            .filter(
                CashDrawerSession.business_id == business_id,
                CashDrawerSession.status == CashDrawerStatus.OPEN.value,
                CashDrawerSession.deleted_at.is_(None),
            )
            .first()
        )
        if existing:
            raise ValueError("A cash drawer session is already open for this business")

        session = CashDrawerSession(
            id=uuid.uuid4(),
            business_id=business_id,
            opened_by_id=opened_by_id,
            opening_float=opening_float,
            status=CashDrawerStatus.OPEN.value,
            notes=notes,
            opened_at=datetime.now(timezone.utc),
        )
        self.db.add(session)
        self.db.flush()
        return session

    def close_cash_drawer(
        self,
        session_id: uuid.UUID,
        business_id: uuid.UUID,
        closed_by_id: uuid.UUID,
        closing_float: Decimal,
        notes: Optional[str] = None,
    ) -> CashDrawerSession:
        """Close a cash drawer session and calculate variance."""
        session = (
            self.db.query(CashDrawerSession)
            .filter(
                CashDrawerSession.id == session_id,
                CashDrawerSession.business_id == business_id,
                CashDrawerSession.status == CashDrawerStatus.OPEN.value,
                CashDrawerSession.deleted_at.is_(None),
            )
            .first()
        )
        if not session:
            raise ValueError("Open cash drawer session not found")

        # Calculate expected float: opening + cash sales - cash refunds during session
        cash_in = (
            self.db.query(func.coalesce(func.sum(PaymentTransaction.amount), Decimal(0)))
            .filter(
                PaymentTransaction.business_id == business_id,
                PaymentTransaction.status == PaymentTransactionStatus.COMPLETED.value,
                PaymentTransaction.processed_at >= session.opened_at,
            )
            .scalar()
        )
        expected = session.opening_float + (cash_in or Decimal(0))

        session.closed_by_id = closed_by_id
        session.closing_float = closing_float
        session.expected_float = expected
        session.variance = closing_float - expected
        session.status = CashDrawerStatus.CLOSED.value
        session.closed_at = datetime.now(timezone.utc)
        if notes:
            session.notes = notes

        self.db.flush()
        return session

    def get_active_session(self, business_id: uuid.UUID) -> Optional[CashDrawerSession]:
        """Return the currently open cash drawer session, or None."""
        return (
            self.db.query(CashDrawerSession)
            .filter(
                CashDrawerSession.business_id == business_id,
                CashDrawerSession.status == CashDrawerStatus.OPEN.value,
                CashDrawerSession.deleted_at.is_(None),
            )
            .first()
        )

    @staticmethod
    def mask_reference(ref: Optional[str]) -> Optional[str]:
        """Mask a gateway reference, showing only the last 4 characters.

        Prevents full reference exposure in exports and logs while
        keeping enough info for reconciliation lookups.
        """
        if not ref or len(ref) <= 4:
            return ref
        return "*" * (len(ref) - 4) + ref[-4:]

    @staticmethod
    def mask_gateway_response(response: Optional[dict]) -> Optional[dict]:
        """Strip sensitive fields from a gateway response payload.

        Removes card numbers, tokens, and secrets while preserving
        status codes, messages, and timestamps for debugging.
        """
        if not response:
            return None

        sensitive_keys = {
            "card_number", "pan", "token", "secret", "password",
            "cvv", "cvc", "pin", "account_number",
        }
        masked = {}
        for key, value in response.items():
            if key.lower() in sensitive_keys:
                masked[key] = "***REDACTED***"
            elif isinstance(value, dict):
                masked[key] = PaymentService.mask_gateway_response(value)
            else:
                masked[key] = value
        return masked
