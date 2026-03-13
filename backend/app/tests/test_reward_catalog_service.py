"""Tests for RewardCatalogService – reward catalog CRUD & tier benefits."""

import uuid
from decimal import Decimal
from unittest.mock import MagicMock


from app.models.loyalty import RewardCatalogItem, TierBenefit
from app.services.reward_catalog_service import RewardCatalogService

BIZ = str(uuid.uuid4())


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _svc():
    db = MagicMock()
    return RewardCatalogService(db), db


def _chain(first=None, rows=None, count=0):
    """Return a chainable mock that mimics a SQLAlchemy query."""
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.order_by = MagicMock(return_value=q)
    q.offset = MagicMock(return_value=q)
    q.limit = MagicMock(return_value=q)
    q.all = MagicMock(return_value=rows if rows is not None else [])
    q.first = MagicMock(return_value=first)
    q.count = MagicMock(return_value=count)
    return q


def _mock_reward(**overrides):
    r = MagicMock(spec=RewardCatalogItem)
    r.id = overrides.get("id", uuid.uuid4())
    r.business_id = overrides.get("business_id", uuid.UUID(BIZ))
    r.name = overrides.get("name", "Free Coffee")
    r.description = overrides.get("description", "A free coffee on us")
    r.points_cost = overrides.get("points_cost", 100)
    r.reward_type = overrides.get("reward_type", "free_item")
    r.reward_value = overrides.get("reward_value", Decimal("0.00"))
    r.product_id = overrides.get("product_id", None)
    r.min_tier = overrides.get("min_tier", None)
    r.stock_quantity = overrides.get("stock_quantity", None)
    r.is_active = overrides.get("is_active", True)
    r.deleted_at = overrides.get("deleted_at", None)
    return r


def _mock_benefit(**overrides):
    b = MagicMock(spec=TierBenefit)
    b.id = overrides.get("id", uuid.uuid4())
    b.business_id = overrides.get("business_id", uuid.UUID(BIZ))
    b.tier_name = overrides.get("tier_name", "gold")
    b.benefit_type = overrides.get("benefit_type", "free_delivery")
    b.benefit_value = overrides.get("benefit_value", Decimal("0.00"))
    b.description = overrides.get("description", "Free delivery for gold members")
    b.is_active = overrides.get("is_active", True)
    return b


# ==================================================================
# Reward Catalog
# ==================================================================


class TestListRewards:
    """Tests for list_rewards."""

    def test_returns_items_and_total(self):
        svc, db = _svc()
        rewards = [_mock_reward(points_cost=50), _mock_reward(points_cost=200)]
        chain = _chain(rows=rewards, count=2)
        db.query.return_value = chain

        items, total = svc.list_rewards(BIZ)

        assert items == rewards
        assert total == 2
        db.query.assert_called_once_with(RewardCatalogItem)
        chain.filter.assert_called()
        chain.order_by.assert_called_once()
        chain.offset.assert_called_once()
        chain.limit.assert_called_once()

    def test_active_only_true_applies_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_rewards(BIZ, active_only=True)

        # Two filter calls: base filters then is_active
        assert chain.filter.call_count == 2

    def test_active_only_false_skips_active_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_rewards(BIZ, active_only=False)

        # Only one filter call: base filters (business_id + deleted_at)
        assert chain.filter.call_count == 1

    def test_pagination_defaults(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_rewards(BIZ)

        chain.offset.assert_called_once_with(0)   # (1-1)*20
        chain.limit.assert_called_once_with(20)

    def test_pagination_custom(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=50)
        db.query.return_value = chain

        svc.list_rewards(BIZ, page=3, per_page=10)

        chain.offset.assert_called_once_with(20)   # (3-1)*10
        chain.limit.assert_called_once_with(10)

    def test_empty_catalog(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        items, total = svc.list_rewards(BIZ)

        assert items == []
        assert total == 0


class TestCreateReward:
    """Tests for create_reward."""

    def test_creates_and_returns_reward(self):
        svc, db = _svc()
        data = {"name": "10% Discount", "points_cost": 200, "reward_type": "discount"}

        result = svc.create_reward(BIZ, data)

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, RewardCatalogItem)
        assert added.business_id == BIZ
        assert added.name == "10% Discount"
        assert result is added

    def test_business_id_set_from_argument(self):
        svc, db = _svc()
        data = {"name": "Voucher", "points_cost": 500, "reward_type": "voucher"}

        svc.create_reward(BIZ, data)

        assert db.add.call_args[0][0].business_id == BIZ


class TestUpdateReward:
    """Tests for update_reward."""

    def test_updates_existing_reward(self):
        svc, db = _svc()
        reward = _mock_reward()
        chain = _chain(first=reward)
        db.query.return_value = chain

        result = svc.update_reward(str(reward.id), BIZ, {"name": "Updated Coffee"})

        assert result is reward
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(reward)

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.update_reward(str(uuid.uuid4()), BIZ, {"name": "X"})

        assert result is None
        db.commit.assert_not_called()

    def test_only_sets_existing_attributes(self):
        svc, db = _svc()
        reward = _mock_reward()
        chain = _chain(first=reward)
        db.query.return_value = chain

        svc.update_reward(str(reward.id), BIZ, {"name": "New", "nonexistent_field": 99})

        # "name" exists on spec → setattr called; "nonexistent_field" does not
        # hasattr(mock_with_spec, "nonexistent_field") is False, so it's skipped
        assert not hasattr(reward, "nonexistent_field")
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(reward)

    def test_update_multiple_fields(self):
        svc, db = _svc()
        reward = _mock_reward()
        chain = _chain(first=reward)
        db.query.return_value = chain

        svc.update_reward(str(reward.id), BIZ, {
            "name": "Premium Coffee",
            "points_cost": 300,
            "is_active": False,
        })

        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(reward)


class TestDeleteReward:
    """Tests for delete_reward (soft delete)."""

    def test_soft_deletes_existing_reward(self):
        svc, db = _svc()
        reward = _mock_reward()
        chain = _chain(first=reward)
        db.query.return_value = chain

        result = svc.delete_reward(str(reward.id), BIZ)

        assert result is True
        reward.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_returns_false_when_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.delete_reward(str(uuid.uuid4()), BIZ)

        assert result is False
        db.commit.assert_not_called()

    def test_already_deleted_not_found(self):
        """A reward that's already soft-deleted should not be found."""
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.delete_reward(str(uuid.uuid4()), BIZ)

        assert result is False

    def test_wrong_business_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.delete_reward(str(uuid.uuid4()), str(uuid.uuid4()))

        assert result is False
        db.commit.assert_not_called()


# ==================================================================
# Tier Benefits
# ==================================================================


class TestListTierBenefits:
    """Tests for list_tier_benefits."""

    def test_returns_all_active_benefits(self):
        svc, db = _svc()
        benefits = [_mock_benefit(tier_name="bronze"), _mock_benefit(tier_name="gold")]
        chain = _chain(rows=benefits)
        db.query.return_value = chain

        result = svc.list_tier_benefits(BIZ)

        assert result == benefits
        db.query.assert_called_once_with(TierBenefit)
        chain.order_by.assert_called_once()

    def test_filters_by_tier_name(self):
        svc, db = _svc()
        gold = _mock_benefit(tier_name="gold")
        chain = _chain(rows=[gold])
        db.query.return_value = chain

        result = svc.list_tier_benefits(BIZ, tier_name="gold")

        # Two filter calls: base (business_id + is_active) then tier_name
        assert chain.filter.call_count == 2
        assert result == [gold]

    def test_no_tier_name_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.list_tier_benefits(BIZ, tier_name=None)

        # Only one filter call: base filters
        assert chain.filter.call_count == 1

    def test_empty_benefits(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        result = svc.list_tier_benefits(BIZ)

        assert result == []


class TestCreateTierBenefit:
    """Tests for create_tier_benefit."""

    def test_creates_and_returns_benefit(self):
        svc, db = _svc()
        data = {
            "tier_name": "platinum",
            "benefit_type": "exclusive_access",
            "description": "VIP lounge access",
        }

        result = svc.create_tier_benefit(BIZ, data)

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, TierBenefit)
        assert added.business_id == BIZ
        assert added.tier_name == "platinum"
        assert result is added

    def test_business_id_set_from_argument(self):
        svc, db = _svc()
        data = {"tier_name": "silver", "benefit_type": "bonus_points"}

        svc.create_tier_benefit(BIZ, data)

        assert db.add.call_args[0][0].business_id == BIZ


class TestDeleteTierBenefit:
    """Tests for delete_tier_benefit (deactivate)."""

    def test_deactivates_existing_benefit(self):
        svc, db = _svc()
        benefit = _mock_benefit()
        chain = _chain(first=benefit)
        db.query.return_value = chain

        result = svc.delete_tier_benefit(str(benefit.id), BIZ)

        assert result is True
        assert benefit.is_active is False
        db.commit.assert_called_once()

    def test_returns_false_when_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.delete_tier_benefit(str(uuid.uuid4()), BIZ)

        assert result is False
        db.commit.assert_not_called()

    def test_wrong_business_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.delete_tier_benefit(str(uuid.uuid4()), str(uuid.uuid4()))

        assert result is False
        db.commit.assert_not_called()
