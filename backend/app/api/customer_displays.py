"""API endpoints for customer-facing display management.

Provides CRUD for display devices, configuration, and heartbeat tracking.
"""

import math
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.schemas.customer_display import (
    CustomerDisplayCreate,
    CustomerDisplayUpdate,
    CustomerDisplayResponse,
    CustomerDisplayListResponse,
    DisplayConfigCreate,
    DisplayConfigUpdate,
    DisplayConfigResponse,
)
from app.services.customer_display_service import CustomerDisplayService

router = APIRouter(prefix="/displays", tags=["Customer Displays"])


# ---------------------------------------------------------------------------
# Display Devices
# ---------------------------------------------------------------------------


@router.get("", response_model=CustomerDisplayListResponse)
def list_displays(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List customer displays for the current business."""
    svc = CustomerDisplayService(db)
    items, total = svc.list_displays(business_id, page=page, per_page=per_page)
    return CustomerDisplayListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("", response_model=CustomerDisplayResponse, status_code=201)
def register_display(
    payload: CustomerDisplayCreate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Register a new customer-facing display."""
    svc = CustomerDisplayService(db)
    return svc.register_display(
        business_id,
        name=payload.name,
        display_type=payload.display_type,
        terminal_id=payload.terminal_id,
    )


@router.get("/{display_id}", response_model=CustomerDisplayResponse)
def get_display(
    display_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get a single display by ID."""
    svc = CustomerDisplayService(db)
    display = svc.get_display(display_id)
    if not display:
        raise HTTPException(status_code=404, detail="Display not found")
    return display


@router.patch("/{display_id}", response_model=CustomerDisplayResponse)
def update_display(
    display_id: UUID,
    payload: CustomerDisplayUpdate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update a display."""
    svc = CustomerDisplayService(db)
    display = svc.update_display(display_id, **payload.model_dump(exclude_unset=True))
    if not display:
        raise HTTPException(status_code=404, detail="Display not found")
    return display


@router.delete("/{display_id}", status_code=204)
def delete_display(
    display_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Soft-delete a display."""
    svc = CustomerDisplayService(db)
    if not svc.delete_display(display_id):
        raise HTTPException(status_code=404, detail="Display not found")


@router.post("/{display_id}/heartbeat", response_model=CustomerDisplayResponse)
def heartbeat(
    display_id: UUID,
    db: Session = Depends(get_sync_db),
):
    """Record a heartbeat from a display device.

    Note: No auth required — displays authenticate via their ID.
    In production, add device token auth.
    """
    svc = CustomerDisplayService(db)
    display = svc.heartbeat(display_id)
    if not display:
        raise HTTPException(status_code=404, detail="Display not found")
    return display


# ---------------------------------------------------------------------------
# Display Config
# ---------------------------------------------------------------------------


@router.post("/{display_id}/config", response_model=DisplayConfigResponse, status_code=201)
def create_config(
    display_id: UUID,
    payload: DisplayConfigCreate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Create configuration for a display."""
    svc = CustomerDisplayService(db)
    return svc.create_config(
        display_id,
        layout=payload.layout,
        orientation=payload.orientation,
        theme=payload.theme,
        features=payload.features,
        language=payload.language,
    )


@router.get("/{display_id}/config", response_model=DisplayConfigResponse)
def get_config(
    display_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get configuration for a display."""
    svc = CustomerDisplayService(db)
    config = svc.get_config(display_id)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config


@router.patch("/{display_id}/config", response_model=DisplayConfigResponse)
def update_config(
    display_id: UUID,
    payload: DisplayConfigUpdate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update display configuration."""
    svc = CustomerDisplayService(db)
    config = svc.update_config(display_id, **payload.model_dump(exclude_unset=True))
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config
