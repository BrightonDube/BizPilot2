"""Product addons / modifier-group API endpoints."""

from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel as PydanticBase, ConfigDict

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.models.user import User
from app.services.addon_service import AddonService

router = APIRouter(prefix="/addons", tags=["Addons"])


# ── Schemas ──────────────────────────────────────────────────────


class ModifierGroupCreate(PydanticBase):
    name: str
    selection_type: str = "single"
    is_required: bool = False
    min_selections: int = 0
    max_selections: Optional[int] = None
    description: Optional[str] = None


class ModifierGroupUpdate(PydanticBase):
    name: Optional[str] = None
    selection_type: Optional[str] = None
    is_required: Optional[bool] = None
    min_selections: Optional[int] = None
    max_selections: Optional[int] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None


class ModifierResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    group_id: UUID
    business_id: UUID
    name: str
    price_adjustment: Decimal
    is_default: bool
    is_available: bool
    sort_order: int


class ModifierGroupResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    description: Optional[str] = None
    selection_type: Optional[str] = None
    is_required: bool
    min_selections: int
    max_selections: Optional[int] = None
    sort_order: int
    modifiers: List[ModifierResponse] = []


class ModifierCreate(PydanticBase):
    name: str
    price_adjustment: Decimal = Decimal("0")
    is_default: bool = False
    sort_order: int = 0


class ModifierUpdate(PydanticBase):
    name: Optional[str] = None
    price_adjustment: Optional[Decimal] = None
    is_default: Optional[bool] = None
    is_available: Optional[bool] = None
    sort_order: Optional[int] = None


class AssignGroupRequest(PydanticBase):
    modifier_group_id: UUID
    sort_order: int = 0


class ProductModifierGroupResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    modifier_group_id: UUID
    sort_order: int


# ── Modifier Group endpoints ─────────────────────────────────────


@router.post(
    "/groups",
    response_model=ModifierGroupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_modifier_group(
    data: ModifierGroupCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a modifier group."""
    service = AddonService(db)
    group = service.create_modifier_group(
        business_id=business_id,
        name=data.name,
        selection_type=data.selection_type,
        is_required=data.is_required,
        min_selections=data.min_selections,
        max_selections=data.max_selections,
        description=data.description,
    )
    return group


@router.get("/groups", response_model=List[ModifierGroupResponse])
async def list_modifier_groups(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List all modifier groups for the current business."""
    service = AddonService(db)
    return service.list_modifier_groups(business_id)


@router.get("/groups/{group_id}", response_model=ModifierGroupResponse)
async def get_modifier_group(
    group_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get a modifier group by ID."""
    service = AddonService(db)
    group = service.get_modifier_group(str(group_id), business_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modifier group not found",
        )
    return group


@router.put("/groups/{group_id}", response_model=ModifierGroupResponse)
async def update_modifier_group(
    group_id: UUID,
    data: ModifierGroupUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update a modifier group."""
    service = AddonService(db)
    update_data = data.model_dump(exclude_unset=True)
    group = service.update_modifier_group(str(group_id), business_id, **update_data)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modifier group not found",
        )
    return group


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_modifier_group(
    group_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Delete a modifier group (soft-delete)."""
    service = AddonService(db)
    group = service.delete_modifier_group(str(group_id), business_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modifier group not found",
        )


# ── Modifier endpoints ───────────────────────────────────────────


@router.post(
    "/groups/{group_id}/modifiers",
    response_model=ModifierResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_modifier(
    group_id: UUID,
    data: ModifierCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Add a modifier to a group."""
    service = AddonService(db)
    try:
        modifier = service.add_modifier(
            group_id=str(group_id),
            name=data.name,
            price_adjustment=float(data.price_adjustment),
            is_default=data.is_default,
            sort_order=data.sort_order,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        )
    return modifier


@router.put("/modifiers/{modifier_id}", response_model=ModifierResponse)
async def update_modifier(
    modifier_id: UUID,
    data: ModifierUpdate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Update a modifier."""
    service = AddonService(db)
    update_data = data.model_dump(exclude_unset=True)
    modifier = service.update_modifier(str(modifier_id), **update_data)
    if not modifier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modifier not found",
        )
    return modifier


@router.delete("/modifiers/{modifier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_modifier(
    modifier_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Delete a modifier (soft-delete)."""
    service = AddonService(db)
    modifier = service.delete_modifier(str(modifier_id))
    if not modifier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modifier not found",
        )


# ── Product ↔ ModifierGroup endpoints ────────────────────────────


@router.post(
    "/products/{product_id}/modifier-groups",
    response_model=ProductModifierGroupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_group_to_product(
    product_id: UUID,
    data: AssignGroupRequest,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Assign a modifier group to a product."""
    service = AddonService(db)
    link = service.assign_group_to_product(
        product_id=str(product_id),
        modifier_group_id=str(data.modifier_group_id),
        sort_order=data.sort_order,
    )
    return link


@router.delete(
    "/products/{product_id}/modifier-groups/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_group_from_product(
    product_id: UUID,
    group_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Remove a modifier group from a product."""
    service = AddonService(db)
    removed = service.remove_group_from_product(str(product_id), str(group_id))
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product-modifier-group link not found",
        )


@router.get(
    "/products/{product_id}/modifiers",
    response_model=List[ModifierGroupResponse],
)
async def get_product_modifiers(
    product_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Get all modifier groups and their modifiers for a product."""
    service = AddonService(db)
    return service.get_product_modifiers(str(product_id))
