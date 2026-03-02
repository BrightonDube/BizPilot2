"""Gift card service for business logic."""

import secrets
from typing import List, Optional, Tuple
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.gift_card import GiftCard, GiftCardTransaction, GiftCardStatus


class GiftCardService:
    """Service for gift card operations."""

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _generate_code() -> str:
        """Generate a unique gift card code (GC-XXXX-XXXX)."""
        part1 = secrets.token_hex(2).upper()
        part2 = secrets.token_hex(2).upper()
        return f"GC-{part1}-{part2}"

    def create_gift_card(
        self,
        business_id: str,
        initial_value: Decimal,
        customer_name: Optional[str] = None,
        customer_email: Optional[str] = None,
        customer_id: Optional[str] = None,
        expires_at=None,
        notes: Optional[str] = None,
    ) -> GiftCard:
        """Issue a new gift card with a unique code."""
        # Generate unique code with retry
        for _ in range(10):
            code = self._generate_code()
            existing = (
                self.db.query(GiftCard).filter(GiftCard.code == code).first()
            )
            if not existing:
                break
        else:
            raise ValueError("Failed to generate unique gift card code")

        card = GiftCard(
            business_id=business_id,
            code=code,
            initial_value=initial_value,
            current_balance=initial_value,
            status=GiftCardStatus.ACTIVE,
            customer_id=customer_id,
            customer_name=customer_name,
            customer_email=customer_email,
            expires_at=expires_at,
            notes=notes,
        )
        self.db.add(card)
        self.db.flush()

        tx = GiftCardTransaction(
            gift_card_id=card.id,
            transaction_type="issue",
            amount=initial_value,
            balance_after=initial_value,
            notes="Gift card issued",
        )
        self.db.add(tx)
        self.db.commit()
        self.db.refresh(card)
        return card

    def list_gift_cards(
        self,
        business_id: str,
        status: Optional[GiftCardStatus] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[GiftCard], int]:
        """List gift cards with optional status filter and pagination."""
        query = self.db.query(GiftCard).filter(
            GiftCard.business_id == business_id,
            GiftCard.deleted_at.is_(None),
        )
        if status:
            query = query.filter(GiftCard.status == status)

        total = query.count()
        cards = (
            query.order_by(GiftCard.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return cards, total

    def get_gift_card(
        self, card_id: str, business_id: str
    ) -> Optional[GiftCard]:
        """Get a single gift card by ID with transactions."""
        return (
            self.db.query(GiftCard)
            .filter(
                GiftCard.id == card_id,
                GiftCard.business_id == business_id,
                GiftCard.deleted_at.is_(None),
            )
            .first()
        )

    def get_by_code(
        self, code: str, business_id: str
    ) -> Optional[GiftCard]:
        """Look up a gift card by its code."""
        return (
            self.db.query(GiftCard)
            .filter(
                GiftCard.code == code,
                GiftCard.business_id == business_id,
                GiftCard.deleted_at.is_(None),
            )
            .first()
        )

    def redeem(
        self,
        card_id: str,
        business_id: str,
        amount: Decimal,
        reference: Optional[str] = None,
        performed_by: Optional[str] = None,
    ) -> GiftCardTransaction:
        """Redeem (deduct) an amount from a gift card."""
        card = self.get_gift_card(card_id, business_id)
        if not card:
            raise ValueError("Gift card not found")
        if card.status != GiftCardStatus.ACTIVE:
            raise ValueError(f"Gift card is {card.status.value}")
        if amount > card.current_balance:
            raise ValueError(
                f"Insufficient balance. Available: {card.current_balance}"
            )

        card.current_balance -= amount
        if card.current_balance == 0:
            card.status = GiftCardStatus.REDEEMED

        tx = GiftCardTransaction(
            gift_card_id=card.id,
            transaction_type="redeem",
            amount=amount,
            balance_after=card.current_balance,
            reference=reference,
            performed_by=performed_by,
        )
        self.db.add(tx)
        self.db.commit()
        self.db.refresh(tx)
        return tx

    def top_up(
        self,
        card_id: str,
        business_id: str,
        amount: Decimal,
        performed_by: Optional[str] = None,
    ) -> GiftCardTransaction:
        """Add balance to a gift card."""
        card = self.get_gift_card(card_id, business_id)
        if not card:
            raise ValueError("Gift card not found")
        if card.status == GiftCardStatus.CANCELLED:
            raise ValueError("Cannot top up a cancelled gift card")

        card.current_balance += amount
        if card.status == GiftCardStatus.REDEEMED:
            card.status = GiftCardStatus.ACTIVE

        tx = GiftCardTransaction(
            gift_card_id=card.id,
            transaction_type="topup",
            amount=amount,
            balance_after=card.current_balance,
            performed_by=performed_by,
        )
        self.db.add(tx)
        self.db.commit()
        self.db.refresh(tx)
        return tx

    def check_balance(self, code: str, business_id: str) -> Optional[GiftCard]:
        """Return gift card balance info by code."""
        return self.get_by_code(code, business_id)

    def cancel_gift_card(
        self, card_id: str, business_id: str
    ) -> GiftCard:
        """Cancel a gift card."""
        card = self.get_gift_card(card_id, business_id)
        if not card:
            raise ValueError("Gift card not found")
        card.status = GiftCardStatus.CANCELLED
        self.db.commit()
        self.db.refresh(card)
        return card

    def get_stats(self, business_id: str) -> dict:
        """Get gift card statistics for a business."""
        base = self.db.query(GiftCard).filter(
            GiftCard.business_id == business_id,
            GiftCard.deleted_at.is_(None),
        )

        total_issued = (
            self.db.query(func.coalesce(func.sum(GiftCard.initial_value), 0))
            .filter(
                GiftCard.business_id == business_id,
                GiftCard.deleted_at.is_(None),
            )
            .scalar()
        )

        total_redeemed = (
            self.db.query(
                func.coalesce(func.sum(GiftCardTransaction.amount), 0)
            )
            .join(GiftCard, GiftCardTransaction.gift_card_id == GiftCard.id)
            .filter(
                GiftCard.business_id == business_id,
                GiftCardTransaction.transaction_type == "redeem",
                GiftCardTransaction.deleted_at.is_(None),
            )
            .scalar()
        )

        outstanding_balance = (
            self.db.query(
                func.coalesce(func.sum(GiftCard.current_balance), 0)
            )
            .filter(
                GiftCard.business_id == business_id,
                GiftCard.status == GiftCardStatus.ACTIVE,
                GiftCard.deleted_at.is_(None),
            )
            .scalar()
        )

        active_count = base.filter(
            GiftCard.status == GiftCardStatus.ACTIVE
        ).count()

        return {
            "total_issued": Decimal(str(total_issued)),
            "total_redeemed": Decimal(str(total_redeemed)),
            "outstanding_balance": Decimal(str(outstanding_balance)),
            "active_count": active_count,
        }
