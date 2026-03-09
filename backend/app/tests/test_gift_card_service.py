"""Unit tests for GiftCardService."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.models.gift_card import GiftCard, GiftCardTransaction, GiftCardStatus
from app.services.gift_card_service import GiftCardService

BIZ = str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _chain(first=None, rows=None, count=0, scalar=None):
    """Reusable mock that supports the common SQLAlchemy chained-call pattern."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = scalar
    return c


def _mock_card(**kwargs):
    """Return a MagicMock with GiftCard-like attributes."""
    gc = MagicMock()
    gc.id = kwargs.get("id", uuid.uuid4())
    gc.business_id = kwargs.get("business_id", BIZ)
    gc.code = kwargs.get("code", "GC-AAAA-BBBB")
    gc.initial_value = kwargs.get("initial_value", Decimal("100.00"))
    gc.current_balance = kwargs.get("current_balance", Decimal("100.00"))
    gc.status = kwargs.get("status", GiftCardStatus.ACTIVE)
    gc.customer_id = kwargs.get("customer_id", None)
    gc.customer_name = kwargs.get("customer_name", None)
    gc.customer_email = kwargs.get("customer_email", None)
    gc.expires_at = kwargs.get("expires_at", None)
    gc.notes = kwargs.get("notes", None)
    gc.deleted_at = None
    gc.transactions = kwargs.get("transactions", [])
    return gc


# ---------------------------------------------------------------------------
# _generate_code
# ---------------------------------------------------------------------------

class TestGenerateCode:
    def test_format(self):
        code = GiftCardService._generate_code()
        parts = code.split("-")
        assert parts[0] == "GC"
        assert len(parts) == 3
        assert len(parts[1]) == 4
        assert len(parts[2]) == 4

    def test_hex_characters(self):
        code = GiftCardService._generate_code()
        _, p1, p2 = code.split("-")
        int(p1, 16)  # raises if not valid hex
        int(p2, 16)

    def test_uniqueness(self):
        codes = {GiftCardService._generate_code() for _ in range(50)}
        assert len(codes) == 50


# ---------------------------------------------------------------------------
# create_gift_card
# ---------------------------------------------------------------------------

class TestCreateGiftCard:
    def test_success(self):
        db = MagicMock()
        db.query.return_value = _chain(first=None)
        svc = GiftCardService(db)

        card = svc.create_gift_card(
            BIZ, Decimal("200.00"), customer_name="Alice",
        )

        assert card.code.startswith("GC-")
        assert card.initial_value == Decimal("200.00")
        assert card.current_balance == Decimal("200.00")
        assert card.status == GiftCardStatus.ACTIVE
        assert db.add.call_count == 2  # card + transaction
        db.flush.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_collision_retry_succeeds(self):
        db = MagicMock()
        existing = _mock_card()

        call_counter = {"n": 0}
        chains = [
            _chain(first=existing),  # collision
            _chain(first=existing),  # collision
            _chain(first=None),      # unique
        ]

        def side_effect(*args):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[idx]

        db.query.side_effect = side_effect
        svc = GiftCardService(db)

        card = svc.create_gift_card(BIZ, Decimal("50.00"))
        assert card is not None
        assert call_counter["n"] == 3

    def test_code_exhausted_raises(self):
        db = MagicMock()
        db.query.return_value = _chain(first=_mock_card())
        svc = GiftCardService(db)

        with pytest.raises(ValueError, match="unique gift card code"):
            svc.create_gift_card(BIZ, Decimal("50.00"))


# ---------------------------------------------------------------------------
# list_gift_cards
# ---------------------------------------------------------------------------

class TestListGiftCards:
    def test_no_filter(self):
        db = MagicMock()
        cards = [_mock_card(), _mock_card()]
        db.query.return_value = _chain(rows=cards, count=2)
        svc = GiftCardService(db)

        result, total = svc.list_gift_cards(BIZ)
        assert total == 2
        assert len(result) == 2

    def test_with_status_filter(self):
        db = MagicMock()
        card = _mock_card(status=GiftCardStatus.ACTIVE)
        db.query.return_value = _chain(rows=[card], count=1)
        svc = GiftCardService(db)

        result, total = svc.list_gift_cards(BIZ, status=GiftCardStatus.ACTIVE)
        assert total == 1
        assert result[0] == card

    def test_empty(self):
        db = MagicMock()
        db.query.return_value = _chain()
        svc = GiftCardService(db)

        result, total = svc.list_gift_cards(BIZ)
        assert total == 0
        assert result == []

    def test_pagination_offset_and_limit(self):
        db = MagicMock()
        chain = _chain(rows=[_mock_card()], count=25)
        db.query.return_value = chain
        svc = GiftCardService(db)

        result, total = svc.list_gift_cards(BIZ, page=3, per_page=10)
        assert total == 25
        chain.offset.assert_called_with(20)   # (3-1)*10
        chain.limit.assert_called_with(10)


# ---------------------------------------------------------------------------
# get_gift_card
# ---------------------------------------------------------------------------

class TestGetGiftCard:
    def test_found(self):
        db = MagicMock()
        card = _mock_card()
        db.query.return_value = _chain(first=card)
        svc = GiftCardService(db)

        assert svc.get_gift_card(str(card.id), BIZ) is card

    def test_not_found(self):
        db = MagicMock()
        db.query.return_value = _chain(first=None)
        svc = GiftCardService(db)

        assert svc.get_gift_card(str(uuid.uuid4()), BIZ) is None


# ---------------------------------------------------------------------------
# get_by_code
# ---------------------------------------------------------------------------

class TestGetByCode:
    def test_found(self):
        db = MagicMock()
        card = _mock_card(code="GC-1234-5678")
        db.query.return_value = _chain(first=card)
        svc = GiftCardService(db)

        assert svc.get_by_code("GC-1234-5678", BIZ) is card

    def test_not_found(self):
        db = MagicMock()
        db.query.return_value = _chain(first=None)
        svc = GiftCardService(db)

        assert svc.get_by_code("GC-0000-0000", BIZ) is None


# ---------------------------------------------------------------------------
# redeem
# ---------------------------------------------------------------------------

class TestRedeem:
    def test_success_partial(self):
        db = MagicMock()
        card = _mock_card(current_balance=Decimal("100.00"))
        db.query.return_value = _chain(first=card)
        svc = GiftCardService(db)

        tx = svc.redeem(str(card.id), BIZ, Decimal("40.00"), reference="ORD-1")

        assert card.current_balance == Decimal("60.00")
        assert card.status == GiftCardStatus.ACTIVE
        assert tx.transaction_type == "redeem"
        assert tx.amount == Decimal("40.00")
        assert tx.balance_after == Decimal("60.00")
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_full_balance_marks_redeemed(self):
        db = MagicMock()
        card = _mock_card(current_balance=Decimal("50.00"))
        db.query.return_value = _chain(first=card)
        svc = GiftCardService(db)

        svc.redeem(str(card.id), BIZ, Decimal("50.00"))

        assert card.current_balance == Decimal("0.00")
        assert card.status == GiftCardStatus.REDEEMED

    def test_not_found(self):
        db = MagicMock()
        db.query.return_value = _chain(first=None)
        svc = GiftCardService(db)

        with pytest.raises(ValueError, match="not found"):
            svc.redeem(str(uuid.uuid4()), BIZ, Decimal("10.00"))

    def test_not_active(self):
        db = MagicMock()
        card = _mock_card(status=GiftCardStatus.CANCELLED)
        db.query.return_value = _chain(first=card)
        svc = GiftCardService(db)

        with pytest.raises(ValueError, match="cancelled"):
            svc.redeem(str(card.id), BIZ, Decimal("10.00"))

    def test_insufficient_balance(self):
        db = MagicMock()
        card = _mock_card(current_balance=Decimal("30.00"))
        db.query.return_value = _chain(first=card)
        svc = GiftCardService(db)

        with pytest.raises(ValueError, match="Insufficient balance"):
            svc.redeem(str(card.id), BIZ, Decimal("50.00"))


# ---------------------------------------------------------------------------
# top_up
# ---------------------------------------------------------------------------

class TestTopUp:
    def test_success(self):
        db = MagicMock()
        card = _mock_card(current_balance=Decimal("50.00"))
        db.query.return_value = _chain(first=card)
        svc = GiftCardService(db)

        tx = svc.top_up(str(card.id), BIZ, Decimal("25.00"))

        assert card.current_balance == Decimal("75.00")
        assert tx.transaction_type == "topup"
        assert tx.amount == Decimal("25.00")
        assert tx.balance_after == Decimal("75.00")
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_reactivates_redeemed_card(self):
        db = MagicMock()
        card = _mock_card(
            current_balance=Decimal("0.00"), status=GiftCardStatus.REDEEMED,
        )
        db.query.return_value = _chain(first=card)
        svc = GiftCardService(db)

        svc.top_up(str(card.id), BIZ, Decimal("100.00"))

        assert card.status == GiftCardStatus.ACTIVE
        assert card.current_balance == Decimal("100.00")

    def test_not_found(self):
        db = MagicMock()
        db.query.return_value = _chain(first=None)
        svc = GiftCardService(db)

        with pytest.raises(ValueError, match="not found"):
            svc.top_up(str(uuid.uuid4()), BIZ, Decimal("10.00"))

    def test_cancelled_card(self):
        db = MagicMock()
        card = _mock_card(status=GiftCardStatus.CANCELLED)
        db.query.return_value = _chain(first=card)
        svc = GiftCardService(db)

        with pytest.raises(ValueError, match="cancelled"):
            svc.top_up(str(card.id), BIZ, Decimal("10.00"))


# ---------------------------------------------------------------------------
# check_balance
# ---------------------------------------------------------------------------

class TestCheckBalance:
    def test_returns_card(self):
        db = MagicMock()
        card = _mock_card(code="GC-ABCD-EF01")
        db.query.return_value = _chain(first=card)
        svc = GiftCardService(db)

        assert svc.check_balance("GC-ABCD-EF01", BIZ) is card

    def test_returns_none_when_missing(self):
        db = MagicMock()
        db.query.return_value = _chain(first=None)
        svc = GiftCardService(db)

        assert svc.check_balance("GC-NOPE-0000", BIZ) is None


# ---------------------------------------------------------------------------
# cancel_gift_card
# ---------------------------------------------------------------------------

class TestCancelGiftCard:
    def test_success(self):
        db = MagicMock()
        card = _mock_card()
        db.query.return_value = _chain(first=card)
        svc = GiftCardService(db)

        result = svc.cancel_gift_card(str(card.id), BIZ)

        assert result.status == GiftCardStatus.CANCELLED
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(card)

    def test_not_found(self):
        db = MagicMock()
        db.query.return_value = _chain(first=None)
        svc = GiftCardService(db)

        with pytest.raises(ValueError, match="not found"):
            svc.cancel_gift_card(str(uuid.uuid4()), BIZ)


# ---------------------------------------------------------------------------
# get_stats
# ---------------------------------------------------------------------------

class TestGetStats:
    def test_returns_aggregated_values(self):
        db = MagicMock()
        base_chain = _chain(count=7)
        issued_chain = _chain(scalar=Decimal("1000.00"))
        redeemed_chain = _chain(scalar=Decimal("350.00"))
        outstanding_chain = _chain(scalar=Decimal("650.00"))

        call_counter = {"n": 0}
        chains = [base_chain, issued_chain, redeemed_chain, outstanding_chain]

        def side_effect(*args):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[idx]

        db.query.side_effect = side_effect
        svc = GiftCardService(db)

        stats = svc.get_stats(BIZ)

        assert stats["total_issued"] == Decimal("1000.00")
        assert stats["total_redeemed"] == Decimal("350.00")
        assert stats["outstanding_balance"] == Decimal("650.00")
        assert stats["active_count"] == 7
        assert call_counter["n"] == 4

    def test_zero_stats(self):
        db = MagicMock()
        base_chain = _chain(count=0)
        issued_chain = _chain(scalar=0)
        redeemed_chain = _chain(scalar=0)
        outstanding_chain = _chain(scalar=0)

        call_counter = {"n": 0}
        chains = [base_chain, issued_chain, redeemed_chain, outstanding_chain]

        def side_effect(*args):
            idx = call_counter["n"]
            call_counter["n"] += 1
            return chains[idx]

        db.query.side_effect = side_effect
        svc = GiftCardService(db)

        stats = svc.get_stats(BIZ)

        assert stats["total_issued"] == Decimal("0")
        assert stats["total_redeemed"] == Decimal("0")
        assert stats["outstanding_balance"] == Decimal("0")
        assert stats["active_count"] == 0
