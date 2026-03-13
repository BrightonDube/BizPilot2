"""Comprehensive tests for GoogleOAuthService."""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.user import User, UserStatus
from app.schemas.oauth import GoogleUserInfo
from app.services.google_oauth_service import GoogleOAuthService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_google_info(**overrides) -> GoogleUserInfo:
    """Build a GoogleUserInfo with sensible defaults."""
    defaults = dict(
        id="google-123",
        email="test@example.com",
        verified_email=True,
        name="Test User",
        given_name="Test",
        family_name="User",
        picture="https://example.com/photo.jpg",
    )
    defaults.update(overrides)
    return GoogleUserInfo(**defaults)


def _make_user(**overrides) -> MagicMock:
    """Build a mock User."""
    user = MagicMock(spec=User)
    user.email = overrides.get("email", "test@example.com")
    user.google_id = overrides.get("google_id", None)
    user.first_name = overrides.get("first_name", "Test")
    user.last_name = overrides.get("last_name", "User")
    user.avatar_url = overrides.get("avatar_url", None)
    user.is_email_verified = overrides.get("is_email_verified", False)
    user.status = overrides.get("status", UserStatus.PENDING)
    return user


def _chain(first=None):
    """Return a mock query chain: db.query(...).filter(...).first()."""
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.first = MagicMock(return_value=first)
    return q


def _mock_httpx_response(status_code=200, json_data=None):
    """Build a mock httpx response."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data or {}
    return resp


def _mock_async_client(response, method="post"):
    """Patch target: httpx.AsyncClient — returns mock_client_cls."""
    mock_client = AsyncMock()
    setattr(mock_client, method, AsyncMock(return_value=response))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


# ======================================================================
# TestExchangeCode
# ======================================================================

class TestExchangeCode:
    """Tests for exchange_code_for_tokens."""

    @patch("app.services.google_oauth_service.settings")
    @patch("app.services.google_oauth_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_success_returns_tokens(self, mock_client_cls, mock_settings):
        mock_settings.GOOGLE_CLIENT_ID = "client-id"
        mock_settings.GOOGLE_CLIENT_SECRET = "client-secret"

        token_data = {"access_token": "at-123", "id_token": "idt-456"}
        response = _mock_httpx_response(200, token_data)
        mock_client = _mock_async_client(response, "post")
        mock_client_cls.return_value = mock_client

        svc = GoogleOAuthService(db=MagicMock())
        result = await svc.exchange_code_for_tokens("4/auth-code")

        assert result == token_data
        mock_client.post.assert_awaited_once()

    @patch("app.services.google_oauth_service.settings")
    @patch("app.services.google_oauth_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_non_200_returns_none(self, mock_client_cls, mock_settings):
        mock_settings.GOOGLE_CLIENT_ID = "cid"
        mock_settings.GOOGLE_CLIENT_SECRET = "csec"

        response = _mock_httpx_response(400, {"error": "invalid_grant"})
        mock_client = _mock_async_client(response, "post")
        mock_client_cls.return_value = mock_client

        svc = GoogleOAuthService(db=MagicMock())
        result = await svc.exchange_code_for_tokens("bad-code")

        assert result is None

    @patch("app.services.google_oauth_service.settings")
    @patch("app.services.google_oauth_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_exception_returns_none(self, mock_client_cls, mock_settings):
        mock_settings.GOOGLE_CLIENT_ID = "cid"
        mock_settings.GOOGLE_CLIENT_SECRET = "csec"

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=httpx_exception())
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        svc = GoogleOAuthService(db=MagicMock())
        result = await svc.exchange_code_for_tokens("code")

        assert result is None

    @patch("app.services.google_oauth_service.settings")
    @patch("app.services.google_oauth_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_posts_correct_payload(self, mock_client_cls, mock_settings):
        mock_settings.GOOGLE_CLIENT_ID = "my-client-id"
        mock_settings.GOOGLE_CLIENT_SECRET = "my-secret"

        response = _mock_httpx_response(200, {"access_token": "at"})
        mock_client = _mock_async_client(response, "post")
        mock_client_cls.return_value = mock_client

        svc = GoogleOAuthService(db=MagicMock())
        await svc.exchange_code_for_tokens("4/the-code")

        call_kwargs = mock_client.post.call_args
        posted_data = call_kwargs.kwargs.get("data") or call_kwargs[1].get("data")
        assert posted_data["code"] == "4/the-code"
        assert posted_data["client_id"] == "my-client-id"
        assert posted_data["client_secret"] == "my-secret"
        assert posted_data["redirect_uri"] == "postmessage"
        assert posted_data["grant_type"] == "authorization_code"


def httpx_exception():
    """Return a generic exception to simulate httpx errors."""
    return Exception("connection error")


# ======================================================================
# TestGetUserInfoFromAccessToken
# ======================================================================

class TestGetUserInfoFromAccessToken:
    """Tests for get_user_info_from_access_token."""

    @patch("app.services.google_oauth_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_success_returns_google_user_info(self, mock_client_cls):
        data = {
            "id": "g-999",
            "email": "alice@example.com",
            "verified_email": True,
            "name": "Alice Smith",
            "given_name": "Alice",
            "family_name": "Smith",
            "picture": "https://photo.url/alice",
        }
        response = _mock_httpx_response(200, data)
        mock_client = _mock_async_client(response, "get")
        mock_client_cls.return_value = mock_client

        svc = GoogleOAuthService(db=MagicMock())
        result = await svc.get_user_info_from_access_token("access-token-abc")

        assert isinstance(result, GoogleUserInfo)
        assert result.id == "g-999"
        assert result.email == "alice@example.com"
        assert result.verified_email is True
        assert result.given_name == "Alice"
        assert result.family_name == "Smith"
        assert result.picture == "https://photo.url/alice"

    @patch("app.services.google_oauth_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_sends_bearer_header(self, mock_client_cls):
        response = _mock_httpx_response(200, {"id": "1", "email": "a@b.com"})
        mock_client = _mock_async_client(response, "get")
        mock_client_cls.return_value = mock_client

        svc = GoogleOAuthService(db=MagicMock())
        await svc.get_user_info_from_access_token("my-token")

        call_kwargs = mock_client.get.call_args
        headers = call_kwargs.kwargs.get("headers") or call_kwargs[1].get("headers")
        assert headers["Authorization"] == "Bearer my-token"

    @patch("app.services.google_oauth_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_non_200_returns_none(self, mock_client_cls):
        response = _mock_httpx_response(401)
        mock_client = _mock_async_client(response, "get")
        mock_client_cls.return_value = mock_client

        svc = GoogleOAuthService(db=MagicMock())
        result = await svc.get_user_info_from_access_token("bad-token")

        assert result is None

    @patch("app.services.google_oauth_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_exception_returns_none(self, mock_client_cls):
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=Exception("timeout"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        svc = GoogleOAuthService(db=MagicMock())
        result = await svc.get_user_info_from_access_token("token")

        assert result is None

    @patch("app.services.google_oauth_service.httpx.AsyncClient")
    @pytest.mark.asyncio
    async def test_missing_optional_fields_default_correctly(self, mock_client_cls):
        data = {"id": "g-1", "email": "bob@example.com"}
        response = _mock_httpx_response(200, data)
        mock_client = _mock_async_client(response, "get")
        mock_client_cls.return_value = mock_client

        svc = GoogleOAuthService(db=MagicMock())
        result = await svc.get_user_info_from_access_token("token")

        assert result.verified_email is False
        assert result.name == ""
        assert result.given_name is None
        assert result.family_name is None
        assert result.picture is None


# ======================================================================
# TestVerifyGoogleToken
# ======================================================================

class TestVerifyGoogleToken:
    """Tests for verify_google_token."""

    @patch("app.services.google_oauth_service.settings")
    @patch("app.services.google_oauth_service.id_token.verify_oauth2_token")
    @pytest.mark.asyncio
    async def test_valid_token_accounts_google(self, mock_verify, mock_settings):
        mock_settings.GOOGLE_CLIENT_ID = "cid"
        mock_verify.return_value = {
            "iss": "accounts.google.com",
            "sub": "sub-123",
            "email": "user@test.com",
            "email_verified": True,
            "name": "Full Name",
            "given_name": "Full",
            "family_name": "Name",
            "picture": "https://pic.url",
        }

        svc = GoogleOAuthService(db=MagicMock())
        result = await svc.verify_google_token("valid-id-token")

        assert isinstance(result, GoogleUserInfo)
        assert result.id == "sub-123"
        assert result.email == "user@test.com"
        assert result.verified_email is True

    @patch("app.services.google_oauth_service.settings")
    @patch("app.services.google_oauth_service.id_token.verify_oauth2_token")
    @pytest.mark.asyncio
    async def test_valid_token_https_issuer(self, mock_verify, mock_settings):
        mock_settings.GOOGLE_CLIENT_ID = "cid"
        mock_verify.return_value = {
            "iss": "https://accounts.google.com",
            "sub": "sub-456",
            "email": "u2@test.com",
        }

        svc = GoogleOAuthService(db=MagicMock())
        result = await svc.verify_google_token("token")

        assert result is not None
        assert result.id == "sub-456"

    @patch("app.services.google_oauth_service.settings")
    @patch("app.services.google_oauth_service.id_token.verify_oauth2_token")
    @pytest.mark.asyncio
    async def test_invalid_issuer_returns_none(self, mock_verify, mock_settings):
        mock_settings.GOOGLE_CLIENT_ID = "cid"
        mock_verify.return_value = {
            "iss": "https://evil.com",
            "sub": "sub-1",
            "email": "e@evil.com",
        }

        svc = GoogleOAuthService(db=MagicMock())
        result = await svc.verify_google_token("token")

        assert result is None

    @patch("app.services.google_oauth_service.settings")
    @patch("app.services.google_oauth_service.id_token.verify_oauth2_token")
    @pytest.mark.asyncio
    async def test_value_error_returns_none(self, mock_verify, mock_settings):
        mock_settings.GOOGLE_CLIENT_ID = "cid"
        mock_verify.side_effect = ValueError("Invalid token")

        svc = GoogleOAuthService(db=MagicMock())
        result = await svc.verify_google_token("bad-token")

        assert result is None

    @patch("app.services.google_oauth_service.settings")
    @patch("app.services.google_oauth_service.id_token.verify_oauth2_token")
    @pytest.mark.asyncio
    async def test_missing_optional_fields(self, mock_verify, mock_settings):
        mock_settings.GOOGLE_CLIENT_ID = "cid"
        mock_verify.return_value = {
            "iss": "accounts.google.com",
            "sub": "sub-789",
            "email": "min@test.com",
        }

        svc = GoogleOAuthService(db=MagicMock())
        result = await svc.verify_google_token("token")

        assert result.verified_email is False
        assert result.name == ""
        assert result.given_name is None
        assert result.family_name is None
        assert result.picture is None


# ======================================================================
# TestGetUserByGoogleId
# ======================================================================

class TestGetUserByGoogleId:
    """Tests for get_user_by_google_id."""

    def test_found(self):
        user = _make_user(google_id="g-111")
        db = MagicMock()
        db.query.return_value = _chain(first=user)

        svc = GoogleOAuthService(db=db)
        result = svc.get_user_by_google_id("g-111")

        assert result is user
        db.query.assert_called_once_with(User)

    def test_not_found(self):
        db = MagicMock()
        db.query.return_value = _chain(first=None)

        svc = GoogleOAuthService(db=db)
        result = svc.get_user_by_google_id("nonexistent")

        assert result is None


# ======================================================================
# TestGetUserByEmail
# ======================================================================

class TestGetUserByEmail:
    """Tests for get_user_by_email."""

    def test_found(self):
        user = _make_user(email="found@test.com")
        db = MagicMock()
        db.query.return_value = _chain(first=user)

        svc = GoogleOAuthService(db=db)
        result = svc.get_user_by_email("found@test.com")

        assert result is user

    def test_not_found(self):
        db = MagicMock()
        db.query.return_value = _chain(first=None)

        svc = GoogleOAuthService(db=db)
        result = svc.get_user_by_email("missing@test.com")

        assert result is None


# ======================================================================
# TestCreateUserFromGoogle
# ======================================================================

class TestCreateUserFromGoogle:
    """Tests for create_user_from_google."""

    def test_creates_user_with_given_name(self):
        db = MagicMock()
        info = _make_google_info(given_name="Alice", family_name="Wonderland", verified_email=True)

        svc = GoogleOAuthService(db=db)
        user = svc.create_user_from_google(info)

        assert isinstance(user, User)
        assert user.email == "test@example.com"
        assert user.google_id == "google-123"
        assert user.first_name == "Alice"
        assert user.last_name == "Wonderland"
        assert user.status == UserStatus.ACTIVE
        assert user.is_email_verified is True
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_creates_user_pending_when_not_verified(self):
        db = MagicMock()
        info = _make_google_info(verified_email=False)

        svc = GoogleOAuthService(db=db)
        user = svc.create_user_from_google(info)

        assert user.status == UserStatus.PENDING
        assert user.is_email_verified is False

    def test_first_name_falls_back_to_name_split(self):
        db = MagicMock()
        info = _make_google_info(given_name=None, name="Fullname Only")

        svc = GoogleOAuthService(db=db)
        user = svc.create_user_from_google(info)

        assert user.first_name == "Fullname"

    def test_last_name_from_name_split(self):
        db = MagicMock()
        info = _make_google_info(family_name=None, name="First Last")

        svc = GoogleOAuthService(db=db)
        user = svc.create_user_from_google(info)

        assert user.last_name == "Last"

    def test_last_name_empty_when_single_word_name(self):
        db = MagicMock()
        info = _make_google_info(family_name=None, name="Mononym")

        svc = GoogleOAuthService(db=db)
        user = svc.create_user_from_google(info)

        assert user.last_name == ""

    def test_avatar_url_set(self):
        db = MagicMock()
        info = _make_google_info(picture="https://pic.url/avatar.jpg")

        svc = GoogleOAuthService(db=db)
        user = svc.create_user_from_google(info)

        assert user.avatar_url == "https://pic.url/avatar.jpg"


# ======================================================================
# TestLinkGoogleAccount
# ======================================================================

class TestLinkGoogleAccount:
    """Tests for link_google_account."""

    def test_sets_google_id(self):
        db = MagicMock()
        user = _make_user(google_id=None)
        info = _make_google_info(id="g-new")

        svc = GoogleOAuthService(db=db)
        result = svc.link_google_account(user, info)

        assert user.google_id == "g-new"
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(user)
        assert result is user

    def test_sets_avatar_when_user_has_none(self):
        db = MagicMock()
        user = _make_user(avatar_url=None)
        info = _make_google_info(picture="https://new-pic.url")

        svc = GoogleOAuthService(db=db)
        svc.link_google_account(user, info)

        assert user.avatar_url == "https://new-pic.url"

    def test_does_not_overwrite_existing_avatar(self):
        db = MagicMock()
        user = _make_user(avatar_url="https://existing-pic.url")
        info = _make_google_info(picture="https://new-pic.url")

        svc = GoogleOAuthService(db=db)
        svc.link_google_account(user, info)

        assert user.avatar_url == "https://existing-pic.url"

    def test_does_not_set_avatar_when_google_has_none(self):
        db = MagicMock()
        user = _make_user(avatar_url=None)
        info = _make_google_info(picture=None)

        svc = GoogleOAuthService(db=db)
        svc.link_google_account(user, info)

        assert user.avatar_url is None

    def test_verifies_email_and_activates_pending_user(self):
        db = MagicMock()
        user = _make_user(is_email_verified=False, status=UserStatus.PENDING)
        info = _make_google_info(verified_email=True)

        svc = GoogleOAuthService(db=db)
        svc.link_google_account(user, info)

        assert user.is_email_verified is True
        assert user.status == UserStatus.ACTIVE

    def test_does_not_change_already_verified(self):
        db = MagicMock()
        user = _make_user(is_email_verified=True, status=UserStatus.ACTIVE)
        info = _make_google_info(verified_email=True)

        svc = GoogleOAuthService(db=db)
        svc.link_google_account(user, info)

        # Should remain unchanged — the condition `not user.is_email_verified` is False
        assert user.is_email_verified is True
        assert user.status == UserStatus.ACTIVE

    def test_unverified_google_does_not_verify_user(self):
        db = MagicMock()
        user = _make_user(is_email_verified=False, status=UserStatus.PENDING)
        info = _make_google_info(verified_email=False)

        svc = GoogleOAuthService(db=db)
        svc.link_google_account(user, info)

        assert user.is_email_verified is False
        assert user.status == UserStatus.PENDING


# ======================================================================
# TestAuthenticateWithGoogle
# ======================================================================

class TestAuthenticateWithGoogle:
    """Tests for authenticate_with_google."""

    def _service(self):
        return GoogleOAuthService(db=MagicMock())

    # ---- Auth-code flow (credential starts with "4/") ----

    @pytest.mark.asyncio
    async def test_auth_code_flow_new_user(self):
        svc = self._service()
        info = _make_google_info()
        new_user = _make_user()

        with patch.object(svc, "exchange_code_for_tokens", new=AsyncMock(return_value={"access_token": "at"})), \
             patch.object(svc, "get_user_info_from_access_token", new=AsyncMock(return_value=info)), \
             patch.object(svc, "verify_google_token", new=AsyncMock()) as mock_verify, \
             patch.object(svc, "get_user_by_google_id", return_value=None), \
             patch.object(svc, "get_user_by_email", return_value=None), \
             patch.object(svc, "create_user_from_google", return_value=new_user):

            user, is_new = await svc.authenticate_with_google("4/auth-code")

            assert user is new_user
            assert is_new is True
            mock_verify.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_auth_code_flow_existing_user_by_google_id(self):
        svc = self._service()
        info = _make_google_info()
        existing_user = _make_user(google_id="google-123")

        with patch.object(svc, "exchange_code_for_tokens", new=AsyncMock(return_value={"access_token": "at"})), \
             patch.object(svc, "get_user_info_from_access_token", new=AsyncMock(return_value=info)), \
             patch.object(svc, "get_user_by_google_id", return_value=existing_user):

            user, is_new = await svc.authenticate_with_google("4/code")

            assert user is existing_user
            assert is_new is False

    @pytest.mark.asyncio
    async def test_auth_code_flow_links_existing_email_user(self):
        svc = self._service()
        info = _make_google_info()
        email_user = _make_user(email="test@example.com")
        linked_user = _make_user(google_id="google-123")

        with patch.object(svc, "exchange_code_for_tokens", new=AsyncMock(return_value={"access_token": "at"})), \
             patch.object(svc, "get_user_info_from_access_token", new=AsyncMock(return_value=info)), \
             patch.object(svc, "get_user_by_google_id", return_value=None), \
             patch.object(svc, "get_user_by_email", return_value=email_user), \
             patch.object(svc, "link_google_account", return_value=linked_user):

            user, is_new = await svc.authenticate_with_google("4/code")

            assert user is linked_user
            assert is_new is False

    # ---- Short credential (len < 500) treated as auth code ----

    @pytest.mark.asyncio
    async def test_short_credential_treated_as_auth_code(self):
        svc = self._service()
        info = _make_google_info()
        new_user = _make_user()
        short_cred = "short-credential"
        assert len(short_cred) < 500

        with patch.object(svc, "exchange_code_for_tokens", new=AsyncMock(return_value={"access_token": "at"})) as mock_exchange, \
             patch.object(svc, "get_user_info_from_access_token", new=AsyncMock(return_value=info)), \
             patch.object(svc, "get_user_by_google_id", return_value=None), \
             patch.object(svc, "get_user_by_email", return_value=None), \
             patch.object(svc, "create_user_from_google", return_value=new_user):

            user, is_new = await svc.authenticate_with_google(short_cred)

            assert user is new_user
            mock_exchange.assert_awaited_once_with(short_cred)

    # ---- Code exchange fails → falls back to ID token ----

    @pytest.mark.asyncio
    async def test_code_exchange_fails_falls_back_to_id_token(self):
        svc = self._service()
        info = _make_google_info()
        new_user = _make_user()

        with patch.object(svc, "exchange_code_for_tokens", new=AsyncMock(return_value=None)), \
             patch.object(svc, "get_user_info_from_access_token", new=AsyncMock()) as mock_userinfo, \
             patch.object(svc, "verify_google_token", new=AsyncMock(return_value=info)), \
             patch.object(svc, "get_user_by_google_id", return_value=None), \
             patch.object(svc, "get_user_by_email", return_value=None), \
             patch.object(svc, "create_user_from_google", return_value=new_user):

            user, is_new = await svc.authenticate_with_google("4/bad-code")

            assert user is new_user
            assert is_new is True
            mock_userinfo.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_code_exchange_no_access_token_falls_back(self):
        svc = self._service()
        info = _make_google_info()
        new_user = _make_user()

        with patch.object(svc, "exchange_code_for_tokens", new=AsyncMock(return_value={"refresh_token": "rt"})), \
             patch.object(svc, "get_user_info_from_access_token", new=AsyncMock()) as mock_userinfo, \
             patch.object(svc, "verify_google_token", new=AsyncMock(return_value=info)), \
             patch.object(svc, "get_user_by_google_id", return_value=None), \
             patch.object(svc, "get_user_by_email", return_value=None), \
             patch.object(svc, "create_user_from_google", return_value=new_user):

            user, is_new = await svc.authenticate_with_google("4/code")

            assert user is new_user
            mock_userinfo.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_userinfo_fails_falls_back_to_id_token(self):
        svc = self._service()
        info = _make_google_info()
        new_user = _make_user()

        with patch.object(svc, "exchange_code_for_tokens", new=AsyncMock(return_value={"access_token": "at"})), \
             patch.object(svc, "get_user_info_from_access_token", new=AsyncMock(return_value=None)), \
             patch.object(svc, "verify_google_token", new=AsyncMock(return_value=info)), \
             patch.object(svc, "get_user_by_google_id", return_value=None), \
             patch.object(svc, "get_user_by_email", return_value=None), \
             patch.object(svc, "create_user_from_google", return_value=new_user):

            user, is_new = await svc.authenticate_with_google("4/code")

            assert user is new_user
            assert is_new is True

    # ---- Long credential → skip code exchange, go straight to ID token ----

    @pytest.mark.asyncio
    async def test_long_credential_skips_code_exchange(self):
        svc = self._service()
        info = _make_google_info()
        new_user = _make_user()
        long_cred = "x" * 600  # len >= 500 and doesn't start with "4/"

        with patch.object(svc, "exchange_code_for_tokens", new=AsyncMock()) as mock_exchange, \
             patch.object(svc, "get_user_info_from_access_token", new=AsyncMock()) as mock_userinfo, \
             patch.object(svc, "verify_google_token", new=AsyncMock(return_value=info)), \
             patch.object(svc, "get_user_by_google_id", return_value=None), \
             patch.object(svc, "get_user_by_email", return_value=None), \
             patch.object(svc, "create_user_from_google", return_value=new_user):

            user, is_new = await svc.authenticate_with_google(long_cred)

            assert user is new_user
            mock_exchange.assert_not_awaited()
            mock_userinfo.assert_not_awaited()

    # ---- Both flows fail → (None, False) ----

    @pytest.mark.asyncio
    async def test_all_flows_fail_returns_none(self):
        svc = self._service()

        with patch.object(svc, "exchange_code_for_tokens", new=AsyncMock(return_value=None)), \
             patch.object(svc, "verify_google_token", new=AsyncMock(return_value=None)):

            user, is_new = await svc.authenticate_with_google("4/bad")

            assert user is None
            assert is_new is False

    @pytest.mark.asyncio
    async def test_id_token_only_fails_returns_none(self):
        svc = self._service()
        long_cred = "x" * 600

        with patch.object(svc, "exchange_code_for_tokens", new=AsyncMock()) as mock_exchange, \
             patch.object(svc, "verify_google_token", new=AsyncMock(return_value=None)):

            user, is_new = await svc.authenticate_with_google(long_cred)

            assert user is None
            assert is_new is False
            mock_exchange.assert_not_awaited()
