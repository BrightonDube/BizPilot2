"""Modifier availability API endpoints.

Manages time-based, day-based, date-range, and location-specific
availability rules for individual modifiers (Requirement 6).

Why a separate router instead of adding to addons.py?
The addons router already has 15 endpoints.  Availability rules
are a distinct concern (scheduling vs. CRUD) and will grow to
include bulk operations and reporting.  Keeping them separate
follows the Single Responsibility Principle and makes the
codebase easier to navigate.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.models.user import User
from app.schemas.modifier import (
    ModifierAvailabilityCreate,
    ModifierAvailabilityResponse,
    ModifierAvailabilityUpdate,
)
from app.services.modifier_availability_service import ModifierAvailabilityService

router = APIRouter(prefix="/modifiers", tags=["Modifier Availability"])


# ── Availability Rule CRUD ───────────────────────────────────────


@router.post(
    "/{modifier_id}/availability",
    response_model=ModifierAvailabilityResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_availability_rule(
    modifier_id: UUID,
    data: ModifierAvailabilityCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create an availability rule for a modifier.

    Rules control when and where a modifier option is available.
    Multiple rules can be combined — a modifier is available if
    *any* matching rule says is_available=True and no matching
    rule says is_available=False.
    """
    service = ModifierAvailabilityService(db)
    rule = service.create_availability_rule(
        modifier_id=str(modifier_id),
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
        start_date=data.start_date,
        end_date=data.end_date,
        location_id=str(data.location_id) if data.location_id else None,
        is_available=data.is_available,
    )
    return rule


@router.get(
    "/{modifier_id}/availability",
    response_model=List[ModifierAvailabilityResponse],
)
async def list_availability_rules(
    modifier_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List all availability rules for a modifier."""
    service = ModifierAvailabilityService(db)
    return service.get_availability_rules(str(modifier_id))


@router.put(
    "/availability/{rule_id}",
    response_model=ModifierAvailabilityResponse,
)
async def update_availability_rule(
    rule_id: UUID,
    data: ModifierAvailabilityUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update an availability rule."""
    service = ModifierAvailabilityService(db)
    update_data = data.model_dump(exclude_unset=True)
    rule = service.update_availability_rule(str(rule_id), **update_data)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability rule not found",
        )
    return rule


@router.delete(
    "/availability/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_availability_rule(
    rule_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Delete an availability rule."""
    service = ModifierAvailabilityService(db)
    deleted = service.delete_availability_rule(str(rule_id))
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability rule not found",
        )


# ── Availability Check (read-only) ──────────────────────────────


@router.get(
    "/{modifier_id}/check-availability",
)
async def check_modifier_availability(
    modifier_id: UUID,
    location_id: UUID = Query(None, description="Location to check against"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Check if a modifier is currently available at a given location.

    This is the endpoint the POS/cart calls in real-time to determine
    whether a modifier option should be shown to the customer.
    """
    service = ModifierAvailabilityService(db)
    is_available = service.is_modifier_available(
        modifier_id=str(modifier_id),
        location_id=str(location_id) if location_id else None,
    )
    return {"modifier_id": str(modifier_id), "is_available": is_available}


@router.post(
    "/{modifier_id}/eighty-six",
    status_code=status.HTTP_200_OK,
)
async def eighty_six_modifier(
    modifier_id: UUID,
    location_id: UUID = Query(None, description="Location to 86 at; NULL = all"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Mark a modifier as 86'd (out of stock / unavailable).

    In restaurant terminology, '86'd' means an item is no longer
    available.  This creates an is_available=False rule with no time
    constraints, effectively blocking the modifier immediately.
    """
    service = ModifierAvailabilityService(db)
    rule = service.eighty_six_modifier(
        modifier_id=str(modifier_id),
        location_id=str(location_id) if location_id else None,
    )
    return {"modifier_id": str(modifier_id), "status": "86d", "rule_id": str(rule.id)}


@router.delete(
    "/{modifier_id}/eighty-six",
    status_code=status.HTTP_200_OK,
)
async def un_eighty_six_modifier(
    modifier_id: UUID,
    location_id: UUID = Query(None, description="Location to un-86 at"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Remove the 86'd status from a modifier (mark as available again).

    Deletes any is_available=False rules that have no time/date
    constraints (i.e., the "global unavailable" markers).
    """
    service = ModifierAvailabilityService(db)
    removed = service.un_eighty_six_modifier(
        modifier_id=str(modifier_id),
        location_id=str(location_id) if location_id else None,
    )
    return {
        "modifier_id": str(modifier_id),
        "status": "available",
        "rules_removed": removed,
    }
