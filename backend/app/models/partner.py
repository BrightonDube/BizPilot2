"""Models for partner (reseller) administration.

Manages partner organisations, their configurations, white-label
branding, and user access.

Why a partner layer?
BizPilot supports white-label resellers who onboard businesses under
their own brand.  Partners need isolated configuration, branding,
billing, and user management separate from the direct B2B model.
"""

import uuid

from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Boolean,
    Numeric,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import BaseModel


class Partner(BaseModel):
    """Reseller/partner organisation.

    parent_partner_id enables sub-partner hierarchies where a
    regional partner may have local partners beneath them.
    """

    __tablename__ = "partners"

    partner_name = Column(String(255), nullable=False)
    partner_identifier = Column(String(100), nullable=False, unique=True)
    partner_slug = Column(String(100), nullable=False, unique=True)
    company_name = Column(String(255), nullable=True)
    status = Column(
        String(20),
        default="pending",
        nullable=False,
        comment="pending | active | suspended | terminated",
    )
    subscription_tier = Column(String(50), nullable=True)
    user_limit = Column(Integer, nullable=True)
    location_limit = Column(Integer, nullable=True)
    api_rate_limit = Column(Integer, nullable=True)
    billing_cycle = Column(String(20), default="monthly", nullable=False)
    billing_currency = Column(String(3), default="ZAR", nullable=False)
    revenue_share_percentage = Column(Numeric(5, 2), nullable=True)
    parent_partner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("partners.id"),
        nullable=True,
    )


class PartnerConfiguration(BaseModel):
    """Feature flags and business rules for a partner.

    Why JSONB for features?
    The feature set evolves rapidly.  JSONB avoids a migration for
    every new toggle, while still being queryable with PostgreSQL
    JSON operators.
    """

    __tablename__ = "partner_configurations"

    partner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    features_enabled = Column(JSONB, nullable=True)
    features_disabled = Column(JSONB, nullable=True)
    business_rules = Column(JSONB, nullable=True)
    workflow_config = Column(JSONB, nullable=True)
    integration_config = Column(JSONB, nullable=True)
    notification_settings = Column(JSONB, nullable=True)


class WhiteLabelConfig(BaseModel):
    """Branding configuration for a partner's white-label deployment.

    Covers visual identity (logo, colours, CSS) and domain mapping.
    """

    __tablename__ = "white_label_configs"

    partner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    brand_name = Column(String(255), nullable=False)
    logo_url = Column(String(500), nullable=True)
    primary_color = Column(String(7), nullable=True)
    secondary_color = Column(String(7), nullable=True)
    custom_domain = Column(String(255), nullable=True)
    subdomain = Column(String(100), nullable=True)
    app_name = Column(String(255), nullable=True)
    theme_config = Column(JSONB, nullable=True)
    custom_css = Column(Text, nullable=True)


class PartnerUser(BaseModel):
    """User access record within a partner organisation."""

    __tablename__ = "partner_users"

    partner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    partner_role = Column(String(100), default="viewer", nullable=False)
    permissions = Column(JSONB, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_primary_contact = Column(Boolean, default=False, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("partner_id", "user_id", name="uq_partner_users_partner_user"),
    )
