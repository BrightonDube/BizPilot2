"""Reward catalog service for loyalty program reward management.

Handles CRUD for redeemable rewards and tier benefits.

Why a separate service from loyalty_service?
loyalty_service handles points accrual and balance tracking (transactional).
This service handles the reward catalog (configuration).  Separating them
avoids a God-service and allows independent testing.
"""

from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.loyalty import RewardCatalogItem, TierBenefit


class RewardCatalogService:
    """Service for managing loyalty reward catalog and tier benefits."""

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Reward Catalog
    # ------------------------------------------------------------------

    def list_rewards(
        self,
        business_id: str,
        active_only: bool = True,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[RewardCatalogItem], int]:
        """List rewards in the catalog, optionally filtered to active only."""
        query = self.db.query(RewardCatalogItem).filter(
            RewardCatalogItem.business_id == business_id,
            RewardCatalogItem.deleted_at.is_(None),
        )
        if active_only:
            query = query.filter(RewardCatalogItem.is_active.is_(True))

        total = query.count()
        items = (
            query.order_by(RewardCatalogItem.points_cost.asc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def create_reward(self, business_id: str, data: dict) -> RewardCatalogItem:
        """Create a new reward in the catalog."""
        reward = RewardCatalogItem(business_id=business_id, **data)
        self.db.add(reward)
        self.db.commit()
        self.db.refresh(reward)
        return reward

    def update_reward(
        self,
        reward_id: str,
        business_id: str,
        data: dict,
    ) -> Optional[RewardCatalogItem]:
        """Update an existing reward."""
        reward = (
            self.db.query(RewardCatalogItem)
            .filter(
                RewardCatalogItem.id == reward_id,
                RewardCatalogItem.business_id == business_id,
                RewardCatalogItem.deleted_at.is_(None),
            )
            .first()
        )
        if not reward:
            return None
        for key, value in data.items():
            if hasattr(reward, key):
                setattr(reward, key, value)
        self.db.commit()
        self.db.refresh(reward)
        return reward

    def delete_reward(self, reward_id: str, business_id: str) -> bool:
        """Soft-delete a reward from the catalog."""
        reward = (
            self.db.query(RewardCatalogItem)
            .filter(
                RewardCatalogItem.id == reward_id,
                RewardCatalogItem.business_id == business_id,
                RewardCatalogItem.deleted_at.is_(None),
            )
            .first()
        )
        if not reward:
            return False
        reward.soft_delete()
        self.db.commit()
        return True

    # ------------------------------------------------------------------
    # Tier Benefits
    # ------------------------------------------------------------------

    def list_tier_benefits(
        self,
        business_id: str,
        tier_name: Optional[str] = None,
    ) -> List[TierBenefit]:
        """List tier benefits, optionally filtered by tier."""
        query = self.db.query(TierBenefit).filter(
            TierBenefit.business_id == business_id,
            TierBenefit.is_active.is_(True),
        )
        if tier_name:
            query = query.filter(TierBenefit.tier_name == tier_name)
        return query.order_by(TierBenefit.tier_name).all()

    def create_tier_benefit(self, business_id: str, data: dict) -> TierBenefit:
        """Create a new tier benefit."""
        benefit = TierBenefit(business_id=business_id, **data)
        self.db.add(benefit)
        self.db.commit()
        self.db.refresh(benefit)
        return benefit

    def delete_tier_benefit(self, benefit_id: str, business_id: str) -> bool:
        """Deactivate a tier benefit."""
        benefit = (
            self.db.query(TierBenefit)
            .filter(
                TierBenefit.id == benefit_id,
                TierBenefit.business_id == business_id,
            )
            .first()
        )
        if not benefit:
            return False
        benefit.is_active = False
        self.db.commit()
        return True
