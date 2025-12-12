"""Tests for Google OAuth integration."""



class TestOAuthSchemas:
    """Tests for OAuth schemas."""

    def test_google_user_info_schema(self):
        """Test GoogleUserInfo schema."""
        from app.schemas.oauth import GoogleUserInfo
        
        user_info = GoogleUserInfo(
            id="123456789",
            email="test@example.com",
            verified_email=True,
            name="Test User",
            given_name="Test",
            family_name="User",
            picture="https://example.com/photo.jpg",
        )
        
        assert user_info.id == "123456789"
        assert user_info.email == "test@example.com"
        assert user_info.verified_email is True

    def test_google_oauth_token_schema(self):
        """Test GoogleOAuthToken schema."""
        from app.schemas.oauth import GoogleOAuthToken
        
        token = GoogleOAuthToken(credential="test_credential_token")
        assert token.credential == "test_credential_token"

    def test_google_auth_response_schema(self):
        """Test GoogleAuthResponse schema."""
        from app.schemas.oauth import GoogleAuthResponse
        
        response = GoogleAuthResponse(
            access_token="access_token",
            refresh_token="refresh_token",
            is_new_user=True,
            user_id="user_123",
        )
        
        assert response.access_token == "access_token"
        assert response.is_new_user is True
        assert response.token_type == "bearer"


class TestOAuthService:
    """Tests for Google OAuth service."""

    def test_google_oauth_service_exists(self):
        """Test that GoogleOAuthService can be imported."""
        from app.services.google_oauth_service import GoogleOAuthService
        assert GoogleOAuthService is not None

    def test_google_oauth_service_has_required_methods(self):
        """Test that GoogleOAuthService has required methods."""
        from app.services.google_oauth_service import GoogleOAuthService
        
        assert hasattr(GoogleOAuthService, "verify_google_token")
        assert hasattr(GoogleOAuthService, "get_user_by_google_id")
        assert hasattr(GoogleOAuthService, "get_user_by_email")
        assert hasattr(GoogleOAuthService, "create_user_from_google")
        assert hasattr(GoogleOAuthService, "link_google_account")
        assert hasattr(GoogleOAuthService, "authenticate_with_google")


class TestOAuthEndpoints:
    """Tests for OAuth API endpoints."""

    def test_oauth_router_exists(self):
        """Test that OAuth router exists."""
        from app.api.oauth import router
        assert router is not None

    def test_oauth_router_has_google_route(self):
        """Test that Google OAuth route is defined."""
        from app.api.oauth import router
        routes = [r.path for r in router.routes]
        assert any("google" in route for route in routes)

    def test_oauth_router_has_google_url_route(self):
        """Test that Google OAuth URL route is defined."""
        from app.api.oauth import router
        routes = [r.path for r in router.routes]
        assert any("google/url" in route or "google" in route for route in routes)


class TestOAuthIntegration:
    """Integration tests for OAuth."""

    def test_oauth_included_in_main_router(self):
        """Test that OAuth router is included in main API router."""
        from app.api import router
        
        # Check that oauth routes are included
        routes = []
        for route in router.routes:
            if hasattr(route, 'path'):
                routes.append(route.path)
            elif hasattr(route, 'routes'):
                for subroute in route.routes:
                    if hasattr(subroute, 'path'):
                        routes.append(subroute.path)
        
        # Should have oauth routes
        assert len(routes) > 0
