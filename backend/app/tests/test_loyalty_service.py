"""Unit tests for LoyaltyService.

Covers program CRUD, points earning/redemption, tier upgrades,
expiry, history, stats, and edge cases.
"""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.models.loyalty import (
    LoyaltyProgram,
    CustomerLoyalty,
    PointsTransaction,
    LoyaltyTier,
)
from app.services.loyalty_service import LoyaltyService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BIZ_ID = str(uuid.uuid4())
CUST_ID = str(uuid.uuid4())


def _mock_program(**overrides):
    """Create a mock LoyaltyProgram with sensible defaults."""
    p = MagicMock(spec=LoyaltyProgram)
    p.id = str(uuid.uuid4())
    p.business_id = BIZ_ID
    p.is_active = True
    p.points_per_rand = Decimal("10")       # 10 points per R1
    p.redemption_rate = Decimal("100")       # 100 points = R1
    p.min_redemption_points = 100
    p.points_expiry_days = 365
    p.silver_threshold = 1000
    p.gold_threshold = 5000
    p.platinum_threshold = 10000
    p.silver_multiplier = Decimal("1.5")
    p.gold_multiplier = Decimal("2.0")
    p.platinum_multiplier = Decimal("3.0")
    p.deleted_at = None
    for k, v in overrides.items():
        setattr(p, k, v)
    return p


def _mock_loyalty(**overrides):
    """Create a mock CustomerLoyalty record."""
    cl = MagicMock(spec=CustomerLoyalty)
    cl.id = str(uuid.uuid4())
    cl.customer_id = CUST_ID
    cl.business_id = BIZ_ID
    cl.points_balance = 500
    cl.lifetime_points = 500
    cl.tier = LoyaltyTier.BRONZE
    cl.tier_updated_at = None
    cl.deleted_at = None
    for k, v in overrides.items():
        setattr(cl, k, v)
    return cl


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def service(db):
    return LoyaltyService(db)


# ---------------------------------------------------------------------------
# get_or_create_program
# ---------------------------------------------------------------------------

class TestGetOrCreateProgram:
    """Tests for LoyaltyService.get_or_create_program."""

    def test_returns_existing(self, service, db):
        """Returns existing program without creating."""
        existing = _mock_program()
        db.query.return_value.filter.return_value.first.return_value = existing
        result = service.get_or_create_program(BIZ_ID)
        assert result == existing
        db.add.assert_not_called()

    def test_creates_when_missing(self, service, db):
        """Creates a new program if none exists."""
        db.query.return_value.filter.return_value.first.return_value = None
        service.get_or_create_program(BIZ_ID)
        db.add.assert_called_once()
        db.commit.assert_called_once()


# ---------------------------------------------------------------------------
# update_program
# ---------------------------------------------------------------------------

class TestUpdateProgram:
    """Tests for LoyaltyService.update_program."""

    def test_updates_fields(self, service, db):
        """Applies kwargs to program."""
        program = _mock_program()
        db.query.return_value.filter.return_value.first.return_value = program
        service.update_program(BIZ_ID, points_per_rand=Decimal("20"))
        assert program.points_per_rand == Decimal("20")
        db.commit.assert_called()

    def test_ignores_none_values(self, service, db):
        """None values are not applied."""
        program = _mock_program()
        original = program.points_per_rand
        db.query.return_value.filter.return_value.first.return_value = program
        service.update_program(BIZ_ID, points_per_rand=None)
        assert program.points_per_rand == original


# ---------------------------------------------------------------------------
# earn_points
# ---------------------------------------------------------------------------

class TestEarnPoints:
    """Tests for LoyaltyService.earn_points."""

    def test_earn_basic(self, service, db):
        """Earns points based on amount and rate."""
        program = _mock_program()
        loyalty = _mock_loyalty(points_balance=0, lifetime_points=0)

        def query_router(model):
            chain = MagicMock()
            if model is LoyaltyProgram:
                chain.filter.return_value.first.return_value = program
            elif model is CustomerLoyalty:
                chain.filter.return_value.first.return_value = loyalty
            return chain
        db.query.side_effect = query_router

        with patch("app.services.loyalty_service.utc_now") as mock_now:
            mock_now.return_value = datetime(2025, 7, 20, tzinfo=timezone.utc)
            service.earn_points(CUST_ID, BIZ_ID, Decimal("100.00"))

        db.add.assert_called()
        added = db.add.call_args[0][0]
        # 100 * 10 points_per_rand * 1.0 bronze multiplier = 1000
        assert added.points == 1000
        assert loyalty.points_balance == 1000
        assert loyalty.lifetime_points == 1000

    def test_earn_inactive_program_raises(self, service, db):
        """Raises ValueError when program is inactive."""
        program = _mock_program(is_active=False)
        db.query.return_value.filter.return_value.first.return_value = program

        with pytest.raises(ValueError, match="not active"):
            service.earn_points(CUST_ID, BIZ_ID, Decimal("50"))

    def test_earn_with_tier_multiplier(self, service, db):
        """Gold tier gets 2x points."""
        program = _mock_program()
        loyalty = _mock_loyalty(
            points_balance=0, lifetime_points=5000, tier=LoyaltyTier.GOLD,
        )

        def query_router(model):
            chain = MagicMock()
            if model is LoyaltyProgram:
                chain.filter.return_value.first.return_value = program
            elif model is CustomerLoyalty:
                chain.filter.return_value.first.return_value = loyalty
            return chain
        db.query.side_effect = query_router

        with patch("app.services.loyalty_service.utc_now") as mock_now:
            mock_now.return_value = datetime(2025, 7, 20, tzinfo=timezone.utc)
            service.earn_points(CUST_ID, BIZ_ID, Decimal("100.00"))

        added = db.add.call_args[0][0]
        # 100 * 10 * 2.0 gold multiplier = 2000
        assert added.points == 2000

    def test_earn_sets_expiry(self, service, db):
        """Points have expiry date when program has expiry_days."""
        program = _mock_program(points_expiry_days=365)
        loyalty = _mock_loyalty(points_balance=0, lifetime_points=0)

        def query_router(model):
            chain = MagicMock()
            if model is LoyaltyProgram:
                chain.filter.return_value.first.return_value = program
            elif model is CustomerLoyalty:
                chain.filter.return_value.first.return_value = loyalty
            return chain
        db.query.side_effect = query_router

        now = datetime(2025, 7, 20, tzinfo=timezone.utc)
        with patch("app.services.loyalty_service.utc_now", return_value=now):
            service.earn_points(CUST_ID, BIZ_ID, Decimal("50"))

        added = db.add.call_args[0][0]
        assert added.expires_at == now + timedelta(days=365)


# ---------------------------------------------------------------------------
# redeem_points
# ---------------------------------------------------------------------------

class TestRedeemPoints:
    """Tests for LoyaltyService.redeem_points."""

    def test_redeem_success(self, service, db):
        """Redeems points and returns discount value."""
        program = _mock_program()
        loyalty = _mock_loyalty(points_balance=500)

        def query_router(model):
            chain = MagicMock()
            if model is LoyaltyProgram:
                chain.filter.return_value.first.return_value = program
            elif model is CustomerLoyalty:
                chain.filter.return_value.first.return_value = loyalty
            return chain
        db.query.side_effect = query_router

        transaction, discount = service.redeem_points(CUST_ID, BIZ_ID, 200)

        db.add.assert_called()
        added = db.add.call_args[0][0]
        assert added.points == -200
        assert loyalty.points_balance == 300
        # 200 / 100 redemption_rate = R2.00
        assert discount == Decimal("2")

    def test_redeem_insufficient_points(self, service, db):
        """Raises ValueError when balance is too low."""
        program = _mock_program()
        loyalty = _mock_loyalty(points_balance=50)

        def query_router(model):
            chain = MagicMock()
            if model is LoyaltyProgram:
                chain.filter.return_value.first.return_value = program
            elif model is CustomerLoyalty:
                chain.filter.return_value.first.return_value = loyalty
            return chain
        db.query.side_effect = query_router

        with pytest.raises(ValueError, match="Insufficient points"):
            service.redeem_points(CUST_ID, BIZ_ID, 200)

    def test_redeem_below_minimum(self, service, db):
        """Raises ValueError when below min_redemption_points."""
        program = _mock_program(min_redemption_points=100)
        loyalty = _mock_loyalty(points_balance=500)

        def query_router(model):
            chain = MagicMock()
            if model is LoyaltyProgram:
                chain.filter.return_value.first.return_value = program
            elif model is CustomerLoyalty:
                chain.filter.return_value.first.return_value = loyalty
            return chain
        db.query.side_effect = query_router

        with pytest.raises(ValueError, match="Minimum redemption"):
            service.redeem_points(CUST_ID, BIZ_ID, 50)

    def test_redeem_not_enrolled(self, service, db):
        """Raises ValueError if customer not enrolled."""
        program = _mock_program()

        def query_router(model):
            chain = MagicMock()
            if model is LoyaltyProgram:
                chain.filter.return_value.first.return_value = program
            elif model is CustomerLoyalty:
                chain.filter.return_value.first.return_value = None
            return chain
        db.query.side_effect = query_router

        with pytest.raises(ValueError, match="not enrolled"):
            service.redeem_points(CUST_ID, BIZ_ID, 100)

    def test_redeem_inactive_program(self, service, db):
        """Raises ValueError when program is inactive."""
        program = _mock_program(is_active=False)
        db.query.return_value.filter.return_value.first.return_value = program

        with pytest.raises(ValueError, match="not active"):
            service.redeem_points(CUST_ID, BIZ_ID, 100)


# ---------------------------------------------------------------------------
# check_tier_upgrade
# ---------------------------------------------------------------------------

class TestCheckTierUpgrade:
    """Tests for LoyaltyService.check_tier_upgrade."""

    def test_upgrade_to_silver(self, service, db):
        """Upgrades to silver when threshold reached."""
        program = _mock_program()
        loyalty = _mock_loyalty(
            lifetime_points=1000, tier=LoyaltyTier.BRONZE,
        )

        def query_router(model):
            chain = MagicMock()
            if model is LoyaltyProgram:
                chain.filter.return_value.first.return_value = program
            elif model is CustomerLoyalty:
                chain.filter.return_value.first.return_value = loyalty
            return chain
        db.query.side_effect = query_router

        with patch("app.services.loyalty_service.utc_now") as mock_now:
            mock_now.return_value = datetime(2025, 7, 20, tzinfo=timezone.utc)
            result = service.check_tier_upgrade(CUST_ID, BIZ_ID)

        assert result == LoyaltyTier.SILVER
        assert loyalty.tier == LoyaltyTier.SILVER

    def test_no_upgrade_same_tier(self, service, db):
        """Returns None when tier doesn't change."""
        program = _mock_program()
        loyalty = _mock_loyalty(lifetime_points=500, tier=LoyaltyTier.BRONZE)

        def query_router(model):
            chain = MagicMock()
            if model is LoyaltyProgram:
                chain.filter.return_value.first.return_value = program
            elif model is CustomerLoyalty:
                chain.filter.return_value.first.return_value = loyalty
            return chain
        db.query.side_effect = query_router

        result = service.check_tier_upgrade(CUST_ID, BIZ_ID)
        assert result is None

    def test_upgrade_to_platinum(self, service, db):
        """Upgrades to platinum at highest threshold."""
        program = _mock_program()
        loyalty = _mock_loyalty(
            lifetime_points=10000, tier=LoyaltyTier.GOLD,
        )

        def query_router(model):
            chain = MagicMock()
            if model is LoyaltyProgram:
                chain.filter.return_value.first.return_value = program
            elif model is CustomerLoyalty:
                chain.filter.return_value.first.return_value = loyalty
            return chain
        db.query.side_effect = query_router

        with patch("app.services.loyalty_service.utc_now"):
            result = service.check_tier_upgrade(CUST_ID, BIZ_ID)
        assert result == LoyaltyTier.PLATINUM


# ---------------------------------------------------------------------------
# get_points_history
# ---------------------------------------------------------------------------

class TestGetPointsHistory:
    """Tests for LoyaltyService.get_points_history."""

    def test_returns_paginated(self, service, db):
        """Returns (transactions, total) tuple."""
        chain = db.query.return_value.filter.return_value
        chain.count.return_value = 5
        mock_txs = [MagicMock(spec=PointsTransaction) for _ in range(5)]
        chain.order_by.return_value.offset.return_value.limit.return_value.all.return_value = mock_txs

        txs, total = service.get_points_history(CUST_ID, BIZ_ID)
        assert total == 5
        assert len(txs) == 5

    def test_empty_history(self, service, db):
        """Returns empty list when no transactions."""
        chain = db.query.return_value.filter.return_value
        chain.count.return_value = 0
        chain.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []

        txs, total = service.get_points_history(CUST_ID, BIZ_ID)
        assert total == 0
        assert txs == []


# ---------------------------------------------------------------------------
# get_redemption_value
# ---------------------------------------------------------------------------

class TestGetRedemptionValue:
    """Tests for LoyaltyService.get_redemption_value."""

    def test_calculates_correctly(self, service, db):
        """100 points / 100 rate = R1.00."""
        program = _mock_program(redemption_rate=Decimal("100"))
        db.query.return_value.filter.return_value.first.return_value = program

        value = service.get_redemption_value(500, BIZ_ID)
        assert value == Decimal("5")

    def test_zero_rate_returns_zero(self, service, db):
        """Zero redemption rate returns R0.00."""
        program = _mock_program(redemption_rate=Decimal("0"))
        db.query.return_value.filter.return_value.first.return_value = program

        value = service.get_redemption_value(500, BIZ_ID)
        assert value == Decimal("0.00")


# ---------------------------------------------------------------------------
# get_top_members
# ---------------------------------------------------------------------------

class TestGetTopMembers:
    """Tests for LoyaltyService.get_top_members."""

    def test_returns_limited_list(self, service, db):
        """Returns up to limit members."""
        mocks = [_mock_loyalty() for _ in range(5)]
        db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = mocks

        result = service.get_top_members(BIZ_ID, limit=5)
        assert len(result) == 5


# ---------------------------------------------------------------------------
# get_program_stats
# ---------------------------------------------------------------------------

class TestGetProgramStats:
    """Tests for LoyaltyService.get_program_stats."""

    def test_returns_stats_dict(self, service, db):
        """Returns a dict with all expected keys."""
        base_chain = MagicMock()
        base_chain.count.return_value = 10
        base_chain.filter.return_value.count.return_value = 5

        db.query.return_value.filter.return_value = base_chain
        db.query.return_value.filter.return_value.scalar.return_value = 5000

        result = service.get_program_stats(BIZ_ID)
        assert "total_members" in result
        assert "active_members" in result
        assert "total_points_issued" in result
        assert "members_by_tier" in result


# ---------------------------------------------------------------------------
# get_members
# ---------------------------------------------------------------------------

class TestGetMembers:
    """Tests for LoyaltyService.get_members."""

    def test_list_members(self, service, db):
        """Returns (members, total) tuple."""
        chain = db.query.return_value.filter.return_value
        chain.count.return_value = 3
        mocks = [_mock_loyalty() for _ in range(3)]
        chain.order_by.return_value.offset.return_value.limit.return_value.all.return_value = mocks

        members, total = service.get_members(BIZ_ID)
        assert total == 3
        assert len(members) == 3

    def test_filter_by_tier(self, service, db):
        """Applies tier filter."""
        chain = db.query.return_value.filter.return_value
        chain.filter.return_value = chain
        chain.count.return_value = 0
        chain.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []

        members, total = service.get_members(BIZ_ID, tier=LoyaltyTier.GOLD)
        assert total == 0


# ---------------------------------------------------------------------------
# get_points_expiring_soon
# ---------------------------------------------------------------------------

class TestGetPointsExpiringSoon:
    """Tests for LoyaltyService.get_points_expiring_soon."""

    def test_returns_expiring_list(self, service, db):
        """Returns list of dicts for expiring points."""
        now = datetime(2025, 7, 20, tzinfo=timezone.utc)
        expires = now + timedelta(days=3)

        mock_tx = MagicMock(spec=PointsTransaction)
        mock_tx.customer_id = uuid.uuid4()
        mock_tx.id = uuid.uuid4()
        mock_tx.points = 200
        mock_tx.expires_at = expires

        db.query.return_value.filter.return_value.all.return_value = [mock_tx]

        with patch("app.services.loyalty_service.utc_now", return_value=now):
            result = service.get_points_expiring_soon(BIZ_ID, warning_days=7)

        assert len(result) == 1
        assert result[0]["points"] == 200
        assert result[0]["days_remaining"] == 3

    def test_empty_when_none_expiring(self, service, db):
        """Returns empty list when nothing expires soon."""
        db.query.return_value.filter.return_value.all.return_value = []
        now = datetime(2025, 7, 20, tzinfo=timezone.utc)
        with patch("app.services.loyalty_service.utc_now", return_value=now):
            result = service.get_points_expiring_soon(BIZ_ID)
        assert result == []
