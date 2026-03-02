"""Pydantic schemas for modifier groups, modifiers, and availability.

These schemas handle request validation and response serialisation for
the addons/modifiers API (Requirements 1, 2, 6 of addons-modifiers spec).

Existing inline schemas from api/addons.py are consolidated here so they
can be reused across API endpoints, services, and tests.
"""

from datetime import date, time
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# Modifier Group schemas
# ---------------------------------------------------------------------------


class ModifierGroupCreate(BaseModel):
    """Schema for creating a new modifier group.

    selection_type must be 'single' or 'multiple'.  min_selections and
    max_selections define how many modifiers the customer must/can pick.
    """

    name: str = Field(..., min_length=1, max_length=255)
    selection_type: str = Field(
        default="single",
        description="'single' (pick one) or 'multiple' (pick many)",
    )
    is_required: bool = False
    min_selections: int = Field(default=0, ge=0)
    max_selections: Optional[int] = Field(
        default=None,
        ge=1,
        description="NULL means unlimited selections",
    )
    description: Optional[str] = None

    @field_validator("selection_type")
    @classmethod
    def validate_selection_type(cls, v: str) -> str:
        allowed = {"single", "multiple"}
        if v not in allowed:
            raise ValueError(f"selection_type must be one of {allowed}")
        return v


class ModifierGroupUpdate(BaseModel):
    """Schema for updating an existing modifier group.

    All fields are optional – only provided fields are updated.
    """

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    selection_type: Optional[str] = None
    is_required: Optional[bool] = None
    min_selections: Optional[int] = Field(default=None, ge=0)
    max_selections: Optional[int] = Field(default=None, ge=1)
    description: Optional[str] = None
    sort_order: Optional[int] = Field(default=None, ge=0)

    @field_validator("selection_type")
    @classmethod
    def validate_selection_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"single", "multiple"}:
            raise ValueError("selection_type must be 'single' or 'multiple'")
        return v


class ModifierResponse(BaseModel):
    """Response schema for a single modifier item."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    group_id: UUID
    business_id: UUID
    name: str
    price_adjustment: Decimal
    is_default: bool
    is_available: bool
    sort_order: int


class ModifierGroupResponse(BaseModel):
    """Response schema for a modifier group with its nested modifiers."""

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


class ModifierGroupListResponse(BaseModel):
    """Paginated list of modifier groups."""

    items: List[ModifierGroupResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Modifier item schemas
# ---------------------------------------------------------------------------


class ModifierCreate(BaseModel):
    """Schema for creating a modifier within a group.

    pricing_type determines how the price field is interpreted:
    - 'free': price is ignored (no additional cost)
    - 'fixed': price is a flat additional amount
    - 'percentage': price is a % of the base item price

    For backward compatibility, price_adjustment is also accepted.
    """

    name: str = Field(..., min_length=1, max_length=255)
    pricing_type: str = Field(
        default="fixed",
        description="'free', 'fixed', or 'percentage'",
    )
    price_adjustment: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        description="Price amount or percentage value",
    )
    is_default: bool = False
    sort_order: int = Field(default=0, ge=0)

    @field_validator("pricing_type")
    @classmethod
    def validate_pricing_type(cls, v: str) -> str:
        allowed = {"free", "fixed", "percentage"}
        if v not in allowed:
            raise ValueError(f"pricing_type must be one of {allowed}")
        return v


class ModifierUpdate(BaseModel):
    """Schema for updating a modifier.  All fields optional."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    pricing_type: Optional[str] = None
    price_adjustment: Optional[Decimal] = Field(default=None, ge=0)
    is_default: Optional[bool] = None
    is_available: Optional[bool] = None
    sort_order: Optional[int] = Field(default=None, ge=0)

    @field_validator("pricing_type")
    @classmethod
    def validate_pricing_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"free", "fixed", "percentage"}:
            raise ValueError("pricing_type must be 'free', 'fixed', or 'percentage'")
        return v


# ---------------------------------------------------------------------------
# Product ↔ Modifier Group assignment schemas
# ---------------------------------------------------------------------------


class AssignGroupRequest(BaseModel):
    """Request to assign a modifier group to a product."""

    modifier_group_id: UUID
    sort_order: int = Field(default=0, ge=0)


class ProductModifierGroupResponse(BaseModel):
    """Response for a product-modifier-group link."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    modifier_group_id: UUID
    sort_order: int


# ---------------------------------------------------------------------------
# Modifier Availability schemas  (Requirement 6)
# ---------------------------------------------------------------------------


class ModifierAvailabilityCreate(BaseModel):
    """Schema for creating a modifier availability rule.

    All filter fields are optional — a rule with all filters as NULL
    means "always available" (or "never available" if is_available=False,
    effectively an 86'd/out-of-stock marker).
    """

    modifier_id: UUID
    day_of_week: Optional[int] = Field(
        default=None,
        ge=0,
        le=6,
        description="0=Monday … 6=Sunday (ISO 8601)",
    )
    start_time: Optional[time] = Field(
        default=None,
        description="HH:MM start of availability window",
    )
    end_time: Optional[time] = Field(
        default=None,
        description="HH:MM end of availability window",
    )
    start_date: Optional[date] = Field(
        default=None,
        description="Start of seasonal availability",
    )
    end_date: Optional[date] = Field(
        default=None,
        description="End of seasonal availability",
    )
    location_id: Optional[UUID] = Field(
        default=None,
        description="Specific location; NULL = all locations",
    )
    is_available: bool = True


class ModifierAvailabilityUpdate(BaseModel):
    """Schema for updating a modifier availability rule.  All optional."""

    day_of_week: Optional[int] = Field(default=None, ge=0, le=6)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    location_id: Optional[UUID] = None
    is_available: Optional[bool] = None


class ModifierAvailabilityResponse(BaseModel):
    """Response for a modifier availability rule."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    modifier_id: UUID
    day_of_week: Optional[int] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    location_id: Optional[UUID] = None
    is_available: bool
