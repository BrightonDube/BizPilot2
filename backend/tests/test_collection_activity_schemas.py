"""Tests for collection activity schemas."""

import pytest
from decimal import Decimal
from datetime import date, datetime
from uuid import uuid4
from pydantic import ValidationError

from app.schemas.customer_account import (
    ActivityCreate,
    ActivityResponse,
    ActivityListResponse,
)
from app.models.customer_account import ActivityType


class TestActivityCreate:
    """Tests for ActivityCreate schema."""

    def test_valid_activity_without_promise(self):
        """Test creating activity without promise."""
        data = {
            "activity_type": ActivityType.PHONE_CALL,
            "notes": "Called customer about overdue payment",
            "outcome": "no_answer"
        }
        activity = ActivityCreate(**data)
        assert activity.activity_type == ActivityType.PHONE_CALL
        assert activity.notes == "Called customer about overdue payment"
        assert activity.outcome == "no_answer"
        assert activity.promise_date is None
        assert activity.promise_amount is None

    def test_valid_activity_with_promise(self):
        """Test creating activity with payment promise."""
        data = {
            "activity_type": ActivityType.PROMISE,
            "notes": "Customer promised to pay",
            "outcome": "promise_made",
            "promise_date": date(2025, 2, 1),
            "promise_amount": Decimal("500.00")
        }
        activity = ActivityCreate(**data)
        assert activity.activity_type == ActivityType.PROMISE
        assert activity.promise_date == date(2025, 2, 1)
        assert activity.promise_amount == Decimal("500.00")

    def test_promise_amount_without_date_fails(self):
        """Test that promise_amount without promise_date raises validation error."""
        data = {
            "activity_type": ActivityType.PROMISE,
            "notes": "Customer promised to pay",
            "promise_amount": Decimal("500.00")
            # Missing promise_date
        }
        with pytest.raises(ValidationError) as exc_info:
            ActivityCreate(**data)
        
        errors = exc_info.value.errors()
        assert any("promise_date is required" in str(error) for error in errors)

    def test_negative_promise_amount_fails(self):
        """Test that negative promise amount fails validation."""
        data = {
            "activity_type": ActivityType.PROMISE,
            "notes": "Test",
            "promise_date": date(2025, 2, 1),
            "promise_amount": Decimal("-100.00")
        }
        with pytest.raises(ValidationError) as exc_info:
            ActivityCreate(**data)
        
        errors = exc_info.value.errors()
        assert any("greater than 0" in str(error).lower() for error in errors)

    def test_zero_promise_amount_fails(self):
        """Test that zero promise amount fails validation."""
        data = {
            "activity_type": ActivityType.PROMISE,
            "notes": "Test",
            "promise_date": date(2025, 2, 1),
            "promise_amount": Decimal("0.00")
        }
        with pytest.raises(ValidationError) as exc_info:
            ActivityCreate(**data)
        
        errors = exc_info.value.errors()
        assert any("greater than 0" in str(error).lower() for error in errors)

    def test_all_activity_types(self):
        """Test all activity types are valid."""
        for activity_type in ActivityType:
            data = {
                "activity_type": activity_type,
                "notes": f"Test {activity_type.value}",
            }
            activity = ActivityCreate(**data)
            assert activity.activity_type == activity_type


class TestActivityResponse:
    """Tests for ActivityResponse schema."""

    def test_activity_response_structure(self):
        """Test ActivityResponse has all required fields."""
        data = {
            "id": uuid4(),
            "account_id": uuid4(),
            "activity_type": ActivityType.EMAIL,
            "notes": "Sent payment reminder",
            "outcome": "email_sent",
            "promise_date": None,
            "promise_amount": None,
            "performed_by": uuid4(),
            "created_at": datetime.now(),
            "has_promise": False
        }
        response = ActivityResponse(**data)
        assert response.id == data["id"]
        assert response.account_id == data["account_id"]
        assert response.activity_type == ActivityType.EMAIL
        assert response.has_promise is False

    def test_activity_response_with_promise(self):
        """Test ActivityResponse with promise data."""
        data = {
            "id": uuid4(),
            "account_id": uuid4(),
            "activity_type": ActivityType.PROMISE,
            "notes": "Customer promised payment",
            "outcome": "promise_made",
            "promise_date": date(2025, 2, 15),
            "promise_amount": Decimal("1000.00"),
            "performed_by": uuid4(),
            "created_at": datetime.now(),
            "has_promise": True
        }
        response = ActivityResponse(**data)
        assert response.promise_date == date(2025, 2, 15)
        assert response.promise_amount == Decimal("1000.00")
        assert response.has_promise is True


class TestActivityListResponse:
    """Tests for ActivityListResponse schema."""

    def test_empty_list(self):
        """Test empty activity list."""
        data = {
            "items": [],
            "total": 0,
            "page": 1,
            "per_page": 20,
            "pages": 0
        }
        response = ActivityListResponse(**data)
        assert len(response.items) == 0
        assert response.total == 0
        assert response.pages == 0

    def test_paginated_list(self):
        """Test paginated activity list."""
        activities = [
            {
                "id": uuid4(),
                "account_id": uuid4(),
                "activity_type": ActivityType.PHONE_CALL,
                "notes": f"Activity {i}",
                "outcome": "completed",
                "promise_date": None,
                "promise_amount": None,
                "performed_by": uuid4(),
                "created_at": datetime.now(),
                "has_promise": False
            }
            for i in range(5)
        ]
        
        data = {
            "items": activities,
            "total": 25,
            "page": 1,
            "per_page": 5,
            "pages": 5
        }
        response = ActivityListResponse(**data)
        assert len(response.items) == 5
        assert response.total == 25
        assert response.pages == 5
        assert all(isinstance(item, ActivityResponse) for item in response.items)


class TestActivityTypeEnum:
    """Tests for ActivityType enum usage in schemas."""

    def test_all_activity_types_valid(self):
        """Test that all ActivityType enum values work in schemas."""
        activity_types = [
            ActivityType.PHONE_CALL,
            ActivityType.EMAIL,
            ActivityType.LETTER,
            ActivityType.VISIT,
            ActivityType.PROMISE,
            ActivityType.NOTE
        ]
        
        for activity_type in activity_types:
            data = {
                "activity_type": activity_type,
                "notes": f"Test {activity_type.value}"
            }
            activity = ActivityCreate(**data)
            assert activity.activity_type == activity_type

    def test_invalid_activity_type_fails(self):
        """Test that invalid activity type fails validation."""
        data = {
            "activity_type": "invalid_type",
            "notes": "Test"
        }
        with pytest.raises(ValidationError):
            ActivityCreate(**data)
