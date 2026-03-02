"""Service layer for partner (reseller) administration.

Handles partner lifecycle, configuration, white-label branding,
and partner user management.

Why a service layer?
Partner onboarding involves slug/identifier uniqueness checks,
configuration initialisation, and default branding setup — logic
that shouldn't live in thin API handlers.
"""

import math
from datetime import datetime, timezone
from typing import Optional, Tuple, List
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.partner import (
    Partner,
    PartnerConfiguration,
    WhiteLabelConfig,
    PartnerUser,
)


def _utc_now() -> datetime:
    """Return timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


class PartnerService:
    """Business logic for partner administration."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # -------------------------------------------------------------------
    # Partner CRUD
    # -------------------------------------------------------------------

    def create_partner(self, **kwargs) -> Partner:
        """Create a new partner with default configuration.

        Why create config eagerly?
        Every partner needs a configuration record. Creating it
        inline avoids orphan partners with no config row.
        """
        partner = Partner(**kwargs)
        self.db.add(partner)
        self.db.flush()

        # Auto-create empty configuration
        config = PartnerConfiguration(
            partner_id=partner.id,
            features_enabled={},
            features_disabled={},
        )
        self.db.add(config)
        self.db.commit()
        self.db.refresh(partner)
        return partner

    def get_partner(self, partner_id: UUID) -> Optional[Partner]:
        """Get a partner by ID."""
        return (
            self.db.query(Partner)
            .filter(
                Partner.id == partner_id,
                Partner.deleted_at.is_(None),
            )
            .first()
        )

    def get_partner_by_slug(self, slug: str) -> Optional[Partner]:
        """Get a partner by their unique slug.

        Why slug lookup?
        White-label domains resolve to partners via slug, making
        this the primary lookup path for the public-facing app.
        """
        return (
            self.db.query(Partner)
            .filter(
                Partner.partner_slug == slug,
                Partner.deleted_at.is_(None),
            )
            .first()
        )

    def list_partners(
        self,
        status: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[Partner], int]:
        """List partners with optional status filter."""
        query = self.db.query(Partner).filter(
            Partner.deleted_at.is_(None),
        )
        if status:
            query = query.filter(Partner.status == status)
        total = query.count()
        items = (
            query.order_by(Partner.partner_name)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def update_partner(
        self, partner_id: UUID, **kwargs
    ) -> Optional[Partner]:
        """Update a partner."""
        partner = self.get_partner(partner_id)
        if not partner:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(partner, key, value)
        partner.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(partner)
        return partner

    def delete_partner(self, partner_id: UUID) -> bool:
        """Soft-delete a partner."""
        partner = self.get_partner(partner_id)
        if not partner:
            return False
        partner.soft_delete()
        self.db.commit()
        return True

    # -------------------------------------------------------------------
    # Partner Configuration
    # -------------------------------------------------------------------

    def get_configuration(
        self, partner_id: UUID
    ) -> Optional[PartnerConfiguration]:
        """Get the configuration for a partner."""
        return (
            self.db.query(PartnerConfiguration)
            .filter(PartnerConfiguration.partner_id == partner_id)
            .first()
        )

    def update_configuration(
        self, partner_id: UUID, **kwargs
    ) -> Optional[PartnerConfiguration]:
        """Update partner configuration."""
        config = self.get_configuration(partner_id)
        if not config:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(config, key, value)
        config.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(config)
        return config

    # -------------------------------------------------------------------
    # White Label Config
    # -------------------------------------------------------------------

    def create_white_label(
        self, partner_id: UUID, **kwargs
    ) -> WhiteLabelConfig:
        """Create white-label branding for a partner."""
        wl = WhiteLabelConfig(partner_id=partner_id, **kwargs)
        self.db.add(wl)
        self.db.commit()
        self.db.refresh(wl)
        return wl

    def get_white_label(
        self, partner_id: UUID
    ) -> Optional[WhiteLabelConfig]:
        """Get white-label config for a partner."""
        return (
            self.db.query(WhiteLabelConfig)
            .filter(WhiteLabelConfig.partner_id == partner_id)
            .first()
        )

    def update_white_label(
        self, partner_id: UUID, **kwargs
    ) -> Optional[WhiteLabelConfig]:
        """Update white-label branding."""
        wl = self.get_white_label(partner_id)
        if not wl:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(wl, key, value)
        wl.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(wl)
        return wl

    # -------------------------------------------------------------------
    # Partner Users
    # -------------------------------------------------------------------

    def add_partner_user(
        self,
        partner_id: UUID,
        user_id: UUID,
        partner_role: str = "viewer",
        permissions: Optional[dict] = None,
        is_primary_contact: bool = False,
    ) -> PartnerUser:
        """Add a user to a partner organisation."""
        pu = PartnerUser(
            partner_id=partner_id,
            user_id=user_id,
            partner_role=partner_role,
            permissions=permissions,
            is_primary_contact=is_primary_contact,
        )
        self.db.add(pu)
        self.db.commit()
        self.db.refresh(pu)
        return pu

    def list_partner_users(
        self,
        partner_id: UUID,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[PartnerUser], int]:
        """List users belonging to a partner."""
        query = self.db.query(PartnerUser).filter(
            PartnerUser.partner_id == partner_id,
            PartnerUser.deleted_at.is_(None),
        )
        total = query.count()
        items = (
            query.order_by(PartnerUser.created_at)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def update_partner_user(
        self, partner_user_id: UUID, **kwargs
    ) -> Optional[PartnerUser]:
        """Update a partner user record."""
        pu = (
            self.db.query(PartnerUser)
            .filter(
                PartnerUser.id == partner_user_id,
                PartnerUser.deleted_at.is_(None),
            )
            .first()
        )
        if not pu:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(pu, key, value)
        pu.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(pu)
        return pu

    def remove_partner_user(self, partner_user_id: UUID) -> bool:
        """Soft-delete a partner user."""
        pu = (
            self.db.query(PartnerUser)
            .filter(
                PartnerUser.id == partner_user_id,
                PartnerUser.deleted_at.is_(None),
            )
            .first()
        )
        if not pu:
            return False
        pu.soft_delete()
        self.db.commit()
        return True
