"""API endpoints for integrated payment processing.

Provides CRUD for payment methods and transaction management (create,
complete, refund, list) scoped to the current business.
Includes payment report endpoints and CSV export.
"""

import csv
import io
import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.schemas.payment import (
    PaymentMethodCreate,
    PaymentMethodUpdate,
    PaymentMethodResponse,
    PaymentMethodListResponse,
    PaymentTransactionCreate,
    PaymentTransactionResponse,
    PaymentTransactionListResponse,
)
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["Payments"])


# ---------------------------------------------------------------------------
# Payment Methods
# ---------------------------------------------------------------------------


@router.get("/methods", response_model=PaymentMethodListResponse)
def list_payment_methods(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    active_only: bool = Query(True),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List configured payment methods for the current business."""
    svc = PaymentService(db)
    items, total = svc.list_methods(
        business_id, active_only=active_only, page=page, per_page=per_page
    )
    return PaymentMethodListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/methods", response_model=PaymentMethodResponse, status_code=201)
def create_payment_method(
    payload: PaymentMethodCreate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Register a new payment method."""
    svc = PaymentService(db)
    return svc.create_method(
        business_id,
        name=payload.name,
        method_type=payload.method_type,
        provider=payload.provider,
        config=payload.config,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )


@router.get("/methods/{method_id}", response_model=PaymentMethodResponse)
def get_payment_method(
    method_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get a single payment method by ID."""
    svc = PaymentService(db)
    method = svc.get_method(method_id)
    if not method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return method


@router.patch("/methods/{method_id}", response_model=PaymentMethodResponse)
def update_payment_method(
    method_id: UUID,
    payload: PaymentMethodUpdate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update a payment method configuration."""
    svc = PaymentService(db)
    method = svc.update_method(method_id, **payload.model_dump(exclude_unset=True))
    if not method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return method


@router.delete("/methods/{method_id}", status_code=204)
def delete_payment_method(
    method_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Soft-delete a payment method."""
    svc = PaymentService(db)
    if not svc.delete_method(method_id):
        raise HTTPException(status_code=404, detail="Payment method not found")


# ---------------------------------------------------------------------------
# Payment Transactions
# ---------------------------------------------------------------------------


@router.get("/transactions", response_model=PaymentTransactionListResponse)
def list_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    order_id: Optional[UUID] = None,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List payment transactions for the current business."""
    svc = PaymentService(db)
    items, total = svc.list_transactions(
        business_id, order_id=order_id, page=page, per_page=per_page
    )
    return PaymentTransactionListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/transactions", response_model=PaymentTransactionResponse, status_code=201)
def create_transaction(
    payload: PaymentTransactionCreate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Record a new payment transaction for an order."""
    svc = PaymentService(db)
    return svc.create_transaction(
        business_id,
        order_id=payload.order_id,
        payment_method_id=payload.payment_method_id,
        amount=payload.amount,
        tip_amount=payload.tip_amount,
    )


@router.post("/transactions/{txn_id}/complete", response_model=PaymentTransactionResponse)
def complete_transaction(
    txn_id: UUID,
    gateway_reference: Optional[str] = None,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Mark a transaction as completed."""
    svc = PaymentService(db)
    txn = svc.complete_transaction(txn_id, gateway_reference)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


@router.post("/transactions/{txn_id}/refund", response_model=PaymentTransactionResponse)
def refund_transaction(
    txn_id: UUID,
    amount: float = Query(..., gt=0),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Create a refund for a completed transaction."""
    from decimal import Decimal

    svc = PaymentService(db)
    refund = svc.refund_transaction(txn_id, Decimal(str(amount)))
    if not refund:
        raise HTTPException(
            status_code=400,
            detail="Refund failed. Transaction not found or amount exceeds original.",
        )
    return refund


# ---------------------------------------------------------------------------
# Payment Reports
# ---------------------------------------------------------------------------


@router.get("/reports/summary")
def payment_summary_report(
    days: int = Query(30, ge=1, le=365, description="Report period in days"),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get a payment summary for the given period.

    Returns total revenue, tips, refunds, transaction counts,
    average amount, and success rate.
    """
    svc = PaymentService(db)
    return svc.get_payment_summary(business_id, days=days)


@router.get("/reports/by-method")
def payment_report_by_method(
    days: int = Query(30, ge=1, le=365, description="Report period in days"),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Break down payment totals by payment method type.

    Returns count, total, average, and success rate per method.
    """
    svc = PaymentService(db)
    return svc.get_report_by_method(business_id, days=days)


@router.get("/reports/export/csv")
def export_transactions_csv(
    days: int = Query(30, ge=1, le=365),
    method_type: Optional[str] = Query(None, description="Filter by method type"),
    status: Optional[str] = Query(None, description="Filter by transaction status"),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Export payment transactions as a CSV file.

    Gateway references are masked for security. Gateway response
    payloads are excluded entirely from exports.
    """
    svc = PaymentService(db)
    rows = svc.get_transactions_for_export(
        business_id, days=days, method_type=method_type, status=status
    )

    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    else:
        writer = csv.writer(output)
        writer.writerow(["id", "order_id", "amount", "tip_amount", "status",
                         "gateway_reference", "processed_at", "created_at"])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=payment_transactions.csv"},
    )


@router.get("/reports/export/json")
def export_transactions_json(
    days: int = Query(30, ge=1, le=365),
    method_type: Optional[str] = Query(None, description="Filter by method type"),
    status: Optional[str] = Query(None, description="Filter by transaction status"),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Export payment transactions as JSON with masked sensitive data."""
    svc = PaymentService(db)
    return svc.get_transactions_for_export(
        business_id, days=days, method_type=method_type, status=status
    )
