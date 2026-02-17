"""Menu engineering API endpoints."""

import math
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase, ConfigDict

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.models.user import User
from app.services.menu_service import MenuService

router = APIRouter(prefix="/menu-engineering", tags=["Menu Engineering"])


# ── Request / Response schemas ───────────────────────────────────


class MenuItemCreate(PydanticBase):
    product_id: UUID
    display_name: str
    price: Decimal
    category_id: Optional[UUID] = None
    description: Optional[str] = None
    cost: Decimal = Decimal("0")
    image_url: Optional[str] = None
    display_order: int = 0
    is_available: bool = True
    is_featured: bool = False
    prep_time_minutes: Optional[int] = None
    course: Optional[str] = None


class MenuItemUpdate(PydanticBase):
    display_name: Optional[str] = None
    price: Optional[Decimal] = None
    category_id: Optional[UUID] = None
    description: Optional[str] = None
    cost: Optional[Decimal] = None
    image_url: Optional[str] = None
    display_order: Optional[int] = None
    is_available: Optional[bool] = None
    is_featured: Optional[bool] = None
    prep_time_minutes: Optional[int] = None
    course: Optional[str] = None


class MenuItemResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    product_id: UUID
    category_id: Optional[UUID] = None
    display_name: str
    description: Optional[str] = None
    price: Decimal
    cost: Decimal
    image_url: Optional[str] = None
    display_order: int
    is_available: bool
    is_featured: bool
    prep_time_minutes: Optional[int] = None
    course: Optional[str] = None


class MenuItemListResponse(PydanticBase):
    items: List[MenuItemResponse]
    total: int
    page: int
    per_page: int
    pages: int


class ModifierGroupCreate(PydanticBase):
    name: str
    min_selections: int = 0
    max_selections: int = 1
    is_required: bool = False


class ModifierGroupResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    min_selections: int
    max_selections: int
    is_required: bool


class ModifierCreate(PydanticBase):
    name: str
    price_adjustment: Decimal = Decimal("0")


class ModifierResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    group_id: UUID
    business_id: UUID
    name: str
    price_adjustment: Decimal
    is_available: bool


class AttachModifierGroupRequest(PydanticBase):
    modifier_group_id: UUID


class AttachModifierGroupResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    menu_item_id: UUID
    modifier_group_id: UUID


class RecipeCreate(PydanticBase):
    name: str
    menu_item_id: Optional[UUID] = None
    yield_quantity: Decimal = Decimal("1")
    instructions: Optional[str] = None


class RecipeResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    menu_item_id: Optional[UUID] = None
    name: str
    yield_quantity: Decimal
    instructions: Optional[str] = None


class IngredientCreate(PydanticBase):
    product_id: UUID
    quantity: Decimal
    unit: str


class IngredientResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    recipe_id: UUID
    product_id: UUID
    quantity: Decimal
    unit: str


class RecipeCostResponse(PydanticBase):
    recipe_id: UUID
    total_cost: Decimal


class MatrixItemResponse(PydanticBase):
    id: str
    display_name: str
    price: float
    cost: float
    profit_margin: float
    is_available: bool
    is_featured: bool
    course: Optional[str] = None
    category_id: Optional[str] = None
    classification: str


# ── Endpoints ────────────────────────────────────────────────────


@router.post("/items", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    data: MenuItemCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create a new menu item."""
    service = MenuService(db)
    extras: Dict[str, Any] = {}
    if data.category_id is not None:
        extras["category_id"] = str(data.category_id)
    if data.description is not None:
        extras["description"] = data.description
    if data.image_url is not None:
        extras["image_url"] = data.image_url
    if data.prep_time_minutes is not None:
        extras["prep_time_minutes"] = data.prep_time_minutes
    if data.course is not None:
        extras["course"] = data.course
    extras["cost"] = data.cost
    extras["display_order"] = data.display_order
    extras["is_available"] = data.is_available
    extras["is_featured"] = data.is_featured

    item = service.create_item(
        business_id=business_id,
        product_id=str(data.product_id),
        display_name=data.display_name,
        price=data.price,
        **extras,
    )
    return item


@router.get("/items", response_model=MenuItemListResponse)
async def list_items(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    category_id: Optional[str] = None,
    available_only: bool = True,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List menu items with pagination."""
    service = MenuService(db)
    items, total = service.list_items(
        business_id=business_id,
        category_id=category_id,
        available_only=available_only,
        page=page,
        per_page=per_page,
    )
    return MenuItemListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if per_page else 0,
    )


@router.get("/items/{item_id}", response_model=MenuItemResponse)
async def get_item(
    item_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get a single menu item."""
    service = MenuService(db)
    item = service.get_item(str(item_id), business_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found")
    return item


@router.put("/items/{item_id}", response_model=MenuItemResponse)
async def update_item(
    item_id: UUID,
    data: MenuItemUpdate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Update a menu item."""
    service = MenuService(db)
    update_data = data.model_dump(exclude_unset=True)
    # Convert UUID fields to strings for the ORM
    if "category_id" in update_data and update_data["category_id"] is not None:
        update_data["category_id"] = str(update_data["category_id"])
    item = service.update_item(str(item_id), business_id, **update_data)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found")
    return item


@router.patch("/items/{item_id}/availability", response_model=MenuItemResponse)
async def toggle_availability(
    item_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Toggle menu item availability."""
    service = MenuService(db)
    item = service.toggle_availability(str(item_id), business_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found")
    return item


# ── Modifier Groups ─────────────────────────────────────────────


@router.post(
    "/modifier-groups",
    response_model=ModifierGroupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_modifier_group(
    data: ModifierGroupCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create a modifier group."""
    service = MenuService(db)
    group = service.create_modifier_group(
        business_id=business_id,
        name=data.name,
        min_selections=data.min_selections,
        max_selections=data.max_selections,
        is_required=data.is_required,
    )
    return group


@router.get("/modifier-groups", response_model=List[ModifierGroupResponse])
async def list_modifier_groups(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List modifier groups."""
    service = MenuService(db)
    return service.list_modifier_groups(business_id)


@router.post(
    "/modifier-groups/{group_id}/modifiers",
    response_model=ModifierResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_modifier(
    group_id: UUID,
    data: ModifierCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Add a modifier to a group."""
    service = MenuService(db)
    modifier = service.add_modifier(
        group_id=str(group_id),
        business_id=business_id,
        name=data.name,
        price_adjustment=data.price_adjustment,
    )
    return modifier


@router.post(
    "/items/{item_id}/modifier-groups",
    response_model=AttachModifierGroupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def attach_modifier_group(
    item_id: UUID,
    data: AttachModifierGroupRequest,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Attach a modifier group to a menu item."""
    service = MenuService(db)
    try:
        link = service.attach_modifier_group(
            item_id=str(item_id),
            group_id=str(data.modifier_group_id),
            business_id=business_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return link


# ── Recipes ──────────────────────────────────────────────────────


@router.post("/recipes", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    data: RecipeCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create a recipe."""
    service = MenuService(db)
    recipe = service.create_recipe(
        business_id=business_id,
        name=data.name,
        menu_item_id=str(data.menu_item_id) if data.menu_item_id else None,
        yield_quantity=data.yield_quantity,
        instructions=data.instructions,
    )
    return recipe


@router.post(
    "/recipes/{recipe_id}/ingredients",
    response_model=IngredientResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_ingredient(
    recipe_id: UUID,
    data: IngredientCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Add an ingredient to a recipe."""
    service = MenuService(db)
    try:
        ingredient = service.add_ingredient(
            recipe_id=str(recipe_id),
            product_id=str(data.product_id),
            quantity=data.quantity,
            unit=data.unit,
            business_id=business_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return ingredient


@router.get("/recipes/{recipe_id}/cost", response_model=RecipeCostResponse)
async def get_recipe_cost(
    recipe_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Calculate total cost of a recipe."""
    service = MenuService(db)
    try:
        total = service.calculate_recipe_cost(str(recipe_id), business_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return RecipeCostResponse(recipe_id=recipe_id, total_cost=total)


# ── Engineering Matrix ───────────────────────────────────────────


@router.get("/matrix", response_model=List[MatrixItemResponse])
async def get_matrix(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get menu engineering matrix (Stars / Puzzles / Plowhorses / Dogs)."""
    service = MenuService(db)
    return service.get_menu_engineering_matrix(business_id)
