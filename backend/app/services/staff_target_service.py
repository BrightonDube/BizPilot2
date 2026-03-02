"""Staff targets and performance service."""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.staff_target import (
    CommissionRule,
    CommissionTier,
    CommissionDetail,
    IncentiveAchievement,
    IncentiveProgram,
    PerformanceSnapshot,
    StaffCommission,
    StaffTarget,
    TargetTemplate,
)


class StaffTargetService:
    """Service for staff targets, commissions, and performance."""

    def __init__(self, db: Session):
        self.db = db

    # ── Targets ──────────────────────────────────────────────────────────

    def create_target(
        self,
        business_id: str,
        target_type: str,
        period_type: str,
        period_start: date,
        period_end: date,
        target_value: Decimal,
        user_id: Optional[str] = None,
        team_id: Optional[str] = None,
    ) -> StaffTarget:
        target = StaffTarget(
            business_id=business_id,
            user_id=user_id,
            team_id=team_id,
            target_type=target_type,
            period_type=period_type,
            period_start=period_start,
            period_end=period_end,
            target_value=target_value,
            achieved_value=Decimal("0.00"),
            status="active",
        )
        self.db.add(target)
        self.db.commit()
        self.db.refresh(target)
        return target

    def list_targets(
        self,
        business_id: str,
        user_id: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> tuple[list[StaffTarget], int]:
        query = self.db.query(StaffTarget).filter(
            StaffTarget.business_id == business_id,
            StaffTarget.deleted_at.is_(None),
        )
        if user_id:
            query = query.filter(StaffTarget.user_id == user_id)
        if status:
            query = query.filter(StaffTarget.status == status)
        total = query.count()
        items = (
            query.order_by(StaffTarget.period_start.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_target(self, target_id: str, business_id: str) -> Optional[StaffTarget]:
        return self.db.query(StaffTarget).filter(
            StaffTarget.id == target_id,
            StaffTarget.business_id == business_id,
            StaffTarget.deleted_at.is_(None),
        ).first()

    def update_target(self, target_id: str, business_id: str, **kwargs: Any) -> Optional[StaffTarget]:
        target = self.get_target(target_id, business_id)
        if not target:
            return None
        for k, v in kwargs.items():
            if v is not None and hasattr(target, k):
                setattr(target, k, v)
        self.db.commit()
        self.db.refresh(target)
        return target

    def delete_target(self, target_id: str, business_id: str) -> bool:
        target = self.get_target(target_id, business_id)
        if not target:
            return False
        target.deleted_at = datetime.now(timezone.utc)
        self.db.commit()
        return True

    def get_progress(self, target_id: str, business_id: str) -> dict[str, Any]:
        """Get target progress with achievement percentage."""
        target = self.get_target(target_id, business_id)
        if not target:
            return {}
        pct = (
            float(target.achieved_value / target.target_value * 100)
            if target.target_value > 0
            else 0.0
        )
        return {
            "target_id": str(target.id),
            "target_type": target.target_type,
            "target_value": float(target.target_value),
            "achieved_value": float(target.achieved_value),
            "achievement_pct": round(pct, 1),
            "remaining": float(max(target.target_value - target.achieved_value, Decimal("0"))),
            "status": target.status,
            "period_start": target.period_start.isoformat(),
            "period_end": target.period_end.isoformat(),
        }

    # ── Templates ────────────────────────────────────────────────────────

    def create_template(
        self,
        business_id: str,
        name: str,
        target_type: str,
        period_type: str,
        default_value: Decimal,
        role_id: Optional[str] = None,
    ) -> TargetTemplate:
        tmpl = TargetTemplate(
            business_id=business_id,
            name=name,
            role_id=role_id,
            target_type=target_type,
            period_type=period_type,
            default_value=default_value,
            is_active=True,
        )
        self.db.add(tmpl)
        self.db.commit()
        self.db.refresh(tmpl)
        return tmpl

    def list_templates(self, business_id: str) -> list[TargetTemplate]:
        return (
            self.db.query(TargetTemplate)
            .filter(
                TargetTemplate.business_id == business_id,
                TargetTemplate.deleted_at.is_(None),
                TargetTemplate.is_active.is_(True),
            )
            .order_by(TargetTemplate.name)
            .all()
        )

    # ── Commission Rules ─────────────────────────────────────────────────

    def create_commission_rule(
        self,
        business_id: str,
        name: str,
        rule_type: str,
        rate: Decimal,
        min_threshold: Optional[Decimal] = None,
        max_threshold: Optional[Decimal] = None,
        cap_amount: Optional[Decimal] = None,
        product_category_id: Optional[str] = None,
        tiers: Optional[list[dict]] = None,
    ) -> CommissionRule:
        rule = CommissionRule(
            business_id=business_id,
            name=name,
            rule_type=rule_type,
            rate=rate,
            min_threshold=min_threshold,
            max_threshold=max_threshold,
            cap_amount=cap_amount,
            product_category_id=product_category_id,
            is_active=True,
        )
        self.db.add(rule)
        self.db.flush()

        if tiers and rule_type == "tiered":
            for idx, t in enumerate(tiers, 1):
                tier = CommissionTier(
                    rule_id=rule.id,
                    tier_order=idx,
                    min_value=Decimal(str(t["min_value"])),
                    max_value=Decimal(str(t["max_value"])) if t.get("max_value") else None,
                    rate=Decimal(str(t["rate"])),
                )
                self.db.add(tier)

        self.db.commit()
        self.db.refresh(rule)
        return rule

    def list_commission_rules(self, business_id: str) -> list[CommissionRule]:
        return (
            self.db.query(CommissionRule)
            .filter(
                CommissionRule.business_id == business_id,
                CommissionRule.deleted_at.is_(None),
            )
            .order_by(CommissionRule.name)
            .all()
        )

    def update_commission_rule(self, rule_id: str, business_id: str, **kwargs: Any) -> Optional[CommissionRule]:
        rule = self.db.query(CommissionRule).filter(
            CommissionRule.id == rule_id,
            CommissionRule.business_id == business_id,
            CommissionRule.deleted_at.is_(None),
        ).first()
        if not rule:
            return None
        for k, v in kwargs.items():
            if v is not None and hasattr(rule, k):
                setattr(rule, k, v)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def calculate_commission(
        self,
        business_id: str,
        user_id: str,
        total_sales: Decimal,
    ) -> Decimal:
        """Calculate commission for given sales amount using active rules."""
        rules = (
            self.db.query(CommissionRule)
            .filter(
                CommissionRule.business_id == business_id,
                CommissionRule.is_active.is_(True),
                CommissionRule.deleted_at.is_(None),
            )
            .all()
        )
        if not rules:
            return Decimal("0.00")

        total_commission = Decimal("0.00")
        for rule in rules:
            if rule.min_threshold and total_sales < rule.min_threshold:
                continue
            if rule.max_threshold and total_sales > rule.max_threshold:
                continue

            if rule.rule_type == "percentage":
                comm = total_sales * (rule.rate / Decimal("100"))
            elif rule.rule_type == "tiered":
                comm = self._calculate_tiered(rule, total_sales)
            elif rule.rule_type == "flat":
                comm = rule.rate
            else:
                comm = Decimal("0.00")

            if rule.cap_amount and comm > rule.cap_amount:
                comm = rule.cap_amount

            total_commission += comm

        return total_commission.quantize(Decimal("0.01"))

    def _calculate_tiered(self, rule: CommissionRule, sales: Decimal) -> Decimal:
        """Calculate commission using tiered rates."""
        tiers = sorted(rule.tiers, key=lambda t: t.tier_order)
        commission = Decimal("0.00")
        for tier in tiers:
            if sales <= tier.min_value:
                break
            upper = min(sales, tier.max_value) if tier.max_value else sales
            taxable = upper - tier.min_value
            commission += taxable * (tier.rate / Decimal("100"))
        return commission

    # ── Staff Commissions ────────────────────────────────────────────────

    def list_staff_commissions(
        self,
        business_id: str,
        user_id: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> tuple[list[StaffCommission], int]:
        query = self.db.query(StaffCommission).filter(
            StaffCommission.business_id == business_id,
            StaffCommission.deleted_at.is_(None),
        )
        if user_id:
            query = query.filter(StaffCommission.user_id == user_id)
        if status:
            query = query.filter(StaffCommission.status == status)
        total = query.count()
        items = (
            query.order_by(StaffCommission.period_start.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_commission_report(
        self,
        business_id: str,
        period_start: date,
        period_end: date,
    ) -> dict[str, Any]:
        """Commission summary report for a period."""
        row = self.db.query(
            func.count(StaffCommission.id).label("count"),
            func.coalesce(func.sum(StaffCommission.total_sales), 0).label("sales"),
            func.coalesce(func.sum(StaffCommission.commission_amount), 0).label("commission"),
        ).filter(
            StaffCommission.business_id == business_id,
            StaffCommission.period_start >= period_start,
            StaffCommission.period_end <= period_end,
            StaffCommission.deleted_at.is_(None),
        ).one()

        return {
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "total_commissions": int(row.count),
            "total_sales": float(row.sales),
            "total_commission_amount": float(row.commission),
        }

    # ── Incentive Programs ───────────────────────────────────────────────

    def create_incentive(
        self,
        business_id: str,
        name: str,
        incentive_type: str,
        target_type: str,
        target_value: Decimal,
        reward_type: str,
        reward_value: Decimal,
        start_date: date,
        end_date: date,
        description: Optional[str] = None,
        is_team: bool = False,
    ) -> IncentiveProgram:
        prog = IncentiveProgram(
            business_id=business_id,
            name=name,
            description=description,
            incentive_type=incentive_type,
            target_type=target_type,
            target_value=target_value,
            reward_type=reward_type,
            reward_value=reward_value,
            start_date=start_date,
            end_date=end_date,
            is_team=is_team,
            is_active=True,
        )
        self.db.add(prog)
        self.db.commit()
        self.db.refresh(prog)
        return prog

    def list_incentives(
        self,
        business_id: str,
        active_only: bool = True,
    ) -> list[IncentiveProgram]:
        query = self.db.query(IncentiveProgram).filter(
            IncentiveProgram.business_id == business_id,
            IncentiveProgram.deleted_at.is_(None),
        )
        if active_only:
            query = query.filter(IncentiveProgram.is_active.is_(True))
        return query.order_by(IncentiveProgram.start_date.desc()).all()

    def check_eligibility(
        self,
        incentive_id: str,
        user_id: str,
        business_id: str,
    ) -> dict[str, Any]:
        """Check if a staff member qualifies for an incentive."""
        program = self.db.query(IncentiveProgram).filter(
            IncentiveProgram.business_id == business_id,
            IncentiveProgram.deleted_at.is_(None),
        ).first()
        if not program:
            return {"eligible": False, "reason": "Program not found"}

        # Check if already achieved
        existing = self.db.query(IncentiveAchievement).filter(
            IncentiveAchievement.incentive_id == incentive_id,
            IncentiveAchievement.user_id == user_id,
        ).first()
        if existing:
            return {"eligible": False, "reason": "Already achieved", "achieved_at": str(existing.achieved_at)}

        # Get performance in program period
        snapshots = self.db.query(
            func.coalesce(func.sum(PerformanceSnapshot.total_sales), 0).label("sales"),
            func.coalesce(func.sum(PerformanceSnapshot.transaction_count), 0).label("txns"),
            func.coalesce(func.sum(PerformanceSnapshot.item_count), 0).label("items"),
        ).filter(
            PerformanceSnapshot.user_id == user_id,
            PerformanceSnapshot.business_id == business_id,
            PerformanceSnapshot.snapshot_date >= program.start_date,
            PerformanceSnapshot.snapshot_date <= program.end_date,
        ).one()

        metric_map = {
            "sales_amount": float(snapshots.sales),
            "transaction_count": int(snapshots.txns),
            "items_sold": int(snapshots.items),
        }
        achieved = metric_map.get(program.target_type, 0)
        target = float(program.target_value)
        pct = round(achieved / target * 100, 1) if target > 0 else 0

        return {
            "eligible": achieved >= target,
            "achieved_value": achieved,
            "target_value": target,
            "achievement_pct": pct,
            "program_name": program.name,
        }

    # ── Leaderboards ─────────────────────────────────────────────────────

    def get_leaderboard(
        self,
        business_id: str,
        metric: str = "sales",
        period_start: Optional[date] = None,
        period_end: Optional[date] = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Get staff leaderboard sorted by metric."""
        metric_col = {
            "sales": PerformanceSnapshot.total_sales,
            "transactions": PerformanceSnapshot.transaction_count,
            "items": PerformanceSnapshot.item_count,
            "customers": PerformanceSnapshot.customer_count,
        }.get(metric, PerformanceSnapshot.total_sales)

        query = self.db.query(
            PerformanceSnapshot.user_id,
            func.sum(metric_col).label("value"),
        ).filter(
            PerformanceSnapshot.business_id == business_id,
        )

        if period_start:
            query = query.filter(PerformanceSnapshot.snapshot_date >= period_start)
        if period_end:
            query = query.filter(PerformanceSnapshot.snapshot_date <= period_end)

        rows = (
            query.group_by(PerformanceSnapshot.user_id)
            .order_by(func.sum(metric_col).desc())
            .limit(limit)
            .all()
        )

        return [
            {"rank": idx, "user_id": str(r.user_id), "value": float(r.value)}
            for idx, r in enumerate(rows, 1)
        ]

    # ── Performance Snapshots ────────────────────────────────────────────

    def get_performance_summary(
        self,
        business_id: str,
        user_id: str,
        period_start: date,
        period_end: date,
    ) -> dict[str, Any]:
        """Aggregate performance for a staff member over a period."""
        row = self.db.query(
            func.coalesce(func.sum(PerformanceSnapshot.total_sales), 0).label("sales"),
            func.coalesce(func.sum(PerformanceSnapshot.transaction_count), 0).label("txns"),
            func.coalesce(func.sum(PerformanceSnapshot.item_count), 0).label("items"),
            func.coalesce(func.sum(PerformanceSnapshot.customer_count), 0).label("customers"),
            func.coalesce(func.avg(PerformanceSnapshot.avg_transaction), 0).label("avg_txn"),
            func.coalesce(func.sum(PerformanceSnapshot.hours_worked), 0).label("hours"),
            func.count(PerformanceSnapshot.id).label("days"),
        ).filter(
            PerformanceSnapshot.user_id == user_id,
            PerformanceSnapshot.business_id == business_id,
            PerformanceSnapshot.snapshot_date >= period_start,
            PerformanceSnapshot.snapshot_date <= period_end,
        ).one()

        return {
            "user_id": user_id,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "total_sales": float(row.sales),
            "transaction_count": int(row.txns),
            "item_count": int(row.items),
            "customer_count": int(row.customers),
            "avg_transaction": round(float(row.avg_txn), 2),
            "hours_worked": float(row.hours),
            "days_worked": int(row.days),
        }

    def get_performance_trends(
        self,
        business_id: str,
        user_id: str,
        period_start: date,
        period_end: date,
    ) -> list[dict[str, Any]]:
        """Get daily performance data points for trend analysis."""
        snapshots = (
            self.db.query(PerformanceSnapshot)
            .filter(
                PerformanceSnapshot.user_id == user_id,
                PerformanceSnapshot.business_id == business_id,
                PerformanceSnapshot.snapshot_date >= period_start,
                PerformanceSnapshot.snapshot_date <= period_end,
            )
            .order_by(PerformanceSnapshot.snapshot_date.asc())
            .all()
        )
        return [
            {
                "date": s.snapshot_date.isoformat(),
                "total_sales": float(s.total_sales),
                "transaction_count": s.transaction_count,
                "item_count": s.item_count,
                "customer_count": s.customer_count,
                "avg_transaction": float(s.avg_transaction),
            }
            for s in snapshots
        ]
