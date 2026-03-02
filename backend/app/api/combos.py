"""Combo deal API endpoints.

Full CRUD for combo deals and their components, plus validation
and location-filtered listing (Requirement 4 of addons-modifiers spec).

Why a separate router from addons.py?
Combo deals are a distinct domain concept from modifiers.  While
modifiers attach to individual products, combos bundle multiple
products into a single offering.  Separate routers keep the
endpoints logically grouped and the files manageable.
"""

import math
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.models.user import User
from app.schemas.combo import (
    ComboDealCreate,
    ComboDealListResponse,
    ComboDealResponse,
    ComboDealUpdate,
    ComboComponentCreate,
    ComboComponentResponse,
    ComboComponentUpdate,
)
from app.services.combo_service import ComboService

router = APIRouter(prefix="/combos", tags=["Combo Deals"])


# ── Combo Deal CRUD ──────────────────────────────────────────────


@router.post(
    "",
    response_model=ComboDealResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_combo_deal(
    data: ComboDealCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a new combo deal, optionally with components."""
    service = ComboService(db)

    # Convert component schemas to dicts for the service layer
    components = None
    if data.components:
        components = [c.model_dump() for c in data.components]

    combo = service.create_combo(
        business_id=business_id,
        name=data.name,
        display_name=data.display_name,
        combo_price=data.combo_price,
        original_price=data.original_price,
        description=data.description,
        image_url=data.image_url,
        is_active=data.is_active,
        start_date=data.start_date,
        end_date=data.end_date,
        location_ids=[str(lid) for lid in data.location_ids] if data.location_ids else None,
        sort_order=data.sort_order,
        components=components,
    )
    return combo


@router.get(
    "",
    response_model=ComboDealListResponse,
)
async def list_combo_deals(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List combo deals with pagination and optional filtering."""
    service = ComboService(db)
    items, total = service.get_combos(
        business_id=business_id,
        is_active=is_active,
        page=page,
        per_page=per_page,
    )
    return ComboDealListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get(
    "/active",
    response_model=List[ComboDealResponse],
)
async def list_active_combos(
    location_id: UUID = Query(None, description="Filter by location"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List active combo deals, optionally filtered by location.

    This is the endpoint the POS/menu calls to show available combos.
    """
    service = ComboService(db)
    return service.get_active_combos_by_location(
        business_id=business_id,
        location_id=str(location_id) if location_id else None,
    )


@router.get(
    "/{combo_id}",
    response_model=ComboDealResponse,
)
async def get_combo_deal(
    combo_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get a single combo deal with its components."""
    service = ComboService(db)
    combo = service.get_combo_by_id(str(combo_id), business_id)
    if not combo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Combo deal not found",
        )
    return combo


@router.put(
    "/{combo_id}",
    response_model=ComboDealResponse,
)
async def update_combo_deal(
    combo_id: UUID,
    data: ComboDealUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update a combo deal.  Only provided fields are changed."""
    service = ComboService(db)
    update_data = data.model_dump(exclude_unset=True)
    combo = service.update_combo(str(combo_id), business_id, **update_data)
    if not combo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Combo deal not found",
        )
    return combo


@router.delete(
    "/{combo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_combo_deal(
    combo_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Soft-delete a combo deal."""
    service = ComboService(db)
    combo = service.delete_combo(str(combo_id), business_id)
    if not combo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Combo deal not found",
        )


# ── Combo Component CRUD ─────────────────────────────────────────


@router.post(
    "/{combo_id}/components",
    response_model=ComboComponentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_combo_component(
    combo_id: UUID,
    data: ComboComponentCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Add a component to a combo deal."""
    service = ComboService(db)
    try:
        component = service.add_combo_component(
            combo_id=str(combo_id),
            name=data.name,
            component_type=data.component_type,
            fixed_product_id=str(data.fixed_product_id) if data.fixed_product_id else None,
            allowed_category_ids=[str(cid) for cid in data.allowed_category_ids] if data.allowed_category_ids else None,
            allowed_product_ids=[str(pid) for pid in data.allowed_product_ids] if data.allowed_product_ids else None,
            quantity=data.quantity,
            sort_order=data.sort_order,
            allow_modifiers=data.allow_modifiers,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    return component


@router.get(
    "/{combo_id}/components",
    response_model=List[ComboComponentResponse],
)
async def list_combo_components(
    combo_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List all components for a combo deal."""
    service = ComboService(db)
    return service.get_combo_components(str(combo_id))


@router.put(
    "/components/{component_id}",
    response_model=ComboComponentResponse,
)
async def update_combo_component(
    component_id: UUID,
    data: ComboComponentUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update a combo component."""
    service = ComboService(db)
    update_data = data.model_dump(exclude_unset=True)
    component = service.update_combo_component(str(component_id), **update_data)
    if not component:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Combo component not found",
        )
    return component


@router.delete(
    "/components/{component_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_combo_component(
    component_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Soft-delete a combo component."""
    service = ComboService(db)
    removed = service.remove_combo_component(str(component_id))
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Combo component not found",
        )


# ── Combo Validation ─────────────────────────────────────────────


@router.post(
    "/{combo_id}/validate",
)
async def validate_combo_selection(
    combo_id: UUID,
    selections: List[dict],
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Validate a customer's combo selection before adding to cart.

    Each item in selections must have:
    - component_id: str
    - selected_product_id: str

    Returns validation result with any error messages.
    """
    service = ComboService(db)
    is_valid, errors = service.validate_combo_selection(
        combo_id=str(combo_id),
        component_selections=selections,
    )
    return {
        "combo_id": str(combo_id),
        "is_valid": is_valid,
        "errors": errors,
    }
