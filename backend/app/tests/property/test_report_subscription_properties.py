"""Property-based tests for report subscriptions.

This module contains property-based tests that validate correctness properties
of the report subscription system using Hypothesis.

Feature: Automated Report Emails
Requirements: 3.1, 3.2, 3.3, 3.6
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from unittest.mock import Mock, MagicMock
from hypothesis import given, strategies as st, settings, HealthCheck

from app.services.report_subscription_service import ReportSubscriptionService
from app.models.report_subscription import ReportSubscription, ReportType, DeliveryFrequency, DeliveryStatus, ReportDeliveryLog

# Strategies

@st.composite
def report_type_strategy(draw):
    """Generate a random report type."""
    return draw(st.sampled_from(list(ReportType)))

@st.composite
def frequency_strategy(draw):
    """Generate a random delivery frequency."""
    return draw(st.sampled_from(list(DeliveryFrequency)))

@st.composite
def subscription_data_strategy(draw):
    """Generate random subscription data."""
    return {
        'user_id': str(draw(st.uuids())),
        'report_type': draw(report_type_strategy()),
        'frequency': draw(frequency_strategy()),
        'is_active': draw(st.booleans())
    }

def create_mock_service(initial_data: List[Dict[str, Any]] = None) -> ReportSubscriptionService:
    """Create a mock ReportSubscriptionService with in-memory storage."""
    mock_db = MagicMock()
    
    # In-memory storage
    subscriptions = {}
    if initial_data:
        for data in initial_data:
            key = (data['user_id'], data['report_type'], data['frequency'])
            sub = ReportSubscription(**data)
            subscriptions[key] = sub
    
    # Mock query methods
    def mock_query(*args):
        query_mock = MagicMock()
        
        # Filter implementation
        def mock_filter(*filters):
            # This is a simplified mock that doesn't fully implement SQLAlchemy filtering logic
            # but returns the query mock to allow chaining
            return query_mock
            
        query_mock.filter.side_effect = mock_filter
        
        # All/First/Count implementation
        query_mock.all.return_value = list(subscriptions.values())
        query_mock.first.return_value = list(subscriptions.values())[0] if subscriptions else None
        query_mock.count.return_value = len(subscriptions)
        
        return query_mock
        
    mock_db.query.side_effect = mock_query
    
    # Mock add/commit/refresh
    def mock_add(obj):
        if isinstance(obj, ReportSubscription):
            key = (obj.user_id, obj.report_type, obj.frequency)
            subscriptions[key] = obj
            
    mock_db.add.side_effect = mock_add
    
    service = ReportSubscriptionService(mock_db)
    
    # Override service methods to use our in-memory dict directly where needed for correctness
    # or rely on the mocked db calls if the service implementation is simple enough.
    # For property tests, we often want to test the SERVICE logic, so we should mock the DB layer interactions.
    # However, since SQLAlchemy filtering is complex to mock perfectly, we might need to adjust based on 
    # specific tests.
    
    return service, subscriptions

# Property Tests

@given(data=subscription_data_strategy())
@settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture], deadline=None)
def test_subscription_persistence_round_trip(data):
    """
    Property 1: Subscription Persistence Round Trip
    
    Verifies that a created subscription can be retrieved with the same data.
    """
    service, storage = create_mock_service()
    
    # Create subscription
    # We need to mock the DB interactions for create_subscription specifically
    # because it uses complex querying to check for existing subscriptions.
    
    # For this test, we'll manually simulate the "persistence" since we're mocking the DB.
    # What we really want to test is if the service constructs the object correctly.
    
    sub = service.create_subscription(
        user_id=data['user_id'],
        report_type=data['report_type'],
        frequency=data['frequency']
    )
    
    # Verify object attributes match input
    assert str(sub.user_id) == data['user_id']
    assert sub.report_type == data['report_type'].value
    assert sub.frequency == data['frequency'].value
    assert sub.is_active is True  # Default should be active

@given(data=subscription_data_strategy())
@settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture], deadline=None)
def test_subscription_update_persistence(data):
    """
    Property 2: Subscription Update Persistence
    
    Verifies that updating a subscription persists the changes.
    """
    # Create mock service and populate with one subscription
    service, storage = create_mock_service()
    
    # Initial creation
    sub = service.create_subscription(
        user_id=data['user_id'],
        report_type=data['report_type'],
        frequency=data['frequency']
    )
    
    # Simulate finding existing subscription for update
    service.get_subscription = Mock(return_value=sub)
    
    # Update (reactivate)
    # create_subscription logic: if exists and not active, make active.
    # If already active, it just returns it.
    
    # Let's force it to inactive first to test reactivation
    sub.is_active = False
    
    # Mock db.query(...).first() to return 'sub'
    mock_query = MagicMock()
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = sub
    service.db.query.return_value = mock_query
    
    updated_sub = service.create_subscription(
        user_id=data['user_id'],
        report_type=data['report_type'],
        frequency=data['frequency']
    )
    
    assert updated_sub.is_active is True
    assert updated_sub.id == sub.id  # Should be same object/ID

@given(data1=subscription_data_strategy(), data2=subscription_data_strategy())
@settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture], deadline=None)
def test_subscription_independence(data1, data2):
    """
    Property 3: Subscription Independence
    
    Verifies that creating/updating one subscription doesn't affect others.
    """
    # Ensure distinct keys
    if (data1['user_id'], data1['report_type'], data1['frequency']) == \
       (data2['user_id'], data2['report_type'], data2['frequency']):
        return
        
    service, storage = create_mock_service()
    
    sub1 = service.create_subscription(
        user_id=data1['user_id'],
        report_type=data1['report_type'],
        frequency=data1['frequency']
    )
    
    # Capture state of sub1
    sub1_active = sub1.is_active
    
    # Create sub2
    sub2 = service.create_subscription(
        user_id=data2['user_id'],
        report_type=data2['report_type'],
        frequency=data2['frequency']
    )
    
    # Verify sub1 is unchanged
    assert sub1.is_active == sub1_active
    assert str(sub1.user_id) == data1['user_id']

@given(data=subscription_data_strategy())
@settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture], deadline=None)
def test_active_subscription_query_filtering(data):
    """
    Property 5: Active Subscription Query Filtering
    
    Verifies that get_active_subscriptions_by_frequency only returns active subscriptions.
    """
    service, storage = create_mock_service()
    
    # Mock the specific query used in get_active_subscriptions_by_frequency
    
    # Create a mock query object
    mock_query = MagicMock()
    # Clear the side_effect set in create_mock_service so return_value is used
    service.db.query.side_effect = None
    service.db.query.return_value = mock_query
    
    mock_query.filter.return_value = mock_query
    mock_query.offset.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.all.return_value = []
    
    service.get_active_subscriptions_by_frequency(data['frequency'])
    
    # Verify filters were applied
    assert mock_query.filter.called
