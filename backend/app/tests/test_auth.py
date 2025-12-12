"""Tests for authentication system."""

import pytest


class TestSecurityModule:
    """Tests for security utilities."""

    def test_password_hashing(self):
        """Test password hashing and verification."""
        from app.core.security import get_password_hash, verify_password
        
        password = "test_password"  # Keep it short and simple
        hashed = get_password_hash(password)
        
        assert hashed != password
        assert verify_password(password, hashed)
        assert not verify_password("wrong_password", hashed)

    def test_create_access_token(self):
        """Test access token creation."""
        from app.core.security import create_access_token, decode_token
        
        data = {"sub": "test_user_id"}
        token = create_access_token(data)
        
        assert token is not None
        payload = decode_token(token)
        assert payload["sub"] == "test_user_id"
        assert payload["type"] == "access"

    def test_create_refresh_token(self):
        """Test refresh token creation."""
        from app.core.security import create_refresh_token, decode_token
        
        data = {"sub": "test_user_id"}
        token = create_refresh_token(data)
        
        assert token is not None
        payload = decode_token(token)
        assert payload["sub"] == "test_user_id"
        assert payload["type"] == "refresh"

    def test_email_verification_token(self):
        """Test email verification token."""
        from app.core.security import create_email_verification_token, verify_email_token
        
        email = "test@example.com"
        token = create_email_verification_token(email)
        
        assert token is not None
        verified_email = verify_email_token(token)
        assert verified_email == email

    def test_password_reset_token(self):
        """Test password reset token."""
        from app.core.security import create_password_reset_token, verify_password_reset_token
        
        email = "test@example.com"
        token = create_password_reset_token(email)
        
        assert token is not None
        verified_email = verify_password_reset_token(token)
        assert verified_email == email

    def test_decode_invalid_token(self):
        """Test decoding invalid token returns None."""
        from app.core.security import decode_token
        
        result = decode_token("invalid_token")
        assert result is None


class TestAuthSchemas:
    """Tests for authentication schemas."""

    def test_user_create_schema(self):
        """Test UserCreate schema validation."""
        from app.schemas.auth import UserCreate
        
        user = UserCreate(
            email="test@example.com",
            password="password123",
            first_name="Test",
            last_name="User",
        )
        
        assert user.email == "test@example.com"
        assert user.first_name == "Test"
        assert user.last_name == "User"

    def test_user_create_requires_valid_email(self):
        """Test UserCreate requires valid email."""
        from app.schemas.auth import UserCreate
        from pydantic import ValidationError
        
        with pytest.raises(ValidationError):
            UserCreate(
                email="invalid-email",
                password="password123",
                first_name="Test",
                last_name="User",
            )

    def test_user_create_requires_min_password_length(self):
        """Test UserCreate requires minimum password length."""
        from app.schemas.auth import UserCreate
        from pydantic import ValidationError
        
        with pytest.raises(ValidationError):
            UserCreate(
                email="test@example.com",
                password="short",  # Too short
                first_name="Test",
                last_name="User",
            )

    def test_user_login_schema(self):
        """Test UserLogin schema."""
        from app.schemas.auth import UserLogin
        
        login = UserLogin(email="test@example.com", password="password123")
        assert login.email == "test@example.com"

    def test_token_schema(self):
        """Test Token schema."""
        from app.schemas.auth import Token
        
        token = Token(
            access_token="access_token",
            refresh_token="refresh_token",
        )
        assert token.token_type == "bearer"

    def test_user_response_schema(self):
        """Test UserResponse schema."""
        from app.schemas.auth import UserResponse
        
        response = UserResponse(
            id="123",
            email="test@example.com",
            first_name="Test",
            last_name="User",
            is_email_verified=False,
            status="pending",
        )
        assert response.id == "123"


class TestAuthEndpoints:
    """Tests for authentication API endpoints."""

    def test_auth_router_exists(self):
        """Test that auth router exists."""
        from app.api.auth import router
        assert router is not None

    def test_auth_router_has_register_route(self):
        """Test that register route is defined."""
        from app.api.auth import router
        routes = [r.path for r in router.routes]
        assert any("register" in route for route in routes)

    def test_auth_router_has_login_route(self):
        """Test that login route is defined."""
        from app.api.auth import router
        routes = [r.path for r in router.routes]
        assert any("login" in route for route in routes)

    def test_auth_router_has_refresh_route(self):
        """Test that refresh route is defined."""
        from app.api.auth import router
        routes = [r.path for r in router.routes]
        assert any("refresh" in route for route in routes)

    def test_auth_router_has_verify_email_route(self):
        """Test that verify-email route is defined."""
        from app.api.auth import router
        routes = [r.path for r in router.routes]
        assert any("verify-email" in route for route in routes)

    def test_auth_router_has_forgot_password_route(self):
        """Test that forgot-password route is defined."""
        from app.api.auth import router
        routes = [r.path for r in router.routes]
        assert any("forgot-password" in route for route in routes)

    def test_auth_router_has_reset_password_route(self):
        """Test that reset-password route is defined."""
        from app.api.auth import router
        routes = [r.path for r in router.routes]
        assert any("reset-password" in route for route in routes)

    def test_auth_router_has_me_route(self):
        """Test that me route is defined."""
        from app.api.auth import router
        routes = [r.path for r in router.routes]
        assert any("/me" in route for route in routes)


class TestAuthService:
    """Tests for AuthService class."""

    def test_auth_service_exists(self):
        """Test that AuthService can be imported."""
        from app.services.auth_service import AuthService
        assert AuthService is not None

    def test_auth_service_has_required_methods(self):
        """Test that AuthService has required methods."""
        from app.services.auth_service import AuthService
        
        assert hasattr(AuthService, "get_user_by_email")
        assert hasattr(AuthService, "get_user_by_id")
        assert hasattr(AuthService, "create_user")
        assert hasattr(AuthService, "authenticate_user")
        assert hasattr(AuthService, "verify_email")
        assert hasattr(AuthService, "update_password")
        assert hasattr(AuthService, "reset_password")


class TestAuthDependencies:
    """Tests for authentication dependencies."""

    def test_deps_module_exists(self):
        """Test that deps module can be imported."""
        from app.api.deps import get_current_user, get_current_active_user
        assert get_current_user is not None
        assert get_current_active_user is not None
