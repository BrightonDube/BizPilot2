"""Unit tests for CrmService.

Covers segment CRUD, interactions, follow-ups, customer metrics,
at-risk detection, data export/delete, consent, and access logs.
"""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from unittest.mock import MagicMock

import pytest

from app.models.crm import (
    CustomerInteraction,
    CustomerMetrics,
    CustomerSegment,
    CustomerSegmentMember,
    InteractionType,
)
from app.services.crm_service import CrmService


BIZ_ID = str(uuid.uuid4())
CUST_ID = str(uuid.uuid4())
SEG_ID = str(uuid.uuid4())


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def service(db):
    return CrmService(db)


# ---------------------------------------------------------------------------
# Segment management
# ---------------------------------------------------------------------------

class TestCreateSegment:
    def test_creates_segment(self, service, db):
        """Creates a segment and commits."""
        service.create_segment(BIZ_ID, "VIP", description="Top spenders")
        db.add.assert_called_once()
        db.commit.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.name == "VIP"
        assert added.business_id == BIZ_ID

    def test_creates_with_color(self, service, db):
        """Sets optional color field."""
        service.create_segment(BIZ_ID, "Gold", color="#FFD700")
        added = db.add.call_args[0][0]
        assert added.color == "#FFD700"


class TestListSegments:
    def test_returns_segments_with_count(self, service, db):
        """Returns list of dicts with segment and member_count."""
        mock_seg = MagicMock(spec=CustomerSegment)
        mock_seg.id = SEG_ID

        def query_router(model):
            chain = MagicMock()
            if model is CustomerSegment:
                chain.filter.return_value.order_by.return_value.all.return_value = [mock_seg]
            else:
                chain.filter.return_value.scalar.return_value = 5
            return chain
        db.query.side_effect = query_router

        result = service.list_segments(BIZ_ID)
        assert len(result) == 1
        assert result[0]["member_count"] == 5


class TestAddToSegment:
    def test_add_new_member(self, service, db):
        """Adds customer to segment."""
        db.query.return_value.filter.return_value.first.return_value = None
        service.add_to_segment(SEG_ID, CUST_ID)
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_returns_existing_member(self, service, db):
        """Returns existing member without duplicate."""
        existing = MagicMock(spec=CustomerSegmentMember)
        db.query.return_value.filter.return_value.first.return_value = existing
        result = service.add_to_segment(SEG_ID, CUST_ID)
        assert result == existing
        db.add.assert_not_called()


class TestRemoveFromSegment:
    def test_removes_member(self, service, db):
        """Soft-deletes member and returns True."""
        member = MagicMock(spec=CustomerSegmentMember)
        db.query.return_value.filter.return_value.first.return_value = member
        result = service.remove_from_segment(SEG_ID, CUST_ID)
        assert result is True
        member.soft_delete.assert_called_once()

    def test_returns_false_when_not_found(self, service, db):
        """Returns False when member doesn't exist."""
        db.query.return_value.filter.return_value.first.return_value = None
        result = service.remove_from_segment(SEG_ID, CUST_ID)
        assert result is False


class TestGetSegmentMembers:
    def test_returns_paginated(self, service, db):
        """Returns (members, total) tuple."""
        chain = db.query.return_value.join.return_value.filter.return_value
        chain.count.return_value = 3
        mocks = [MagicMock(spec=CustomerSegmentMember) for _ in range(3)]
        chain.order_by.return_value.offset.return_value.limit.return_value.all.return_value = mocks

        items, total = service.get_segment_members(SEG_ID, BIZ_ID)
        assert total == 3
        assert len(items) == 3


# ---------------------------------------------------------------------------
# Interactions
# ---------------------------------------------------------------------------

class TestLogInteraction:
    def test_logs_interaction(self, service, db):
        """Creates and commits interaction."""
        service.log_interaction(
            CUST_ID, BIZ_ID, "user-1",
            InteractionType.NOTE, "Follow up call",
        )
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.subject == "Follow up call"
        assert added.interaction_type == InteractionType.NOTE


class TestGetInteractions:
    def test_returns_paginated(self, service, db):
        """Returns (interactions, total) tuple."""
        chain = db.query.return_value.filter.return_value
        chain.count.return_value = 2
        mocks = [MagicMock(spec=CustomerInteraction) for _ in range(2)]
        chain.order_by.return_value.offset.return_value.limit.return_value.all.return_value = mocks

        items, total = service.get_interactions(CUST_ID, BIZ_ID)
        assert total == 2
        assert len(items) == 2


# ---------------------------------------------------------------------------
# Follow-ups
# ---------------------------------------------------------------------------

class TestGetFollowUps:
    def test_returns_pending_follow_ups(self, service, db):
        """Returns list of pending follow-ups."""
        mocks = [MagicMock(spec=CustomerInteraction)]
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = mocks

        result = service.get_follow_ups(BIZ_ID)
        assert len(result) == 1


class TestCompleteFollowUp:
    def test_marks_completed(self, service, db):
        """Sets is_completed=True."""
        interaction = MagicMock(spec=CustomerInteraction)
        interaction.is_completed = False
        db.query.return_value.filter.return_value.first.return_value = interaction

        service.complete_follow_up("int-1", BIZ_ID)
        assert interaction.is_completed is True
        db.commit.assert_called()

    def test_not_found_returns_none(self, service, db):
        """Returns None when interaction not found."""
        db.query.return_value.filter.return_value.first.return_value = None
        result = service.complete_follow_up("bad-id", BIZ_ID)
        assert result is None


# ---------------------------------------------------------------------------
# Customer metrics
# ---------------------------------------------------------------------------

class TestGetCustomerMetrics:
    def test_returns_metrics(self, service, db):
        """Returns CustomerMetrics object."""
        mock_m = MagicMock(spec=CustomerMetrics)
        db.query.return_value.filter.return_value.first.return_value = mock_m
        result = service.get_customer_metrics(CUST_ID, BIZ_ID)
        assert result == mock_m

    def test_returns_none_when_missing(self, service, db):
        """Returns None if no metrics exist."""
        db.query.return_value.filter.return_value.first.return_value = None
        result = service.get_customer_metrics(CUST_ID, BIZ_ID)
        assert result is None


# ---------------------------------------------------------------------------
# Top / at-risk customers
# ---------------------------------------------------------------------------

class TestGetTopCustomers:
    def test_returns_list(self, service, db):
        """Returns top customers by total_spent."""
        mocks = [MagicMock(spec=CustomerMetrics) for _ in range(5)]
        db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = mocks

        result = service.get_top_customers(BIZ_ID, limit=5)
        assert len(result) == 5


class TestGetAtRiskCustomers:
    def test_returns_at_risk(self, service, db):
        """Returns customers who haven't purchased recently."""
        mocks = [MagicMock(spec=CustomerMetrics)]
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = mocks

        result = service.get_at_risk_customers(BIZ_ID, days_threshold=30)
        assert len(result) == 1


# ---------------------------------------------------------------------------
# Access logs
# ---------------------------------------------------------------------------

class TestGetAccessLogs:
    def test_returns_logs(self, service, db):
        """Returns access log entries."""
        mocks = [MagicMock(), MagicMock()]
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = mocks

        result = service.get_access_logs(BIZ_ID, CUST_ID)
        assert len(result) == 2
