"""Laybys API endpoints."""

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.services.layby_service import LaybyService
from app.services.layby_report_service import LaybyReportService
from app.schemas.layby import (
    LaybyCreate,
    LaybyResponse,
    LaybyListResponse,
    PaymentCreate,
    PaymentResponse,
    ScheduleResponse,
    LaybyExtendRequest,
    LaybyCancelRequest,
    LaybyConfigResponse,
    LaybyConfigUpdate,
)

router = APIRouter(prefix="/laybys", tags=["Laybys"])


# ── Reports (must be before /{layby_id} to avoid path conflicts) ─────────


@router.get("/reports/active")
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


@router.get("/reports/overdue")
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


@router.get("/reports/aging")
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


@router.get("/reports/summary")
async def summary_report(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get laybys summary statistics."""
    try:
        service = LaybyReportService(db)
        return service.get_summary(business_id=business_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get summary report: {str(e)}",
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
    """Create a new layby."""
    try:
        service = LaybyService(db)
        layby = service.create_layby(
            business_id=business_id,
            user_id=str(current_user.id),
            data=data,
        )
        return layby
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
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
