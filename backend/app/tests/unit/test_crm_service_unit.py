"""
Unit tests for CRM core customer service logic.

Tests customer stats computation, segmentation rule evaluation,
and search functionality.

Why unit tests for CRM?
Customer segmentation drives marketing spend. Incorrect segment membership
could target wrong customers with promotions. We need exact scenario tests
to complement the property-based invariant tests.
"""

from datetime import datetime
from decimal import Decimal
from uuid import uuid4



# ---------------------------------------------------------------------------
# Helpers — customer and order builders
# ---------------------------------------------------------------------------

def make_customer(
    customer_id=None,
    name="Test Customer",
    email="test@example.com",
    phone="+27820001234",
    customer_type="regular",
    tags=None,
):
    return {
        "id": customer_id or str(uuid4()),
        "name": name,
        "email": email,
        "phone": phone,
        "type": customer_type,
        "tags": tags or [],
    }


def make_customer_order(
    customer_id=None,
    total=Decimal("0"),
    status="completed",
    created_at=None,
):
    return {
        "id": str(uuid4()),
        "customer_id": customer_id or str(uuid4()),
        "total": total,
        "status": status,
        "created_at": created_at or datetime(2024, 1, 15, 12, 0),
    }


# ---------------------------------------------------------------------------
# Stats calculation
# ---------------------------------------------------------------------------

def compute_customer_stats(customer_id, orders):
    """
    Compute customer stats from their order history.
    Returns dict with visit_count, total_spent, avg_order_value, last_visit.
    """
    completed = [o for o in orders if o["customer_id"] == customer_id and o["status"] == "completed"]
    visit_count = len(completed)
    total_spent = sum(o["total"] for o in completed)
    avg_order_value = (total_spent / visit_count).quantize(Decimal("0.01")) if visit_count > 0 else Decimal("0")
    last_visit = max((o["created_at"] for o in completed), default=None)

    return {
        "visit_count": visit_count,
        "total_spent": total_spent,
        "avg_order_value": avg_order_value,
        "last_visit": last_visit,
    }


# ---------------------------------------------------------------------------
# Segment rule evaluation
# ---------------------------------------------------------------------------

def evaluate_segment_rule(stats, rule):
    """
    Evaluate a single segment rule against customer stats.
    Rule = {"field": ..., "operator": ..., "value": ...}
    Returns True if the customer satisfies the rule.
    """
    field_value = stats.get(rule["field"])
    if field_value is None:
        return False

    op = rule["operator"]
    target = rule["value"]

    if op == "gt":
        return field_value > target
    elif op == "lt":
        return field_value < target
    elif op == "eq":
        return field_value == target
    elif op == "gte":
        return field_value >= target
    elif op == "lte":
        return field_value <= target
    elif op == "between":
        # target should be [low, high]
        return target[0] <= field_value <= target[1]
    else:
        return False


def evaluate_segment(stats, rules):
    """Customer is in segment iff ALL rules are satisfied."""
    return all(evaluate_segment_rule(stats, rule) for rule in rules)


# ---------------------------------------------------------------------------
# Customer stats tests
# ---------------------------------------------------------------------------

class TestCustomerStats:
    """Tests for customer statistics computation."""

    def test_visit_count(self):
        """Visit count = number of completed orders."""
        cid = str(uuid4())
        orders = [
            make_customer_order(customer_id=cid, total=Decimal("100")),
            make_customer_order(customer_id=cid, total=Decimal("200")),
            make_customer_order(customer_id=cid, total=Decimal("50")),
        ]
        stats = compute_customer_stats(cid, orders)
        assert stats["visit_count"] == 3

    def test_visit_count_excludes_cancelled(self):
        """Cancelled orders should not count as visits."""
        cid = str(uuid4())
        orders = [
            make_customer_order(customer_id=cid, total=Decimal("100"), status="completed"),
            make_customer_order(customer_id=cid, total=Decimal("200"), status="cancelled"),
        ]
        stats = compute_customer_stats(cid, orders)
        assert stats["visit_count"] == 1

    def test_total_spent(self):
        """Total spent = sum of completed order totals."""
        cid = str(uuid4())
        orders = [
            make_customer_order(customer_id=cid, total=Decimal("100.50")),
            make_customer_order(customer_id=cid, total=Decimal("200.75")),
        ]
        stats = compute_customer_stats(cid, orders)
        assert stats["total_spent"] == Decimal("301.25")

    def test_avg_order_value(self):
        """Average = total_spent / visit_count."""
        cid = str(uuid4())
        orders = [
            make_customer_order(customer_id=cid, total=Decimal("100")),
            make_customer_order(customer_id=cid, total=Decimal("200")),
        ]
        stats = compute_customer_stats(cid, orders)
        assert stats["avg_order_value"] == Decimal("150.00")

    def test_no_orders_returns_zeros(self):
        """Customer with no orders gets zero stats."""
        cid = str(uuid4())
        stats = compute_customer_stats(cid, [])
        assert stats["visit_count"] == 0
        assert stats["total_spent"] == Decimal("0")
        assert stats["avg_order_value"] == Decimal("0")
        assert stats["last_visit"] is None

    def test_last_visit_is_most_recent(self):
        """Last visit should be the most recent completed order."""
        cid = str(uuid4())
        early = datetime(2024, 1, 10)
        late = datetime(2024, 1, 20)
        orders = [
            make_customer_order(customer_id=cid, total=Decimal("100"), created_at=early),
            make_customer_order(customer_id=cid, total=Decimal("200"), created_at=late),
        ]
        stats = compute_customer_stats(cid, orders)
        assert stats["last_visit"] == late

    def test_other_customer_orders_excluded(self):
        """Stats should only include orders for the specific customer."""
        cid = str(uuid4())
        other = str(uuid4())
        orders = [
            make_customer_order(customer_id=cid, total=Decimal("100")),
            make_customer_order(customer_id=other, total=Decimal("9999")),
        ]
        stats = compute_customer_stats(cid, orders)
        assert stats["total_spent"] == Decimal("100")


# ---------------------------------------------------------------------------
# Segment rule evaluation tests
# ---------------------------------------------------------------------------

class TestSegmentRuleEvaluation:
    """Tests for individual segment rule evaluation."""

    def test_gt_rule(self):
        stats = {"total_spent": Decimal("500")}
        rule = {"field": "total_spent", "operator": "gt", "value": Decimal("200")}
        assert evaluate_segment_rule(stats, rule) is True

    def test_gt_rule_fails(self):
        stats = {"total_spent": Decimal("100")}
        rule = {"field": "total_spent", "operator": "gt", "value": Decimal("200")}
        assert evaluate_segment_rule(stats, rule) is False

    def test_lt_rule(self):
        stats = {"visit_count": 2}
        rule = {"field": "visit_count", "operator": "lt", "value": 5}
        assert evaluate_segment_rule(stats, rule) is True

    def test_eq_rule(self):
        stats = {"visit_count": 10}
        rule = {"field": "visit_count", "operator": "eq", "value": 10}
        assert evaluate_segment_rule(stats, rule) is True

    def test_between_rule(self):
        stats = {"total_spent": Decimal("500")}
        rule = {"field": "total_spent", "operator": "between", "value": [Decimal("100"), Decimal("1000")]}
        assert evaluate_segment_rule(stats, rule) is True

    def test_between_rule_out_of_range(self):
        stats = {"total_spent": Decimal("1500")}
        rule = {"field": "total_spent", "operator": "between", "value": [Decimal("100"), Decimal("1000")]}
        assert evaluate_segment_rule(stats, rule) is False

    def test_missing_field(self):
        """Rule referencing missing field should return False."""
        stats = {"total_spent": Decimal("500")}
        rule = {"field": "lifetime_value", "operator": "gt", "value": Decimal("100")}
        assert evaluate_segment_rule(stats, rule) is False


# ---------------------------------------------------------------------------
# Full segment evaluation tests
# ---------------------------------------------------------------------------

class TestSegmentEvaluation:
    """Tests for multi-rule segment membership."""

    def test_all_rules_satisfied(self):
        """Customer satisfying all rules is in the segment."""
        stats = {"total_spent": Decimal("1000"), "visit_count": 10}
        rules = [
            {"field": "total_spent", "operator": "gt", "value": Decimal("500")},
            {"field": "visit_count", "operator": "gte", "value": 5},
        ]
        assert evaluate_segment(stats, rules) is True

    def test_one_rule_fails(self):
        """Customer failing any rule is NOT in the segment."""
        stats = {"total_spent": Decimal("200"), "visit_count": 10}
        rules = [
            {"field": "total_spent", "operator": "gt", "value": Decimal("500")},
            {"field": "visit_count", "operator": "gte", "value": 5},
        ]
        assert evaluate_segment(stats, rules) is False

    def test_empty_rules(self):
        """Segment with no rules matches everyone (vacuous truth)."""
        stats = {"total_spent": Decimal("0")}
        assert evaluate_segment(stats, []) is True

    def test_vip_segment(self):
        """VIP: spent > 5000 AND visits > 20."""
        stats = {"total_spent": Decimal("7500"), "visit_count": 25}
        vip_rules = [
            {"field": "total_spent", "operator": "gt", "value": Decimal("5000")},
            {"field": "visit_count", "operator": "gt", "value": 20},
        ]
        assert evaluate_segment(stats, vip_rules) is True

    def test_new_customer_segment(self):
        """New customer: visits <= 2."""
        stats = {"visit_count": 1}
        rules = [{"field": "visit_count", "operator": "lte", "value": 2}]
        assert evaluate_segment(stats, rules) is True
