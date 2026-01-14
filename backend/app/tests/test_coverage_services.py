import json
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest


def _make_request(headers: dict[str, str] | None = None, cookie: str | None = None):
    from starlette.requests import Request

    raw_headers = []
    if headers:
        for k, v in headers.items():
            raw_headers.append((k.lower().encode(), v.encode()))
    if cookie is not None:
        raw_headers.append((b"cookie", cookie.encode()))

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": raw_headers,
        "query_string": b"",
        "server": ("testserver", 80),
        "client": ("testclient", 123),
        "scheme": "http",
    }
    return Request(scope)


def test_settings_parse_cors_origins_json_list(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")
    monkeypatch.setenv("CORS_ORIGINS", json.dumps(["http://a.com", "http://b.com"]))

    from app.core.config import Settings

    s = Settings()
    assert s.CORS_ORIGINS == ["http://a.com", "http://b.com"]


def test_settings_parse_cors_origins_csv(monkeypatch):
    from app.core.config import Settings

    s = Settings(SECRET_KEY="0123456789abcdef", CORS_ORIGINS="http://a.com, http://b.com")
    assert s.CORS_ORIGINS == ["http://a.com", "http://b.com"]


def test_settings_secret_key_validator_requires_min_length(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "short")

    from app.core.config import Settings

    with pytest.raises(ValueError):
        Settings()


def test_invoice_service_generate_invoice_number_increments_count(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    from app.services.invoice_service import InvoiceService

    db = MagicMock()
    q = MagicMock()
    db.query.return_value = q
    q.filter.return_value = q
    q.count.return_value = 4

    service = InvoiceService(db)
    invoice_number = service.generate_invoice_number("biz")

    assert invoice_number.startswith("INV-")
    assert invoice_number.endswith("00005")


def test_invoice_service_record_payment_sets_status_paid(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    from app.services.invoice_service import InvoiceService
    from app.models.invoice import InvoiceStatus

    db = MagicMock()
    service = InvoiceService(db)

    invoice = SimpleNamespace(
        amount_paid=Decimal("0"),
        total=Decimal("100"),
        status=InvoiceStatus.SENT,
        paid_date=None,
    )

    updated = service.record_payment(invoice, Decimal("100"), "cash")

    assert updated.status == InvoiceStatus.PAID
    assert updated.paid_date == date.today()
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(invoice)


def test_invoice_service_record_payment_sets_status_partial(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    from app.services.invoice_service import InvoiceService
    from app.models.invoice import InvoiceStatus

    db = MagicMock()
    service = InvoiceService(db)

    invoice = SimpleNamespace(
        amount_paid=Decimal("0"),
        total=Decimal("100"),
        status=InvoiceStatus.SENT,
        paid_date=None,
    )

    updated = service.record_payment(invoice, Decimal("10"), "cash")

    assert updated.status == InvoiceStatus.PARTIAL
    assert updated.paid_date is None


def test_invoice_service_send_invoice(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    from app.services.invoice_service import InvoiceService
    from app.models.invoice import InvoiceStatus

    db = MagicMock()
    service = InvoiceService(db)

    invoice = SimpleNamespace(status=InvoiceStatus.DRAFT)
    updated = service.send_invoice(invoice)

    assert updated.status == InvoiceStatus.SENT
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(invoice)


def test_product_service_bulk_delete_enforces_max_ids(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    from app.services.product_service import ProductService

    db = MagicMock()
    service = ProductService(db)

    with pytest.raises(ValueError):
        service.bulk_delete_products("biz", ["1"] * 3, max_ids=2)


def test_product_service_update_inventory_sets_out_of_stock(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    from app.services.product_service import ProductService
    from app.models.product import ProductStatus

    db = MagicMock()
    service = ProductService(db)

    product = SimpleNamespace(
        quantity=1,
        track_inventory=True,
        status=ProductStatus.ACTIVE,
    )

    updated = service.update_inventory(product, -10)

    assert updated.quantity == 0
    assert updated.status == ProductStatus.OUT_OF_STOCK
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(product)


def test_product_service_update_inventory_recovers_from_out_of_stock(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    from app.services.product_service import ProductService
    from app.models.product import ProductStatus

    db = MagicMock()
    service = ProductService(db)

    product = SimpleNamespace(
        quantity=0,
        track_inventory=True,
        status=ProductStatus.OUT_OF_STOCK,
    )

    updated = service.update_inventory(product, 5)

    assert updated.quantity == 5
    assert updated.status == ProductStatus.ACTIVE


def test_customer_display_name_company_and_fallback(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    from app.models.customer import Customer

    c1 = Customer(company_name="ACME")
    assert c1.display_name == "ACME"

    c2 = Customer(first_name="John", last_name="Doe")
    assert c2.display_name == "John Doe"

    c3 = Customer(first_name=None, last_name=None, company_name=None)
    assert c3.display_name == "Unknown"


def test_invoice_is_overdue_property(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    from app.models.invoice import Invoice, InvoiceStatus

    inv = Invoice(
        total=Decimal("100"),
        amount_paid=Decimal("0"),
        status=InvoiceStatus.SENT,
        due_date=date.today() - timedelta(days=1),
    )

    assert inv.is_overdue is True


def test_simple_cache_set_get_and_expiry(monkeypatch):
    from app.core.cache import SimpleCache

    c = SimpleCache()
    c.set("k", "v", ttl_seconds=60)
    assert c.get("k") == "v"

    c.set("k2", "v2", ttl_seconds=0)
    assert c.get("k2") is None


def test_simple_cache_delete_and_clear_prefix():
    from app.core.cache import SimpleCache

    c = SimpleCache()
    c.set("p:a", 1, ttl_seconds=60)
    c.set("p:b", 2, ttl_seconds=60)
    c.set("q:c", 3, ttl_seconds=60)

    c.delete("q:c")
    assert c.get("q:c") is None

    c.clear_prefix("p:")
    assert c.get("p:a") is None
    assert c.get("p:b") is None


def test_cache_key_is_deterministic():
    from app.core.cache import cache_key

    k1 = cache_key("x", "biz", 1)
    k2 = cache_key("x", "biz", 1)
    assert k1 == k2
    assert k1.startswith("x:")


@pytest.mark.asyncio
async def test_cached_response_decorator_caches_result(monkeypatch):
    from app.core import cache as cache_mod

    cache_mod.dashboard_cache.clear_all()

    calls = {"n": 0}

    @cache_mod.cached_response("demo", ttl_seconds=60)
    async def f(*, business_id: str):
        calls["n"] += 1
        return {"ok": True, "biz": business_id, "n": calls["n"]}

    r1 = await f(business_id="b1")
    r2 = await f(business_id="b1")

    assert r1 == r2
    assert calls["n"] == 1


def test_deps_extract_token_prefers_bearer_over_cookie(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    from fastapi.security import HTTPAuthorizationCredentials
    from app.api.deps import extract_token_from_request

    req = _make_request(cookie="access_token=cookie-token")
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bearer-token")
    assert extract_token_from_request(req, creds) == "bearer-token"


def test_deps_extract_token_cookie_fallback(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    from app.api.deps import extract_token_from_request

    req = _make_request(cookie="access_token=cookie-token")
    assert extract_token_from_request(req, None) == "cookie-token"


@pytest.mark.asyncio
async def test_get_current_user_happy_path(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.deps as deps

    fake_user = SimpleNamespace(id="u1", status=None, is_email_verified=True)

    monkeypatch.setattr(deps, "decode_token", lambda token: {"type": "access", "sub": "u1"})

    class FakeAuthService:
        def __init__(self, db):
            self.db = db

        def get_user_by_id(self, user_id: str):
            assert user_id == "u1"
            return fake_user

    monkeypatch.setattr(deps, "AuthService", FakeAuthService)

    req = _make_request(cookie="access_token=tok")
    user = await deps.get_current_user(request=req, credentials=None, db=MagicMock())
    assert user is fake_user


@pytest.mark.asyncio
async def test_get_current_user_raises_on_missing_token(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.deps as deps

    req = _make_request()
    with pytest.raises(Exception):
        await deps.get_current_user(request=req, credentials=None, db=MagicMock())


def test_auth_is_mobile_client_and_cookie_helpers(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    from fastapi import Response
    from app.api.auth import is_mobile_client, set_auth_cookies, clear_auth_cookies

    r_mobile = _make_request(headers={"X-Client-Type": "mobile"})
    r_web = _make_request(headers={"X-Client-Type": "web"})

    assert is_mobile_client(r_mobile) is True
    assert is_mobile_client(r_web) is False

    resp = Response()
    set_auth_cookies(resp, "a", "r")
    set_cookie_header = resp.headers.get("set-cookie")
    assert set_cookie_header is not None
    assert "access_token=" in set_cookie_header

    resp2 = Response()
    clear_auth_cookies(resp2)


@pytest.mark.asyncio
async def test_ai_chat_returns_fallback_when_not_configured(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.ai as ai

    import fastapi

    monkeypatch.setattr(ai.settings, "OPENAI_API_KEY", "")
    monkeypatch.setattr(ai.settings, "GROQ_API_KEY", "")

    req = ai.ChatRequest(message="hello", conversation_id="c1")
    with pytest.raises(fastapi.HTTPException) as exc:
        await ai.chat(request=req, current_user=SimpleNamespace(id="u1"), db=MagicMock())

    assert exc.value.status_code == 400
    assert "GROQ_API_KEY" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_ai_generate_ai_response_keyword_paths(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.ai as ai

    msg = await ai.generate_ai_response("revenue", user_id="u", db=MagicMock())
    assert "Reports" in msg

    msg2 = await ai.generate_ai_response("inventory", user_id="u", db=MagicMock())
    assert "inventory" in msg2.lower()

    msg3 = await ai.generate_ai_response("something else", user_id="u", db=MagicMock())
    assert "Could you please be more specific" in msg3


def test_deps_get_current_active_user_blocks_inactive(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.deps as deps
    from app.models.user import UserStatus

    inactive_user = SimpleNamespace(status=UserStatus.INACTIVE)
    with pytest.raises(Exception):
        import anyio

        anyio.run(deps.get_current_active_user, inactive_user)


def test_deps_get_current_user_for_onboarding_allows_pending(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.deps as deps
    from app.models.user import UserStatus

    pending_user = SimpleNamespace(status=UserStatus.PENDING)
    import anyio

    res = anyio.run(deps.get_current_user_for_onboarding, pending_user)
    assert res is pending_user


def test_deps_get_current_verified_user_blocks_unverified(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.deps as deps

    user = SimpleNamespace(is_email_verified=False)
    with pytest.raises(Exception):
        import anyio

        anyio.run(deps.get_current_verified_user, user)


def test_get_optional_user_returns_none_when_no_token(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.deps as deps

    req = _make_request()
    assert deps.get_optional_user(request=req, credentials=None, db=MagicMock()) is None


def test_get_optional_user_returns_user_when_valid_access(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.deps as deps

    fake_user = SimpleNamespace(id="u1")
    monkeypatch.setattr(deps, "decode_token", lambda token: {"type": "access", "sub": "u1"})

    class FakeAuthService:
        def __init__(self, db):
            self.db = db

        def get_user_by_id(self, user_id: str):
            return fake_user

    monkeypatch.setattr(deps, "AuthService", FakeAuthService)

    req = _make_request(cookie="access_token=tok")
    assert deps.get_optional_user(request=req, credentials=None, db=MagicMock()) is fake_user


@pytest.mark.asyncio
async def test_get_current_business_id_raises_when_missing(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.deps as deps

    db = MagicMock()
    q = MagicMock()
    db.query.return_value = q
    q.filter.return_value = q
    q.first.return_value = None

    with pytest.raises(Exception):
        await deps.get_current_business_id(current_user=SimpleNamespace(id="u1"), db=db)


@pytest.mark.asyncio
async def test_get_current_business_id_returns_id(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.deps as deps

    db = MagicMock()
    q = MagicMock()
    db.query.return_value = q
    q.filter.return_value = q
    q.first.return_value = SimpleNamespace(business_id="b1")

    biz_id = await deps.get_current_business_id(current_user=SimpleNamespace(id="u1"), db=db)
    assert biz_id == "b1"


@pytest.mark.asyncio
async def test_auth_login_sets_cookies_for_web(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.auth as auth

    monkeypatch.setattr(auth, "create_access_token", lambda data: "access")
    monkeypatch.setattr(auth, "create_refresh_token", lambda data: "refresh")

    class FakeAuthService:
        def __init__(self, db):
            self.db = db

        def authenticate_user(self, email: str, password: str):
            return SimpleNamespace(id="u1")

    monkeypatch.setattr(auth, "AuthService", FakeAuthService)

    req = _make_request(headers={"X-Client-Type": "web"})
    from fastapi import Response

    resp = Response()
    creds = SimpleNamespace(email="e@example.com", password="pw")
    token = await auth.login(credentials=creds, request=req, response=resp, db=MagicMock())
    assert token.access_token == "access"
    assert "set-cookie" in resp.headers


@pytest.mark.asyncio
async def test_auth_login_does_not_set_cookies_for_mobile(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.auth as auth

    monkeypatch.setattr(auth, "create_access_token", lambda data: "access")
    monkeypatch.setattr(auth, "create_refresh_token", lambda data: "refresh")

    class FakeAuthService:
        def __init__(self, db):
            self.db = db

        def authenticate_user(self, email: str, password: str):
            return SimpleNamespace(id="u1")

    monkeypatch.setattr(auth, "AuthService", FakeAuthService)

    req = _make_request(headers={"X-Client-Type": "mobile"})
    from fastapi import Response

    resp = Response()
    creds = SimpleNamespace(email="e@example.com", password="pw")
    _ = await auth.login(credentials=creds, request=req, response=resp, db=MagicMock())
    assert "set-cookie" not in resp.headers


@pytest.mark.asyncio
async def test_auth_refresh_token_web_cookie_missing(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.auth as auth
    from fastapi import Response

    req = _make_request(headers={"X-Client-Type": "web"})
    resp = Response()
    with pytest.raises(Exception):
        await auth.refresh_token(request=req, response=resp, token_data=None, db=MagicMock())


@pytest.mark.asyncio
async def test_auth_refresh_token_mobile_requires_body(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.auth as auth
    from fastapi import Response

    req = _make_request(headers={"X-Client-Type": "mobile"})
    resp = Response()
    with pytest.raises(Exception):
        await auth.refresh_token(request=req, response=resp, token_data=None, db=MagicMock())


@pytest.mark.asyncio
async def test_auth_forgot_password_always_returns_success(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.auth as auth

    monkeypatch.setattr(auth, "create_password_reset_token", lambda email: "tok")

    class FakeAuthService:
        def __init__(self, db):
            self.db = db

        def get_user_by_email(self, email: str):
            return None

    monkeypatch.setattr(auth, "AuthService", FakeAuthService)

    # Create a proper request object for rate limiter
    request = _make_request()
    res = await auth.forgot_password(request=request, data=SimpleNamespace(email="x@y.com"), db=MagicMock())
    assert "message" in res


def test_invoice_pdf_helpers_escape_and_build_pdf():
    from app.core.pdf import escape_pdf_text, build_simple_pdf

    assert escape_pdf_text("a(b)c") == "a\\(b\\)c"
    assert escape_pdf_text("a\\b") == "a\\\\b"

    pdf = build_simple_pdf(["Hello", "World"])
    assert pdf.startswith(b"%PDF-1.4")
    assert b"%%EOF" in pdf


@pytest.mark.asyncio
async def test_orders_create_outbound_validates_supplier_before_creation(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.orders as orders_api
    from app.models.order import OrderDirection
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    called = {"create_order": False}

    class FakeService:
        def __init__(self, db):
            self.db = db

        def create_order(self, business_id: str, data):
            called["create_order"] = True
            raise AssertionError("create_order should not be called when supplier is invalid")

    monkeypatch.setattr(orders_api, "OrderService", FakeService)

    db = MagicMock()
    q = MagicMock()
    db.query.return_value = q
    q.filter.return_value = q
    q.first.return_value = None

    with pytest.raises(Exception):
        await orders_api.create_order(
            data=SimpleNamespace(direction=OrderDirection.OUTBOUND, supplier_id="supp-1", items=[]),
            current_user=SimpleNamespace(id="u"),
            business_id="b",
            db=db,
        )

    assert called["create_order"] is False


def test_email_service_requires_password_when_user_set(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    from app.core.config import settings
    from app.services.email_service import EmailService

    monkeypatch.setattr(settings, "SMTP_USER", "user")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "")

    service = EmailService()
    with pytest.raises(ValueError):
        service.send_email(to_email="a@b.com", subject="s", body_text="t")


def test_email_service_uses_timeout_and_starttls(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    from app.core.config import settings
    from app.services.email_service import EmailService

    monkeypatch.setattr(settings, "SMTP_HOST", "smtp")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_TIMEOUT", 12)
    monkeypatch.setattr(settings, "SMTP_STARTTLS", True)
    monkeypatch.setattr(settings, "SMTP_USER", "")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "")

    calls = {"timeout": None, "starttls": 0}

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            calls["timeout"] = timeout

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def ehlo(self):
            return None

        def starttls(self):
            calls["starttls"] += 1

        def login(self, user, password):
            return None

        def send_message(self, msg):
            return None

    import app.services.email_service as email_mod

    monkeypatch.setattr(email_mod.smtplib, "SMTP", FakeSMTP)

    service = EmailService()
    service.send_email(to_email="a@b.com", subject="s", body_text="t")

    assert calls["timeout"] == 12
    assert calls["starttls"] == 1


@pytest.mark.asyncio
async def test_invoices_get_invoice_not_found(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.invoices as inv_api

    class FakeService:
        def __init__(self, db):
            self.db = db

        def get_invoice(self, invoice_id: str, business_id: str):
            return None

    monkeypatch.setattr(inv_api, "InvoiceService", FakeService)

    with pytest.raises(Exception):
        await inv_api.get_invoice(invoice_id="i1", current_user=SimpleNamespace(id="u"), business_id="b", db=MagicMock())


@pytest.mark.asyncio
async def test_invoices_record_payment_exceeds_balance(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.invoices as inv_api

    invoice = SimpleNamespace(id="i1", balance_due=Decimal("5"))

    class FakeService:
        def __init__(self, db):
            self.db = db

        def get_invoice(self, invoice_id: str, business_id: str):
            return invoice

    monkeypatch.setattr(inv_api, "InvoiceService", FakeService)

    with pytest.raises(Exception):
        await inv_api.record_payment(
            invoice_id="i1",
            data=SimpleNamespace(amount=Decimal("10"), payment_method="cash"),
            current_user=SimpleNamespace(id="u"),
            business_id="b",
            db=MagicMock(),
        )


@pytest.mark.asyncio
async def test_invoices_get_invoice_pdf_builds_response(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.invoices as inv_api

    invoice = SimpleNamespace(
        id="i1",
        business_id="b",
        customer_id="c1",
        order_id=None,
        invoice_number="INV-1",
        status="sent",
        issue_date=date.today(),
        due_date=None,
        paid_date=None,
        billing_address=None,
        notes=None,
        terms=None,
        footer=None,
        subtotal=Decimal("10"),
        tax_amount=Decimal("0"),
        discount_amount=None,
        total=Decimal("10"),
        amount_paid=Decimal("0"),
        balance_due=Decimal("10"),
        is_paid=False,
        is_overdue=False,
        pdf_url=None,
        created_at=None,
        updated_at=None,
    )

    item = SimpleNamespace(
        id="it1",
        invoice_id="i1",
        product_id=None,
        description="A (test)",
        quantity=Decimal("1"),
        unit_price=Decimal("10"),
        tax_rate=Decimal("0"),
        tax_amount=Decimal("0"),
        discount_percent=Decimal("0"),
        discount_amount=Decimal("0"),
        total=Decimal("10"),
        line_total=Decimal("10"),
        created_at=None,
        updated_at=None,
    )

    class FakeService:
        def __init__(self, db):
            self.db = db

        def get_invoice(self, invoice_id: str, business_id: str):
            return invoice

        def get_invoice_items(self, invoice_id: str):
            return [item]

    monkeypatch.setattr(inv_api, "InvoiceService", FakeService)

    db = MagicMock()
    q = MagicMock()
    db.query.return_value = q
    q.filter.return_value = q
    # Return business first, then customer on subsequent calls
    q.first.side_effect = [
        SimpleNamespace(name="Test Business"),  # Business query
        SimpleNamespace(first_name="John", last_name="Doe", company_name=None),  # Customer query
    ]

    resp = await inv_api.get_invoice_pdf(
        invoice_id="i1",
        current_user=SimpleNamespace(id="u"),
        business_id="b",
        db=db,
    )
    assert resp.media_type == "application/pdf"
    assert resp.body.startswith(b"%PDF-1.4")


@pytest.mark.asyncio
async def test_customers_create_customer_duplicate_email(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.customers as cust_api

    class FakeService:
        def __init__(self, db):
            self.db = db

        def get_customer_by_email(self, email: str, business_id: str):
            return SimpleNamespace(id="c1")

    monkeypatch.setattr(cust_api, "CustomerService", FakeService)

    with pytest.raises(Exception):
        await cust_api.create_customer(
            data=SimpleNamespace(email="a@b.com"),
            current_user=SimpleNamespace(id="u"),
            db=MagicMock(),
            business_id="b",
        )


@pytest.mark.asyncio
async def test_inventory_adjust_inventory_handles_value_error(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.inventory as inv_api

    class FakeService:
        def __init__(self, db):
            self.db = db

        def get_inventory_item(self, item_id: str, business_id: str):
            return SimpleNamespace(id=item_id)

        def adjust_inventory(self, item, data, user_id: str):
            raise ValueError("bad")

    monkeypatch.setattr(inv_api, "InventoryService", FakeService)

    with pytest.raises(Exception):
        await inv_api.adjust_inventory(
            item_id="i1",
            data=SimpleNamespace(),
            current_user=SimpleNamespace(id="u"),
            db=MagicMock(),
            business_id="b",
        )


@pytest.mark.asyncio
async def test_products_bulk_delete_returns_deleted_count(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "0123456789abcdef")

    import app.api.products as prod_api

    class FakeService:
        def __init__(self, db):
            self.db = db

        def bulk_delete_products(self, business_id: str, product_ids):
            assert business_id == "b"
            return 2

    monkeypatch.setattr(prod_api, "ProductService", FakeService)

    res = await prod_api.bulk_delete_products(
        data=SimpleNamespace(product_ids=["p1", "p2"]),
        current_user=SimpleNamespace(id="u"),
        business_id="b",
        db=MagicMock(),
    )
    assert res == {"deleted": 2}

