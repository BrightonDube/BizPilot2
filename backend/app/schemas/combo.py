"""Pydantic schemas for combo deals and combo components.

These schemas handle request validation and response serialisation for
the combo deals API (Requirement 4 of addons-modifiers spec).

A combo deal is a bundled offering — multiple products at a discounted
price.  Each component in a combo is either a fixed product or a
"choice" slot where the customer picks from a list.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Combo Component schemas
# ---------------------------------------------------------------------------


class ComboComponentCreate(BaseModel):
    """Schema for adding a component to a combo deal.

    component_type determines how the component works:
    - 'fixed': Always the same product (fixed_product_id required)
    - 'choice': Customer picks from allowed products/categories
    """

    name: str = Field(..., min_length=1, max_length=255)
    component_type: str = Field(
        ...,
        description="'fixed' or 'choice'",
    )
    fixed_product_id: Optional[UUID] = Field(
        default=None,
        description="Required when component_type='fixed'",
    )
    allowed_category_ids: Optional[List[UUID]] = Field(
        default=None,
        description="Category IDs for 'choice' components",
    )
    allowed_product_ids: Optional[List[UUID]] = Field(
        default=None,
        description="Product IDs for 'choice' components",
    )
    quantity: int = Field(default=1, ge=1)
    sort_order: int = Field(default=0, ge=0)
    allow_modifiers: bool = True

    @field_validator("component_type")
    @classmethod
    def validate_component_type(cls, v: str) -> str:
        allowed = {"fixed", "choice"}
        if v not in allowed:
            raise ValueError(f"component_type must be one of {allowed}")
        return v

    @model_validator(mode="after")
    def validate_component_fields(self) -> "ComboComponentCreate":
        """Ensure fixed components have a product and choice components have options.

        Why a model_validator instead of field_validator?
        This validation depends on the relationship between multiple fields
        (component_type vs fixed_product_id vs allowed_*_ids).
        """
        if self.component_type == "fixed" and self.fixed_product_id is None:
            raise ValueError(
                "fixed_product_id is required when component_type is 'fixed'"
            )
        if self.component_type == "choice":
            has_categories = self.allowed_category_ids and len(self.allowed_category_ids) > 0
            has_products = self.allowed_product_ids and len(self.allowed_product_ids) > 0
            if not has_categories and not has_products:
                raise ValueError(
                    "At least one of allowed_category_ids or allowed_product_ids "
                    "is required when component_type is 'choice'"
                )
        return self


class ComboComponentUpdate(BaseModel):
    """Schema for updating a combo component.  All fields optional."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    component_type: Optional[str] = None
    fixed_product_id: Optional[UUID] = None
    allowed_category_ids: Optional[List[UUID]] = None
    allowed_product_ids: Optional[List[UUID]] = None
    quantity: Optional[int] = Field(default=None, ge=1)
    sort_order: Optional[int] = Field(default=None, ge=0)
    allow_modifiers: Optional[bool] = None

    @field_validator("component_type")
    @classmethod
    def validate_component_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"fixed", "choice"}:
            raise ValueError("component_type must be 'fixed' or 'choice'")
        return v


class ComboComponentResponse(BaseModel):
    """Response schema for a combo component."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    combo_deal_id: UUID
    name: str
    component_type: str
    fixed_product_id: Optional[UUID] = None
    allowed_category_ids: Optional[List[UUID]] = None
    allowed_product_ids: Optional[List[UUID]] = None
    quantity: int
    sort_order: int
    allow_modifiers: bool


# ---------------------------------------------------------------------------
# Combo Deal schemas
# ---------------------------------------------------------------------------


class ComboDealCreate(BaseModel):
    """Schema for creating a new combo deal.

    combo_price is the bundled selling price.
    original_price is the sum of component prices at regular pricing.
    The savings displayed to the customer = original_price - combo_price.
    """

    name: str = Field(..., min_length=1, max_length=255)
    display_name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    image_url: Optional[str] = Field(default=None, max_length=500)
    combo_price: Decimal = Field(..., ge=0, decimal_places=2)
    original_price: Decimal = Field(..., ge=0, decimal_places=2)
    is_active: bool = True
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    location_ids: Optional[List[UUID]] = Field(
        default=None,
        description="Locations where this combo is available; NULL = all",
    )
    sort_order: int = Field(default=0, ge=0)
    # Optionally include components during creation for convenience
    components: Optional[List[ComboComponentCreate]] = None

    @model_validator(mode="after")
    def validate_prices(self) -> "ComboDealCreate":
        """The combo price should not exceed the original price.

        A combo that costs more than buying items individually is not a
        valid deal and is almost certainly a data entry error.
        """
        if self.combo_price > self.original_price:
            raise ValueError(
                "combo_price should not exceed original_price "
                "(the combo should save the customer money)"
            )
        return self

    @model_validator(mode="after")
    def validate_date_range(self) -> "ComboDealCreate":
        """Ensure start_date is before end_date when both are provided."""
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("start_date must be before or equal to end_date")
        return self


class ComboDealUpdate(BaseModel):
    """Schema for updating a combo deal.  All fields optional."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    image_url: Optional[str] = Field(default=None, max_length=500)
    combo_price: Optional[Decimal] = Field(default=None, ge=0)
    original_price: Optional[Decimal] = Field(default=None, ge=0)
    is_active: Optional[bool] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    location_ids: Optional[List[UUID]] = None
    sort_order: Optional[int] = Field(default=None, ge=0)


class ComboDealResponse(BaseModel):
    """Response schema for a combo deal with its components and savings."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    display_name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    combo_price: Decimal
    original_price: Decimal
    is_active: bool
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    location_ids: Optional[List[UUID]] = None
    sort_order: int
    created_at: datetime
    updated_at: datetime
    components: List[ComboComponentResponse] = []

    @property
    def savings(self) -> Decimal:
        """Calculate how much the customer saves with this combo."""
        return self.original_price - self.combo_price


class ComboDealListResponse(BaseModel):
    """Paginated list of combo deals."""

    items: List[ComboDealResponse]
    total: int
    page: int
    per_page: int
    pages: int
