"""Loyalty program service for business logic."""

from typing import List, Optional, Tuple
from decimal import Decimal
from datetime import timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.loyalty import (
    LoyaltyProgram,
    CustomerLoyalty,
    PointsTransaction,
    LoyaltyTier,
    PointsTransactionType,
)
from app.models.base import utc_now


class LoyaltyService:
    """Service for loyalty program operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_or_create_program(self, business_id: str) -> LoyaltyProgram:
        """Get or create default loyalty program config for a business."""
        program = self.db.query(LoyaltyProgram).filter(
            LoyaltyProgram.business_id == business_id,
            LoyaltyProgram.deleted_at.is_(None),
        ).first()

        if not program:
            program = LoyaltyProgram(business_id=business_id)
            self.db.add(program)
            self.db.commit()
            self.db.refresh(program)

        return program

    def update_program(self, business_id: str, **kwargs) -> LoyaltyProgram:
        """Update loyalty program settings."""
        program = self.get_or_create_program(business_id)
        for key, value in kwargs.items():
            if value is not None and hasattr(program, key):
                setattr(program, key, value)
        self.db.commit()
        self.db.refresh(program)
        return program

    def get_customer_loyalty(self, customer_id: str, business_id: str) -> Optional[CustomerLoyalty]:
        """Get customer loyalty status."""
        return self.db.query(CustomerLoyalty).filter(
            CustomerLoyalty.customer_id == customer_id,
            CustomerLoyalty.business_id == business_id,
            CustomerLoyalty.deleted_at.is_(None),
        ).first()

    def _get_or_create_customer_loyalty(self, customer_id: str, business_id: str) -> CustomerLoyalty:
        """Get or create customer loyalty record."""
        loyalty = self.get_customer_loyalty(customer_id, business_id)
        if not loyalty:
            loyalty = CustomerLoyalty(
                customer_id=customer_id,
                business_id=business_id,
                points_balance=0,
                lifetime_points=0,
                tier=LoyaltyTier.BRONZE,
            )
            self.db.add(loyalty)
            self.db.commit()
            self.db.refresh(loyalty)
        return loyalty

    def _get_tier_multiplier(self, tier: LoyaltyTier, program: LoyaltyProgram) -> Decimal:
        """Get the points multiplier for a given tier."""
        multipliers = {
            LoyaltyTier.BRONZE: Decimal("1.0"),
            LoyaltyTier.SILVER: program.silver_multiplier,
            LoyaltyTier.GOLD: program.gold_multiplier,
            LoyaltyTier.PLATINUM: program.platinum_multiplier,
        }
        return multipliers.get(tier, Decimal("1.0"))

    def earn_points(
        self,
        customer_id: str,
        business_id: str,
        amount_spent: Decimal,
        order_id: str = None,
    ) -> PointsTransaction:
        """Calculate and add points based on amount spent."""
        program = self.get_or_create_program(business_id)
        if not program.is_active:
            raise ValueError("Loyalty program is not active")

        loyalty = self._get_or_create_customer_loyalty(customer_id, business_id)

        # Calculate points with tier multiplier
        multiplier = self._get_tier_multiplier(loyalty.tier, program)
        base_points = int(amount_spent * program.points_per_rand)
        earned_points = int(base_points * multiplier)

        loyalty.points_balance += earned_points
        loyalty.lifetime_points += earned_points

        # Calculate expiry
        expires_at = None
        if program.points_expiry_days and program.points_expiry_days > 0:
            expires_at = utc_now() + timedelta(days=program.points_expiry_days)

        transaction = PointsTransaction(
            customer_id=customer_id,
            business_id=business_id,
            transaction_type=PointsTransactionType.EARN,
            points=earned_points,
            balance_after=loyalty.points_balance,
            order_id=order_id,
            description=f"Earned {earned_points} points on R{amount_spent:.2f} purchase",
            expires_at=expires_at,
        )
        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)

        # Check for tier upgrade
        self.check_tier_upgrade(customer_id, business_id)

        return transaction

    def redeem_points(
        self,
        customer_id: str,
        business_id: str,
        points: int,
        order_id: str = None,
    ) -> Tuple[PointsTransaction, Decimal]:
        """Redeem points for discount. Returns transaction and discount value."""
        program = self.get_or_create_program(business_id)
        if not program.is_active:
            raise ValueError("Loyalty program is not active")

        loyalty = self.get_customer_loyalty(customer_id, business_id)
        if not loyalty:
            raise ValueError("Customer is not enrolled in loyalty program")

        if points < program.min_redemption_points:
            raise ValueError(
                f"Minimum redemption is {program.min_redemption_points} points"
            )

        if loyalty.points_balance < points:
            raise ValueError(
                f"Insufficient points. Balance: {loyalty.points_balance}"
            )

        discount_value = self.get_redemption_value(points, business_id)

        loyalty.points_balance -= points

        transaction = PointsTransaction(
            customer_id=customer_id,
            business_id=business_id,
            transaction_type=PointsTransactionType.REDEEM,
            points=-points,
            balance_after=loyalty.points_balance,
            order_id=order_id,
            description=f"Redeemed {points} points for R{discount_value:.2f} discount",
        )
        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)

        return transaction, discount_value

    def get_redemption_value(self, points: int, business_id: str) -> Decimal:
        """Calculate rand value of points."""
        program = self.get_or_create_program(business_id)
        if program.redemption_rate <= 0:
            return Decimal("0.00")
        return Decimal(str(points)) / program.redemption_rate

    def check_tier_upgrade(self, customer_id: str, business_id: str) -> Optional[LoyaltyTier]:
        """Check and upgrade tier based on lifetime points. Returns new tier if upgraded."""
        program = self.get_or_create_program(business_id)
        loyalty = self.get_customer_loyalty(customer_id, business_id)
        if not loyalty:
            return None

        old_tier = loyalty.tier
        new_tier = LoyaltyTier.BRONZE

        if loyalty.lifetime_points >= program.platinum_threshold:
            new_tier = LoyaltyTier.PLATINUM
        elif loyalty.lifetime_points >= program.gold_threshold:
            new_tier = LoyaltyTier.GOLD
        elif loyalty.lifetime_points >= program.silver_threshold:
            new_tier = LoyaltyTier.SILVER

        if new_tier != old_tier:
            loyalty.tier = new_tier
            loyalty.tier_updated_at = utc_now()
            self.db.commit()
            return new_tier

        return None

    def get_points_history(
        self,
        customer_id: str,
        business_id: str,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[PointsTransaction], int]:
        """Get points transaction history with pagination."""
        query = self.db.query(PointsTransaction).filter(
            PointsTransaction.customer_id == customer_id,
            PointsTransaction.business_id == business_id,
            PointsTransaction.deleted_at.is_(None),
        )

        total = query.count()

        transactions = (
            query.order_by(PointsTransaction.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        return transactions, total

    def expire_old_points(self, business_id: str) -> int:
        """Expire points past expiry date. Returns number of transactions expired."""
        now = utc_now()

        # Find expired earn transactions
        expired_transactions = self.db.query(PointsTransaction).filter(
            PointsTransaction.business_id == business_id,
            PointsTransaction.transaction_type == PointsTransactionType.EARN,
            PointsTransaction.expires_at.isnot(None),
            PointsTransaction.expires_at <= now,
            PointsTransaction.deleted_at.is_(None),
        ).all()

        expired_count = 0
        for tx in expired_transactions:
            loyalty = self.get_customer_loyalty(str(tx.customer_id), business_id)
            if loyalty and loyalty.points_balance > 0:
                points_to_expire = min(tx.points, loyalty.points_balance)
                if points_to_expire > 0:
                    loyalty.points_balance -= points_to_expire

                    expire_tx = PointsTransaction(
                        customer_id=tx.customer_id,
                        business_id=business_id,
                        transaction_type=PointsTransactionType.EXPIRE,
                        points=-points_to_expire,
                        balance_after=loyalty.points_balance,
                        description=f"Expired {points_to_expire} points",
                    )
                    self.db.add(expire_tx)
                    expired_count += 1

            # Mark original transaction as processed by soft-deleting
            tx.soft_delete()

        if expired_count > 0:
            self.db.commit()

        return expired_count

    def get_top_members(
        self, business_id: str, limit: int = 10
    ) -> List[CustomerLoyalty]:
        """Get top loyalty members by lifetime points."""
        return (
            self.db.query(CustomerLoyalty)
            .filter(
                CustomerLoyalty.business_id == business_id,
                CustomerLoyalty.deleted_at.is_(None),
            )
            .order_by(CustomerLoyalty.lifetime_points.desc())
            .limit(limit)
            .all()
        )

    def get_program_stats(self, business_id: str) -> dict:
        """Get loyalty program statistics."""
        base_query = self.db.query(CustomerLoyalty).filter(
            CustomerLoyalty.business_id == business_id,
            CustomerLoyalty.deleted_at.is_(None),
        )

        total_members = base_query.count()
        active_members = base_query.filter(
            CustomerLoyalty.points_balance > 0,
        ).count()

        # Points issued (sum of all earn transactions)
        total_points_issued = (
            self.db.query(func.coalesce(func.sum(PointsTransaction.points), 0))
            .filter(
                PointsTransaction.business_id == business_id,
                PointsTransaction.transaction_type == PointsTransactionType.EARN,
                PointsTransaction.deleted_at.is_(None),
            )
            .scalar()
        )

        # Points redeemed (sum of redeem transactions, stored as negative)
        total_points_redeemed = abs(
            self.db.query(func.coalesce(func.sum(PointsTransaction.points), 0))
            .filter(
                PointsTransaction.business_id == business_id,
                PointsTransaction.transaction_type == PointsTransactionType.REDEEM,
                PointsTransaction.deleted_at.is_(None),
            )
            .scalar()
        )

        # Outstanding points
        total_points_outstanding = (
            self.db.query(func.coalesce(func.sum(CustomerLoyalty.points_balance), 0))
            .filter(
                CustomerLoyalty.business_id == business_id,
                CustomerLoyalty.deleted_at.is_(None),
            )
            .scalar()
        )

        # Members by tier
        tier_counts = {}
        for tier in LoyaltyTier:
            count = base_query.filter(CustomerLoyalty.tier == tier).count()
            tier_counts[tier.value] = count

        return {
            "total_members": total_members,
            "active_members": active_members,
            "total_points_issued": int(total_points_issued),
            "total_points_redeemed": int(total_points_redeemed),
            "total_points_outstanding": int(total_points_outstanding),
            "members_by_tier": tier_counts,
        }

    def get_members(
        self,
        business_id: str,
        page: int = 1,
        per_page: int = 20,
        tier: Optional[LoyaltyTier] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[CustomerLoyalty], int]:
        """List loyalty members with pagination and filtering."""
        query = self.db.query(CustomerLoyalty).filter(
            CustomerLoyalty.business_id == business_id,
            CustomerLoyalty.deleted_at.is_(None),
        )

        if tier:
            query = query.filter(CustomerLoyalty.tier == tier)

        total = query.count()

        members = (
            query.order_by(CustomerLoyalty.lifetime_points.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        return members, total
