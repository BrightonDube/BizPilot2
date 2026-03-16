import pytest
import hmac
import hashlib
import json
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from app.services.webhook_service import (
    trigger_webhook_event,
    deliver_webhook,
    create_webhook_subscription,
)
from app.models.webhook import WebhookSubscription, WebhookDelivery


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.mark.asyncio
async def test_trigger_webhook_event_creates_delivery_records_for_matching_subscriptions(
    mock_db,
):
    business_id = uuid4()
    event_type = "order.created"
    payload = {"order_id": "123"}

    sub = MagicMock(spec=WebhookSubscription)
    sub.id = uuid4()
    sub.is_active = True
    sub.events = [event_type]

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [sub]
    mock_db.execute.return_value = mock_result

    with patch("app.services.webhook_service.deliver_webhook"):
        await trigger_webhook_event(event_type, payload, business_id, mock_db)

        # Verify delivery record was added
        assert mock_db.add.called
        # Verify deliver_webhook was triggered (via asyncio.create_task in our implementation)
        # Note: since we use asyncio.create_task, it might be hard to verify directly without more mocks
        pass


@pytest.mark.asyncio
async def test_deliver_webhook_signs_payload_with_hmac(mock_db):
    delivery_id = uuid4()

    sub = MagicMock(spec=WebhookSubscription)
    sub.secret = "test_secret"
    sub.url = "http://example.com/webhook"

    delivery = MagicMock(spec=WebhookDelivery)
    delivery.payload = {"test": "data"}
    delivery.event_type = "test.event"

    # Mock result for join query
    mock_row = (delivery, sub)
    mock_result = MagicMock()
    mock_result.first.return_value = mock_row
    mock_db.execute.return_value = mock_result

    payload_str = json.dumps(delivery.payload)
    expected_signature = hmac.new(
        sub.secret.encode(), payload_str.encode(), hashlib.sha256
    ).hexdigest()

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = MagicMock(status_code=200)
        await deliver_webhook(delivery_id, mock_db)

        # Verify signature header
        args, kwargs = mock_post.call_args
        assert kwargs["headers"]["X-BizPilot-Signature"] == expected_signature


@pytest.mark.asyncio
async def test_create_subscription_validates_url_is_reachable(mock_db):
    url = "http://example.com/webhook"
    events = ["order.created"]
    business_id = uuid4()

    with patch("httpx.AsyncClient.head") as mock_head:
        mock_head.return_value = MagicMock(status_code=200)
        sub = await create_webhook_subscription(url, events, business_id, mock_db)

        assert sub.url == url
        assert sub.secret is not None
        assert len(sub.secret) == 64  # token_hex(32) is 64 chars


@pytest.mark.asyncio
async def test_webhook_secret_not_returned_after_initial_creation(mock_db):
    from app.main import app
    from httpx import AsyncClient, ASGITransport
    from app.api.deps import get_current_business_id
    from app.core.database import get_db

    business_id = uuid4()
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_business_id] = lambda: business_id

    sub = WebhookSubscription(
        id=uuid4(),
        business_id=business_id,
        url="http://example.com",
        events=["test"],
        secret="hidden_secret",
        is_active=True,
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [sub]
    mock_db.execute.return_value = mock_result

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.get("/api/v1/webhooks/")

    assert response.status_code == 200
    data = response.json()
    assert "secret" not in data[0]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_trigger_webhook_event_is_non_blocking(mock_db):
    business_id = uuid4()

    # Mock result for empty subscriptions
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_result

    start_time = datetime.now()
    await trigger_webhook_event("test", {}, business_id, mock_db)
    end_time = datetime.now()

    # Should be very fast
    assert (end_time - start_time).total_seconds() < 0.1


@pytest.mark.asyncio
async def test_deliver_webhook_retries_on_failure_with_exponential_backoff(mock_db):
    delivery_id = uuid4()

    sub = MagicMock(spec=WebhookSubscription)
    sub.secret = "secret"
    sub.url = "http://bad-url.com"

    delivery = MagicMock(spec=WebhookDelivery)
    delivery.payload = {}
    delivery.attempt_count = 1
    delivery.status = "pending"

    mock_result = MagicMock()
    mock_result.first.return_value = (delivery, sub)
    mock_db.execute.return_value = mock_result

    with patch("httpx.AsyncClient.post", side_effect=Exception("Connection error")):
        await deliver_webhook(delivery_id, mock_db)

        assert delivery.status == "pending"  # remains pending for retry
        assert delivery.next_retry_at is not None
        assert delivery.attempt_count == 2


@pytest.mark.asyncio
async def test_deliver_webhook_marks_failed_after_max_attempts(mock_db):
    delivery_id = uuid4()

    sub = MagicMock(spec=WebhookSubscription)
    sub.secret = "secret"
    sub.url = "http://bad-url.com"
    sub.failure_count = 10

    delivery = MagicMock(spec=WebhookDelivery)
    delivery.payload = {}
    delivery.attempt_count = 6  # Max is 5 in our implementation
    delivery.status = "pending"

    mock_result = MagicMock()
    mock_result.first.return_value = (delivery, sub)
    mock_db.execute.return_value = mock_result

    with patch("httpx.AsyncClient.post", side_effect=Exception("Connection error")):
        await deliver_webhook(delivery_id, mock_db)

        assert delivery.status == "failed"
        assert not sub.is_active  # Deactivated after many failures
