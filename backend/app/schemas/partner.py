"""Pydantic schemas for partner administration.

Covers partners, configurations, white-label branding, and partner users.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Partners
# ---------------------------------------------------------------------------


class PartnerCreate(BaseModel):
    """Create a new partner."""

    partner_name: str = Field(..., min_length=1, max_length=255)
    partner_identifier: str = Field(..., min_length=3, max_length=100, pattern="^[a-z][a-z0-9-]+$")
    partner_slug: str = Field(..., min_length=3, max_length=100, pattern="^[a-z][a-z0-9-]+$")
    company_name: Optional[str] = None
    subscription_tier: Optional[str] = None
    user_limit: Optional[int] = Field(None, ge=1)
    location_limit: Optional[int] = Field(None, ge=1)
    api_rate_limit: Optional[int] = Field(None, ge=1)
    billing_cycle: str = "monthly"
    billing_currency: str = "ZAR"
    revenue_share_percentage: Optional[Decimal] = Field(None, ge=0, le=50)
    parent_partner_id: Optional[UUID] = None


class PartnerUpdate(BaseModel):
    """Update a partner."""

    partner_name: Optional[str] = Field(None, min_length=1, max_length=255)
    company_name: Optional[str] = None
    status: Optional[str] = None
    subscription_tier: Optional[str] = None
    user_limit: Optional[int] = Field(None, ge=1)
    location_limit: Optional[int] = Field(None, ge=1)
    api_rate_limit: Optional[int] = Field(None, ge=1)
    billing_cycle: Optional[str] = None
    revenue_share_percentage: Optional[Decimal] = Field(None, ge=0, le=50)


class PartnerResponse(BaseModel):
    """Partner response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    partner_name: str
    partner_identifier: str
    partner_slug: str
    company_name: Optional[str]
    status: str
    subscription_tier: Optional[str]
    user_limit: Optional[int]
    location_limit: Optional[int]
    api_rate_limit: Optional[int]
    billing_cycle: str
    billing_currency: str
    revenue_share_percentage: Optional[Decimal]
    parent_partner_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime


class PartnerListResponse(BaseModel):
    """Paginated list of partners."""

    items: List[PartnerResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Partner Configuration
# ---------------------------------------------------------------------------


class PartnerConfigurationCreate(BaseModel):
    """Create partner configuration."""

    features_enabled: Optional[dict] = None
    features_disabled: Optional[dict] = None
    business_rules: Optional[dict] = None
    workflow_config: Optional[dict] = None
    integration_config: Optional[dict] = None
    notification_settings: Optional[dict] = None


class PartnerConfigurationUpdate(BaseModel):
    """Update partner configuration."""

    features_enabled: Optional[dict] = None
    features_disabled: Optional[dict] = None
    business_rules: Optional[dict] = None
    workflow_config: Optional[dict] = None
    integration_config: Optional[dict] = None
    notification_settings: Optional[dict] = None


class PartnerConfigurationResponse(BaseModel):
    """Partner configuration response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    partner_id: UUID
    features_enabled: Optional[dict]
    features_disabled: Optional[dict]
    business_rules: Optional[dict]
    workflow_config: Optional[dict]
    integration_config: Optional[dict]
    notification_settings: Optional[dict]
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# White Label Config
# ---------------------------------------------------------------------------


class WhiteLabelConfigCreate(BaseModel):
    """Create white-label branding."""

    brand_name: str = Field(..., min_length=1, max_length=255)
    logo_url: Optional[str] = None
    primary_color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    secondary_color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    custom_domain: Optional[str] = None
    subdomain: Optional[str] = None
    app_name: Optional[str] = None
    theme_config: Optional[dict] = None
    custom_css: Optional[str] = None


class WhiteLabelConfigUpdate(BaseModel):
    """Update white-label branding."""

    brand_name: Optional[str] = Field(None, min_length=1, max_length=255)
    logo_url: Optional[str] = None
    primary_color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    secondary_color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    custom_domain: Optional[str] = None
    subdomain: Optional[str] = None
    app_name: Optional[str] = None
    theme_config: Optional[dict] = None
    custom_css: Optional[str] = None


class WhiteLabelConfigResponse(BaseModel):
    """White-label config response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    partner_id: UUID
    brand_name: str
    logo_url: Optional[str]
    primary_color: Optional[str]
    secondary_color: Optional[str]
    custom_domain: Optional[str]
    subdomain: Optional[str]
    app_name: Optional[str]
    theme_config: Optional[dict]
    custom_css: Optional[str]
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Partner Users
# ---------------------------------------------------------------------------


class PartnerUserCreate(BaseModel):
    """Add a user to a partner."""

    user_id: UUID
    partner_role: str = "viewer"
    permissions: Optional[dict] = None
    is_primary_contact: bool = False


class PartnerUserUpdate(BaseModel):
    """Update a partner user."""

    partner_role: Optional[str] = None
    permissions: Optional[dict] = None
    is_active: Optional[bool] = None
    is_primary_contact: Optional[bool] = None


class PartnerUserResponse(BaseModel):
    """Partner user response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    partner_id: UUID
    user_id: UUID
    partner_role: str
    permissions: Optional[dict]
    is_active: bool
    is_primary_contact: bool
    last_login_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class PartnerUserListResponse(BaseModel):
    """Paginated list of partner users."""

    items: List[PartnerUserResponse]
    total: int
    page: int
    per_page: int
    pages: int
