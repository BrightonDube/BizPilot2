"""API endpoints for partner (reseller) administration.

Provides CRUD for partners, configuration, white-label branding,
and partner user management.
"""

import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.core.database import get_sync_db
from app.schemas.partner import (
    PartnerCreate,
    PartnerUpdate,
    PartnerResponse,
    PartnerListResponse,
    PartnerConfigurationUpdate,
    PartnerConfigurationResponse,
    WhiteLabelConfigCreate,
    WhiteLabelConfigUpdate,
    WhiteLabelConfigResponse,
    PartnerUserCreate,
    PartnerUserUpdate,
    PartnerUserResponse,
    PartnerUserListResponse,
)
from app.services.partner_service import PartnerService

router = APIRouter(prefix="/partners", tags=["Partner Admin"])


# ---------------------------------------------------------------------------
# Partners
# ---------------------------------------------------------------------------


@router.get("", response_model=PartnerListResponse)
def list_partners(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List all partners with optional status filter."""
    svc = PartnerService(db)
    items, total = svc.list_partners(status, page, per_page)
    pages = max(1, math.ceil(total / per_page))
    return PartnerListResponse(
        items=items, total=total, page=page, per_page=per_page, pages=pages
    )


@router.post("", response_model=PartnerResponse, status_code=201)
def create_partner(
    data: PartnerCreate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Create a new partner."""
    svc = PartnerService(db)
    return svc.create_partner(**data.model_dump())


@router.get("/{partner_id}", response_model=PartnerResponse)
def get_partner(
    partner_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get a partner by ID."""
    svc = PartnerService(db)
    partner = svc.get_partner(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return partner


@router.get("/slug/{slug}", response_model=PartnerResponse)
def get_partner_by_slug(
    slug: str,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get a partner by slug (used for white-label domain resolution)."""
    svc = PartnerService(db)
    partner = svc.get_partner_by_slug(slug)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return partner


@router.put("/{partner_id}", response_model=PartnerResponse)
def update_partner(
    partner_id: UUID,
    data: PartnerUpdate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update a partner."""
    svc = PartnerService(db)
    partner = svc.update_partner(
        partner_id, **data.model_dump(exclude_unset=True)
    )
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return partner


@router.delete("/{partner_id}", status_code=204)
def delete_partner(
    partner_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Soft-delete a partner."""
    svc = PartnerService(db)
    if not svc.delete_partner(partner_id):
        raise HTTPException(status_code=404, detail="Partner not found")


# ---------------------------------------------------------------------------
# Partner Configuration
# ---------------------------------------------------------------------------


@router.get(
    "/{partner_id}/configuration",
    response_model=PartnerConfigurationResponse,
)
def get_partner_configuration(
    partner_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get configuration for a partner."""
    svc = PartnerService(db)
    config = svc.get_configuration(partner_id)
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return config


@router.put(
    "/{partner_id}/configuration",
    response_model=PartnerConfigurationResponse,
)
def update_partner_configuration(
    partner_id: UUID,
    data: PartnerConfigurationUpdate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update partner configuration."""
    svc = PartnerService(db)
    config = svc.update_configuration(
        partner_id, **data.model_dump(exclude_unset=True)
    )
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return config


# ---------------------------------------------------------------------------
# White Label Config
# ---------------------------------------------------------------------------


@router.get(
    "/{partner_id}/white-label",
    response_model=WhiteLabelConfigResponse,
)
def get_white_label(
    partner_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get white-label branding for a partner."""
    svc = PartnerService(db)
    wl = svc.get_white_label(partner_id)
    if not wl:
        raise HTTPException(status_code=404, detail="White-label config not found")
    return wl


@router.post(
    "/{partner_id}/white-label",
    response_model=WhiteLabelConfigResponse,
    status_code=201,
)
def create_white_label(
    partner_id: UUID,
    data: WhiteLabelConfigCreate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Create white-label branding for a partner."""
    svc = PartnerService(db)
    return svc.create_white_label(partner_id, **data.model_dump())


@router.put(
    "/{partner_id}/white-label",
    response_model=WhiteLabelConfigResponse,
)
def update_white_label(
    partner_id: UUID,
    data: WhiteLabelConfigUpdate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update white-label branding."""
    svc = PartnerService(db)
    wl = svc.update_white_label(
        partner_id, **data.model_dump(exclude_unset=True)
    )
    if not wl:
        raise HTTPException(status_code=404, detail="White-label config not found")
    return wl


# ---------------------------------------------------------------------------
# Partner Users
# ---------------------------------------------------------------------------


@router.get(
    "/{partner_id}/users",
    response_model=PartnerUserListResponse,
)
def list_partner_users(
    partner_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List users belonging to a partner."""
    svc = PartnerService(db)
    items, total = svc.list_partner_users(partner_id, page, per_page)
    pages = max(1, math.ceil(total / per_page))
    return PartnerUserListResponse(
        items=items, total=total, page=page, per_page=per_page, pages=pages
    )


@router.post(
    "/{partner_id}/users",
    response_model=PartnerUserResponse,
    status_code=201,
)
def add_partner_user(
    partner_id: UUID,
    data: PartnerUserCreate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Add a user to a partner organisation."""
    svc = PartnerService(db)
    return svc.add_partner_user(
        partner_id=partner_id,
        user_id=data.user_id,
        partner_role=data.partner_role,
        permissions=data.permissions,
        is_primary_contact=data.is_primary_contact,
    )


@router.put(
    "/users/{partner_user_id}",
    response_model=PartnerUserResponse,
)
def update_partner_user(
    partner_user_id: UUID,
    data: PartnerUserUpdate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update a partner user."""
    svc = PartnerService(db)
    pu = svc.update_partner_user(
        partner_user_id, **data.model_dump(exclude_unset=True)
    )
    if not pu:
        raise HTTPException(status_code=404, detail="Partner user not found")
    return pu


@router.delete("/users/{partner_user_id}", status_code=204)
def remove_partner_user(
    partner_user_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Remove a user from a partner organisation."""
    svc = PartnerService(db)
    if not svc.remove_partner_user(partner_user_id):
        raise HTTPException(status_code=404, detail="Partner user not found")
