"""Comprehensive tests for PaystackService."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import hmac
import hashlib
import re
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.paystack_service import (
    PaystackCustomer,
    PaystackService,
    PaystackTransaction,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_httpx_client(method: str, status_code: int, json_body: dict):
    """Build a mocked httpx.AsyncClient that returns a canned response."""
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.json.return_value = json_body

    mock_client = AsyncMock()
    setattr(mock_client, method, AsyncMock(return_value=mock_response))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    mock_client_cls = MagicMock(return_value=mock_client)
    return mock_client_cls, mock_client


# ---------------------------------------------------------------------------
# TestCreateCustomer
# ---------------------------------------------------------------------------

class TestCreateCustomer:
    """Tests for PaystackService.create_customer."""

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_success(self, mock_cls):
        mock_cls_obj, mock_client = _mock_httpx_client("post", 200, {
            "status": True,
            "data": {
                "customer_code": "CUS_abc123",
                "email": "user@example.com",
                "id": 42,
            },
        })
        mock_cls.return_value = mock_cls_obj.return_value

        service = PaystackService()
        result = await service.create_customer(
            "user@example.com", "John", "Doe", phone="+27123456789"
        )

        assert isinstance(result, PaystackCustomer)
        assert result.customer_code == "CUS_abc123"
        assert result.email == "user@example.com"
        assert result.id == 42
        mock_client.post.assert_awaited_once()

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_success_without_phone(self, mock_cls):
        mock_cls_obj, mock_client = _mock_httpx_client("post", 200, {
            "status": True,
            "data": {"customer_code": "CUS_x", "email": "a@b.com", "id": 1},
        })
        mock_cls.return_value = mock_cls_obj.return_value

        result = await PaystackService().create_customer("a@b.com", "A", "B")

        assert result is not None
        # Verify phone=None is sent in payload
        call_kwargs = mock_client.post.call_args
        assert call_kwargs.kwargs["json"]["phone"] is None

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_non_200_returns_none(self, mock_cls):
        mock_cls_obj, _ = _mock_httpx_client("post", 400, {"status": False})
        mock_cls.return_value = mock_cls_obj.return_value

        result = await PaystackService().create_customer("e@x.com", "F", "L")
        assert result is None

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_status_false_returns_none(self, mock_cls):
        mock_cls_obj, _ = _mock_httpx_client("post", 200, {
            "status": False,
            "message": "Duplicate email",
        })
        mock_cls.return_value = mock_cls_obj.return_value

        result = await PaystackService().create_customer("e@x.com", "F", "L")
        assert result is None

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_server_error_returns_none(self, mock_cls):
        mock_cls_obj, _ = _mock_httpx_client("post", 500, {})
        mock_cls.return_value = mock_cls_obj.return_value

        result = await PaystackService().create_customer("e@x.com", "F", "L")
        assert result is None


# ---------------------------------------------------------------------------
# TestInitializeTransaction
# ---------------------------------------------------------------------------

class TestInitializeTransaction:
    """Tests for PaystackService.initialize_transaction."""

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_success(self, mock_cls):
        mock_cls_obj, mock_client = _mock_httpx_client("post", 200, {
            "status": True,
            "data": {
                "reference": "ref-001",
                "authorization_url": "https://paystack.co/pay/xyz",
                "access_code": "ac_xyz",
            },
        })
        mock_cls.return_value = mock_cls_obj.return_value

        result = await PaystackService().initialize_transaction(
            "user@example.com", 50000, "ref-001",
            "https://example.com/callback",
        )

        assert isinstance(result, PaystackTransaction)
        assert result.reference == "ref-001"
        assert result.authorization_url == "https://paystack.co/pay/xyz"
        assert result.access_code == "ac_xyz"

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_with_plan_code(self, mock_cls):
        mock_cls_obj, mock_client = _mock_httpx_client("post", 200, {
            "status": True,
            "data": {
                "reference": "ref-002",
                "authorization_url": "https://paystack.co/pay/abc",
                "access_code": "ac_abc",
            },
        })
        mock_cls.return_value = mock_cls_obj.return_value

        result = await PaystackService().initialize_transaction(
            "user@example.com", 99900, "ref-002",
            "https://example.com/cb",
            plan_code="PLN_monthly",
        )

        assert result is not None
        payload = mock_client.post.call_args.kwargs["json"]
        assert payload["plan"] == "PLN_monthly"

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_without_plan_code_no_plan_key(self, mock_cls):
        mock_cls_obj, mock_client = _mock_httpx_client("post", 200, {
            "status": True,
            "data": {
                "reference": "r", "authorization_url": "u", "access_code": "a",
            },
        })
        mock_cls.return_value = mock_cls_obj.return_value

        await PaystackService().initialize_transaction(
            "e@x.com", 100, "r", "cb",
        )

        payload = mock_client.post.call_args.kwargs["json"]
        assert "plan" not in payload

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_with_metadata(self, mock_cls):
        mock_cls_obj, mock_client = _mock_httpx_client("post", 200, {
            "status": True,
            "data": {
                "reference": "r", "authorization_url": "u", "access_code": "a",
            },
        })
        mock_cls.return_value = mock_cls_obj.return_value

        meta = {"business_id": "biz-1"}
        await PaystackService().initialize_transaction(
            "e@x.com", 100, "r", "cb", metadata=meta,
        )

        payload = mock_client.post.call_args.kwargs["json"]
        assert payload["metadata"] == meta

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_default_metadata_empty_dict(self, mock_cls):
        mock_cls_obj, mock_client = _mock_httpx_client("post", 200, {
            "status": True,
            "data": {
                "reference": "r", "authorization_url": "u", "access_code": "a",
            },
        })
        mock_cls.return_value = mock_cls_obj.return_value

        await PaystackService().initialize_transaction(
            "e@x.com", 100, "r", "cb",
        )

        payload = mock_client.post.call_args.kwargs["json"]
        assert payload["metadata"] == {}

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_currency_is_zar(self, mock_cls):
        mock_cls_obj, mock_client = _mock_httpx_client("post", 200, {
            "status": True,
            "data": {
                "reference": "r", "authorization_url": "u", "access_code": "a",
            },
        })
        mock_cls.return_value = mock_cls_obj.return_value

        await PaystackService().initialize_transaction(
            "e@x.com", 100, "r", "cb",
        )

        payload = mock_client.post.call_args.kwargs["json"]
        assert payload["currency"] == "ZAR"

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_non_200_returns_none(self, mock_cls):
        mock_cls_obj, _ = _mock_httpx_client("post", 422, {"status": False})
        mock_cls.return_value = mock_cls_obj.return_value

        result = await PaystackService().initialize_transaction(
            "e@x.com", 100, "r", "cb",
        )
        assert result is None

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_status_false_returns_none(self, mock_cls):
        mock_cls_obj, _ = _mock_httpx_client("post", 200, {"status": False})
        mock_cls.return_value = mock_cls_obj.return_value

        result = await PaystackService().initialize_transaction(
            "e@x.com", 100, "r", "cb",
        )
        assert result is None


# ---------------------------------------------------------------------------
# TestVerifyTransaction
# ---------------------------------------------------------------------------

class TestVerifyTransaction:
    """Tests for PaystackService.verify_transaction."""

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_success(self, mock_cls):
        tx_data = {
            "reference": "ref-001",
            "status": "success",
            "amount": 50000,
            "currency": "ZAR",
        }
        mock_cls_obj, mock_client = _mock_httpx_client("get", 200, {
            "status": True, "data": tx_data,
        })
        mock_cls.return_value = mock_cls_obj.return_value

        result = await PaystackService().verify_transaction("ref-001")

        assert result == tx_data
        mock_client.get.assert_awaited_once()
        url = mock_client.get.call_args.args[0]
        assert url.endswith("/transaction/verify/ref-001")

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_non_200_returns_none(self, mock_cls):
        mock_cls_obj, _ = _mock_httpx_client("get", 404, {})
        mock_cls.return_value = mock_cls_obj.return_value

        assert await PaystackService().verify_transaction("bad") is None

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_status_false_returns_none(self, mock_cls):
        mock_cls_obj, _ = _mock_httpx_client("get", 200, {"status": False})
        mock_cls.return_value = mock_cls_obj.return_value

        assert await PaystackService().verify_transaction("ref") is None


# ---------------------------------------------------------------------------
# TestCreateSubscription
# ---------------------------------------------------------------------------

class TestCreateSubscription:
    """Tests for PaystackService.create_subscription."""

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_success(self, mock_cls):
        sub_data = {"subscription_code": "SUB_001", "status": "active"}
        mock_cls_obj, mock_client = _mock_httpx_client("post", 200, {
            "status": True, "data": sub_data,
        })
        mock_cls.return_value = mock_cls_obj.return_value

        result = await PaystackService().create_subscription("CUS_1", "PLN_1")

        assert result == sub_data
        payload = mock_client.post.call_args.kwargs["json"]
        assert payload["customer"] == "CUS_1"
        assert payload["plan"] == "PLN_1"
        assert "start_date" not in payload

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_with_start_date(self, mock_cls):
        mock_cls_obj, mock_client = _mock_httpx_client("post", 200, {
            "status": True, "data": {"subscription_code": "SUB_2"},
        })
        mock_cls.return_value = mock_cls_obj.return_value

        dt = datetime(2025, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
        await PaystackService().create_subscription("CUS_1", "PLN_1", start_date=dt)

        payload = mock_client.post.call_args.kwargs["json"]
        assert payload["start_date"] == dt.isoformat()

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_non_200_returns_none(self, mock_cls):
        mock_cls_obj, _ = _mock_httpx_client("post", 400, {})
        mock_cls.return_value = mock_cls_obj.return_value

        assert await PaystackService().create_subscription("C", "P") is None

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_status_false_returns_none(self, mock_cls):
        mock_cls_obj, _ = _mock_httpx_client("post", 200, {"status": False})
        mock_cls.return_value = mock_cls_obj.return_value

        assert await PaystackService().create_subscription("C", "P") is None


# ---------------------------------------------------------------------------
# TestCancelSubscription
# ---------------------------------------------------------------------------

class TestCancelSubscription:
    """Tests for PaystackService.cancel_subscription."""

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_success(self, mock_cls):
        mock_cls_obj, mock_client = _mock_httpx_client("post", 200, {
            "status": True, "message": "Subscription disabled successfully",
        })
        mock_cls.return_value = mock_cls_obj.return_value

        result = await PaystackService().cancel_subscription("SUB_1", "tok_abc")

        assert result is True
        payload = mock_client.post.call_args.kwargs["json"]
        assert payload["code"] == "SUB_1"
        assert payload["token"] == "tok_abc"

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_non_200_returns_false(self, mock_cls):
        mock_cls_obj, _ = _mock_httpx_client("post", 400, {"status": False})
        mock_cls.return_value = mock_cls_obj.return_value

        assert await PaystackService().cancel_subscription("S", "T") is False

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_200_but_status_false_returns_false(self, mock_cls):
        mock_cls_obj, _ = _mock_httpx_client("post", 200, {"status": False})
        mock_cls.return_value = mock_cls_obj.return_value

        assert await PaystackService().cancel_subscription("S", "T") is False


# ---------------------------------------------------------------------------
# TestGetSubscription
# ---------------------------------------------------------------------------

class TestGetSubscription:
    """Tests for PaystackService.get_subscription."""

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_success(self, mock_cls):
        sub_data = {"subscription_code": "SUB_1", "plan": {"name": "Pro"}}
        mock_cls_obj, mock_client = _mock_httpx_client("get", 200, {
            "status": True, "data": sub_data,
        })
        mock_cls.return_value = mock_cls_obj.return_value

        result = await PaystackService().get_subscription("SUB_1")

        assert result == sub_data
        url = mock_client.get.call_args.args[0]
        assert url.endswith("/subscription/SUB_1")

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_non_200_returns_none(self, mock_cls):
        mock_cls_obj, _ = _mock_httpx_client("get", 404, {})
        mock_cls.return_value = mock_cls_obj.return_value

        assert await PaystackService().get_subscription("SUB_bad") is None

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_status_false_returns_none(self, mock_cls):
        mock_cls_obj, _ = _mock_httpx_client("get", 200, {"status": False})
        mock_cls.return_value = mock_cls_obj.return_value

        assert await PaystackService().get_subscription("SUB_x") is None


# ---------------------------------------------------------------------------
# TestCreatePlan
# ---------------------------------------------------------------------------

class TestCreatePlan:
    """Tests for PaystackService.create_plan."""

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_success_200(self, mock_cls):
        plan_data = {"plan_code": "PLN_1", "name": "Pro"}
        mock_cls_obj, mock_client = _mock_httpx_client("post", 200, {
            "status": True, "data": plan_data,
        })
        mock_cls.return_value = mock_cls_obj.return_value

        result = await PaystackService().create_plan("Pro", 99900, "monthly")

        assert result == plan_data
        payload = mock_client.post.call_args.kwargs["json"]
        assert payload["name"] == "Pro"
        assert payload["amount"] == 99900
        assert payload["interval"] == "monthly"
        assert payload["currency"] == "ZAR"
        assert "description" not in payload

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_success_201(self, mock_cls):
        plan_data = {"plan_code": "PLN_2"}
        mock_cls_obj, _ = _mock_httpx_client("post", 201, {
            "status": True, "data": plan_data,
        })
        mock_cls.return_value = mock_cls_obj.return_value

        result = await PaystackService().create_plan("Basic", 49900, "yearly")
        assert result == plan_data

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_with_description(self, mock_cls):
        mock_cls_obj, mock_client = _mock_httpx_client("post", 200, {
            "status": True, "data": {"plan_code": "PLN_3"},
        })
        mock_cls.return_value = mock_cls_obj.return_value

        await PaystackService().create_plan(
            "Pro", 99900, "monthly", description="Pro tier plan"
        )

        payload = mock_client.post.call_args.kwargs["json"]
        assert payload["description"] == "Pro tier plan"

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_non_200_201_returns_none(self, mock_cls):
        mock_cls_obj, _ = _mock_httpx_client("post", 400, {"status": False})
        mock_cls.return_value = mock_cls_obj.return_value

        assert await PaystackService().create_plan("X", 100, "daily") is None

    @patch("app.services.paystack_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_status_false_returns_none(self, mock_cls):
        mock_cls_obj, _ = _mock_httpx_client("post", 200, {"status": False})
        mock_cls.return_value = mock_cls_obj.return_value

        assert await PaystackService().create_plan("X", 100, "daily") is None


# ---------------------------------------------------------------------------
# TestVerifyWebhookSignature
# ---------------------------------------------------------------------------

class TestVerifyWebhookSignature:
    """Tests for PaystackService.verify_webhook_signature."""

    def test_valid_signature(self):
        secret = "sk_test_secret"
        payload = b'{"event":"charge.success"}'
        sig = hmac.new(secret.encode(), payload, hashlib.sha512).hexdigest()

        with patch("app.services.paystack_service.PAYSTACK_SECRET_KEY", secret):
            assert PaystackService.verify_webhook_signature(payload, sig) is True

    def test_invalid_signature(self):
        secret = "sk_test_secret"
        payload = b'{"event":"charge.success"}'

        with patch("app.services.paystack_service.PAYSTACK_SECRET_KEY", secret):
            assert PaystackService.verify_webhook_signature(payload, "bad_sig") is False

    def test_empty_secret_key_returns_false(self):
        with patch("app.services.paystack_service.PAYSTACK_SECRET_KEY", ""):
            result = PaystackService.verify_webhook_signature(b"data", "sig")
            assert result is False

    def test_tampered_payload(self):
        secret = "sk_test_secret"
        original = b'{"amount":100}'
        tampered = b'{"amount":999}'
        sig = hmac.new(secret.encode(), original, hashlib.sha512).hexdigest()

        with patch("app.services.paystack_service.PAYSTACK_SECRET_KEY", secret):
            assert PaystackService.verify_webhook_signature(tampered, sig) is False


# ---------------------------------------------------------------------------
# TestGenerateReference
# ---------------------------------------------------------------------------

class TestGenerateReference:
    """Tests for PaystackService.generate_reference."""

    def test_default_prefix(self):
        ref = PaystackService.generate_reference()
        assert ref.startswith("BP-")

    def test_custom_prefix(self):
        ref = PaystackService.generate_reference(prefix="INV")
        assert ref.startswith("INV-")

    def test_format_matches_pattern(self):
        ref = PaystackService.generate_reference()
        # Expected: BP-YYYYMMDDHHMMSS-XXXXXXXX
        pattern = r"^BP-\d{14}-[A-F0-9]{8}$"
        assert re.match(pattern, ref), f"Reference '{ref}' does not match expected pattern"

    def test_uniqueness(self):
        refs = {PaystackService.generate_reference() for _ in range(50)}
        assert len(refs) == 50, "Generated references should be unique"

    def test_contains_three_parts(self):
        ref = PaystackService.generate_reference()
        parts = ref.split("-")
        assert len(parts) == 3
        assert parts[0] == "BP"
        assert len(parts[1]) == 14  # timestamp
        assert len(parts[2]) == 8   # uuid hex


# ---------------------------------------------------------------------------
# TestPydanticModels
# ---------------------------------------------------------------------------

class TestPydanticModels:
    """Smoke tests for Pydantic models used by the service."""

    def test_paystack_customer(self):
        c = PaystackCustomer(customer_code="CUS_1", email="a@b.com", id=1)
        assert c.customer_code == "CUS_1"

    def test_paystack_transaction(self):
        t = PaystackTransaction(
            reference="ref", authorization_url="url", access_code="ac"
        )
        assert t.reference == "ref"


# ---------------------------------------------------------------------------
# TestServiceHeaders
# ---------------------------------------------------------------------------

class TestServiceHeaders:
    """Tests for PaystackService constructor / headers."""

    def test_headers_contain_bearer_token(self):
        service = PaystackService()
        assert service.headers["Authorization"].startswith("Bearer ")
        assert service.headers["Content-Type"] == "application/json"
