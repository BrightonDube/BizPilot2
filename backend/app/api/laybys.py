"""Laybys API endpoints."""

import csv
import io
import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.models.product import Product
from app.services.layby_service import LaybyService
from app.services.layby_report_service import LaybyReportService
from app.schemas.layby import (
    LaybyCreate,
    LaybyResponse,
    LaybyListResponse,
    PaymentCreate,
    PaymentResponse,
    RefundCreate,
    ScheduleResponse,
    LaybyExtendRequest,
    LaybyCancelRequest,
    LaybyConfigResponse,
    LaybyConfigUpdate,
)
from app.schemas.layby_report import (
    ActiveLaybyReport,
    OverdueReport,
    AgingReport,
    LaybySummaryReport,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/laybys", tags=["Laybys"])


# ── Reports (must be before /{layby_id} to avoid path conflicts) ─────────


@router.get("/reports/active", response_model=ActiveLaybyReport)
async def active_laybys_report(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get active laybys summary report."""
    try:
        service = LaybyReportService(db)
        return service.get_active_summary(business_id=business_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get active laybys report: {str(e)}",
        )


@router.get("/reports/overdue", response_model=OverdueReport)
async def overdue_laybys_report(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get overdue laybys report."""
    try:
        service = LaybyReportService(db)
        return service.get_overdue(business_id=business_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get overdue laybys report: {str(e)}",
        )


@router.get("/reports/aging", response_model=AgingReport)
async def aging_report(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get laybys aging report."""
    try:
        service = LaybyReportService(db)
        return service.get_aging_report(business_id=business_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get aging report: {str(e)}",
        )


@router.get("/reports/summary", response_model=LaybySummaryReport)
async def summary_report(
    start_date: Optional[date] = Query(None, description="Start of reporting period"),
    end_date: Optional[date] = Query(None, description="End of reporting period"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get laybys summary statistics for a date range.

    Defaults to the last 30 days if no dates are provided.
    """
    try:
        # Default to last 30 days if no range specified
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        service = LaybyReportService(db)
        return service.get_summary(
            business_id=business_id,
            start_date=start_date,
            end_date=end_date,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get summary report: {str(e)}",
        )


@router.get("/reports/export")
async def export_laybys_csv(
    report_type: str = Query("active", description="Report type: active, overdue, aging, summary"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Export a layby report as a CSV file.

    Supported ``report_type`` values: active, overdue, aging, summary.
    """
    try:
        service = LaybyReportService(db)
        output = io.StringIO()
        writer = csv.writer(output)

        if report_type == "active":
            data = service.get_active_laybys(business_id=business_id)
            writer.writerow(["Metric", "Value"])
            for key, val in data.items():
                writer.writerow([key, val])

        elif report_type == "overdue":
            data = service.get_overdue_laybys(business_id=business_id)
            writer.writerow(["Reference", "Customer ID", "Balance Due", "Next Payment", "Days Overdue"])
            for lb in data.get("laybys", []):
                writer.writerow([
                    lb.get("reference_number"),
                    lb.get("customer_id"),
                    lb.get("balance_due"),
                    lb.get("next_payment_date"),
                    lb.get("days_overdue"),
                ])

        elif report_type == "aging":
            data = service.get_aging_report(business_id=business_id)
            writer.writerow(["Bucket", "Count", "Total Value", "Total Outstanding"])
            for bucket_name, bucket_data in data.get("buckets", {}).items():
                writer.writerow([
                    bucket_name,
                    bucket_data.get("count"),
                    bucket_data.get("total_value"),
                    bucket_data.get("total_outstanding"),
                ])

        elif report_type == "summary":
            sd = start_date or (date.today() - timedelta(days=30))
            ed = end_date or date.today()
            data = service.get_summary(business_id=business_id, start_date=sd, end_date=ed)
            writer.writerow(["Metric", "Value"])
            writer.writerow(["Period", f"{data['start_date']} to {data['end_date']}"])
            writer.writerow(["Created Count", data["created"]["count"]])
            writer.writerow(["Created Value", data["created"]["total_value"]])
            writer.writerow(["Completed", data["completed"]["count"]])
            writer.writerow(["Cancelled", data["cancelled"]["count"]])
            writer.writerow(["Payments Count", data["payments"]["count"]])
            writer.writerow(["Payments Total", data["payments"]["total"]])
            writer.writerow(["Refunds Total", data["refunds"]["total"]])
            writer.writerow(["Active Snapshot", data["active_snapshot"]["count"]])
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown report type: {report_type}",
            )

        output.seek(0)
        filename = f"layby_{report_type}_report.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export report: {str(e)}",
        )


# ── Config (must be before /{layby_id} to avoid path conflicts) ─────────


@router.get("/config", response_model=LaybyConfigResponse)
async def get_config(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get layby configuration for the current business."""
    try:
        service = LaybyService(db)
        config = service.get_config(business_id=business_id)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Layby configuration not found",
            )
        return config
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get config: {str(e)}",
        )


@router.put("/config", response_model=LaybyConfigResponse)
async def update_config(
    data: LaybyConfigUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update layby configuration for the current business."""
    try:
        service = LaybyService(db)
        config = service.update_config(business_id=business_id, data=data)
        return config
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update config: {str(e)}",
        )


# ── CRUD ─────────────────────────────────────────────────────────────────────


@router.post("", response_model=LaybyResponse, status_code=status.HTTP_201_CREATED)
async def create_layby(
    data: LaybyCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """
    Create a new layby.

    Validates each product exists, then delegates to LaybyService.create_layby
    with the positional arguments it expects.

    Root-cause fix: the previous implementation passed ``user_id`` and ``data``
    as keyword arguments, which do not exist on LaybyService.create_layby,
    causing an immediate TypeError → 500.
    """
    try:
        # Resolve product names required by LaybyService
        items: List[dict] = []
        for li in data.items:
            product = (
                db.query(Product)
                .filter(
                    Product.id == li.product_id,
                    Product.business_id == business_id,
                    Product.deleted_at.is_(None),
                )
                .first()
            )
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product {li.product_id} not found in this business",
                )
            items.append(
                {
                    "product_id": str(li.product_id),
                    "product_name": product.name,
                    "product_sku": product.sku,
                    "quantity": li.quantity,
                    "unit_price": li.unit_price,
                    "discount_amount": Decimal("0.00"),
                    "tax_amount": Decimal("0.00"),
                }
            )

        service = LaybyService(db)
        layby = service.create_layby(
            business_id=UUID(business_id),
            customer_id=data.customer_id,
            items=items,
            deposit_amount=data.deposit_amount,
            frequency=data.payment_frequency,
            created_by=current_user.id,
            notes=data.notes,
        )
        return layby
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error creating layby: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create layby: {str(e)}",
        )


@router.get("", response_model=LaybyListResponse)
async def list_laybys(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    customer_id: Optional[UUID] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List laybys with filters and pagination."""
    try:
        service = LaybyService(db)
        items, total = service.list_laybys(
            business_id=business_id,
            page=page,
            per_page=per_page,
            status=status_filter,
            customer_id=str(customer_id) if customer_id else None,
            search=search,
        )
        pages = (total + per_page - 1) // per_page
        return LaybyListResponse(
            items=items, total=total, page=page, per_page=per_page, pages=pages
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list laybys: {str(e)}",
        )


@router.get("/{layby_id}", response_model=LaybyResponse)
async def get_layby(
    layby_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get layby details."""
    try:
        service = LaybyService(db)
        layby = service.get_layby(
            layby_id=str(layby_id), business_id=business_id
        )
        if not layby:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Layby not found"
            )
        return layby
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get layby: {str(e)}",
        )


# ── Payments ─────────────────────────────────────────────────────────────────


@router.post("/{layby_id}/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def make_payment(
    layby_id: UUID,
    data: PaymentCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Make a payment on a layby."""
    try:
        service = LaybyService(db)
        payment = service.make_payment(
            layby_id=str(layby_id),
            business_id=business_id,
            user_id=str(current_user.id),
            data=data,
        )
        return payment
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process payment: {str(e)}",
        )


@router.get("/{layby_id}/payments", response_model=List[PaymentResponse])
async def get_payments(
    layby_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get payment history for a layby."""
    try:
        service = LaybyService(db)
        payments = service.get_payments(
            layby_id=str(layby_id), business_id=business_id
        )
        return payments
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get payments: {str(e)}",
        )


@router.get("/{layby_id}/schedule", response_model=List[ScheduleResponse])
async def get_schedule(
    layby_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get payment schedule for a layby."""
    try:
        service = LaybyService(db)
        schedule = service.get_schedule(
            layby_id=str(layby_id), business_id=business_id
        )
        return schedule
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get schedule: {str(e)}",
        )


@router.post(
    "/{layby_id}/payments/{payment_id}/refund",
    response_model=PaymentResponse,
)
async def refund_payment(
    layby_id: UUID,
    payment_id: UUID,
    data: RefundCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Refund a specific layby payment (full or partial).

    If ``amount`` is omitted the entire payment is refunded.
    """
    try:
        service = LaybyService(db)
        payment = service.refund_payment(
            business_id=business_id,
            layby_id=layby_id,
            payment_id=payment_id,
            reason=data.reason,
            refunded_by=current_user.id,
            refund_amount=data.amount,
        )
        return payment
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process refund: {str(e)}",
        )


# ── Actions ──────────────────────────────────────────────────────────────────


@router.post("/{layby_id}/cancel", response_model=LaybyResponse)
async def cancel_layby(
    layby_id: UUID,
    data: Optional[LaybyCancelRequest] = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Cancel a layby."""
    try:
        service = LaybyService(db)
        reason = data.reason if data else None
        layby = service.cancel_layby(
            layby_id=str(layby_id),
            business_id=business_id,
            user_id=str(current_user.id),
            reason=reason,
        )
        return layby
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel layby: {str(e)}",
        )


@router.post("/{layby_id}/collect", response_model=LaybyResponse)
async def collect_layby(
    layby_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Mark a layby as collected."""
    try:
        service = LaybyService(db)
        layby = service.collect_layby(
            layby_id=str(layby_id),
            business_id=business_id,
            user_id=str(current_user.id),
        )
        return layby
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to collect layby: {str(e)}",
        )


@router.post("/{layby_id}/extend", response_model=LaybyResponse)
async def extend_layby(
    layby_id: UUID,
    data: LaybyExtendRequest,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Extend a layby end date."""
    try:
        service = LaybyService(db)
        layby = service.extend_layby(
            layby_id=str(layby_id),
            business_id=business_id,
            user_id=str(current_user.id),
            additional_days=data.additional_days,
            reason=data.reason,
        )
        return layby
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extend layby: {str(e)}",
        )
