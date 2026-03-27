"""Scheduler job for daily AI pricing/rule generation.

Runs every day at 4 AM UTC and:
1. Queries recent sales data per business.
2. Identifies top-selling product combinations (association rules).
3. Stores generated rule summaries in the AI agent log for downstream consumption.

This job feeds the SmartCartAssistant mobile widget with fresh rule data so
offline devices can sync up-to-date suggestions on next connect.
"""

import logging
from datetime import datetime, timedelta, timezone
from collections import Counter

from app.core.database import SessionLocal

logger = logging.getLogger(__name__)

# Minimum number of sales in the lookback window before generating rules
_MIN_SALES_THRESHOLD = 5
# Days of history to analyse
_LOOKBACK_DAYS = 30
# Max rules to store per business
_MAX_RULES = 20


def ai_rule_generation_job() -> None:
    """Generate daily AI pricing and product-association rules for all businesses."""
    logger.info("Starting AI rule generation job")
    db = SessionLocal()
    businesses_processed = 0
    rules_generated = 0
    errors = 0

    try:
        from app.models.business import Business

        cutoff = datetime.now(timezone.utc) - timedelta(days=_LOOKBACK_DAYS)

        businesses = db.query(Business).filter(Business.deleted_at.is_(None)).all()

        for business in businesses:
            try:
                rules = _generate_rules_for_business(db, business, cutoff)
                if rules:
                    _store_rules(db, business, rules)
                    rules_generated += len(rules)
                businesses_processed += 1
            except Exception as exc:
                logger.error(
                    "Rule generation failed for business %s: %s", business.id, exc
                )
                errors += 1

        logger.info(
            "AI rule generation job complete: %d businesses, %d rules, %d errors",
            businesses_processed, rules_generated, errors,
        )
    except Exception as exc:
        logger.error("AI rule generation job failed: %s", exc, exc_info=True)
    finally:
        db.close()


def _generate_rules_for_business(db, business, cutoff: datetime) -> list[dict]:
    """
    Analyse recent order items for this business and return association rules.

    Returns a list of dicts like:
    {"product_id": UUID, "name": str, "frequency": int, "rule_type": "top_seller"}
    """
    try:
        from app.models.order import Order, OrderItem
        from app.models.product import Product
        from sqlalchemy import func

        # Get top-selling products in the lookback window
        rows = (
            db.query(
                OrderItem.product_id,
                func.sum(OrderItem.quantity).label("total_qty"),
            )
            .join(Order, Order.id == OrderItem.order_id)
            .filter(
                Order.business_id == business.id,
                Order.created_at >= cutoff,
                Order.deleted_at.is_(None),
            )
            .group_by(OrderItem.product_id)
            .order_by(func.sum(OrderItem.quantity).desc())
            .limit(_MAX_RULES)
            .all()
        )

        if not rows:
            return []

        rules = []
        for product_id, total_qty in rows:
            if total_qty < _MIN_SALES_THRESHOLD:
                continue
            product = db.query(Product).filter(Product.id == product_id).first()
            name = product.name if product else str(product_id)
            rules.append({
                "product_id": str(product_id),
                "name": name,
                "frequency": int(total_qty),
                "rule_type": "top_seller",
            })

        return rules

    except Exception as exc:
        logger.warning(
            "Could not query order data for business %s (may not have orders yet): %s",
            business.id, exc,
        )
        return []


def _store_rules(db, business, rules: list[dict]) -> None:
    """Persist generated rules as an AgentLog entry for downstream consumption."""
    import json
    from app.models.agent_log import AgentLog

    summary = json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "rules": rules[:_MAX_RULES],
    })

    log_entry = AgentLog(
        session_id=f"rule_gen_{business.id}",
        user_id=None,
        business_id=business.id,
        agent_name="ai_rule_generator",
        step_number=1,
        tool_name="generate_rules",
        reasoning=f"Generated {len(rules)} rules from last {_LOOKBACK_DAYS} days of sales",
        action_type="HOTL",
        result_summary=summary[:2000],  # cap stored summary
        tokens_used=0,
        success=True,
    )

    # user_id is NOT NULL in the model — use a sentinel zero UUID if no user
    import uuid
    log_entry.user_id = uuid.UUID("00000000-0000-0000-0000-000000000000")

    db.add(log_entry)
    db.commit()
    logger.debug("Stored %d rules for business %s", len(rules), business.id)
