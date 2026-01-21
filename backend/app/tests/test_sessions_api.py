"""Tests for sessions API endpoints."""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from app.models.session import Session
from app.api.sessions import (
    SessionResponse,
    SessionListResponse,
    RevokeSessionResponse,
    RevokeAllResponse,
)


@pytest.fixture
def mock_session():
    """Create a mock session."""
    session = MagicMock(spec=Session)
    session.id = "550e8400-e29b-41d4-a716-446655440001"
    session.user_id = "550e8400-e29b-41d4-a716-446655440000"
    session.device_name = "Chrome on Windows"
    session.device_type = "desktop"
    session.ip_address = "192.168.1.1"
    session.location = "Cape Town, South Africa"
    session.is_current = True
    session.created_at = datetime.now(timezone.utc)
    session.last_active_at = datetime.now(timezone.utc)
    session.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    return session


class TestSessionResponseSchema:
    """Tests for session response schema."""
    
    def test_session_response_creation(self, mock_session):
        """Test creating a session response."""
        response = SessionResponse(
            id=str(mock_session.id),
            device_name=mock_session.device_name,
            device_type=mock_session.device_type,
            ip_address=mock_session.ip_address,
            location=mock_session.location,
            is_current=mock_session.is_current,
            created_at=mock_session.created_at,
            last_active_at=mock_session.last_active_at,
            expires_at=mock_session.expires_at,
        )
        
        assert response.device_name == "Chrome on Windows"
        assert response.device_type == "desktop"
        assert response.is_current is True
        assert response.ip_address == "192.168.1.1"
    
    def test_session_response_with_none_values(self):
        """Test session response with None values."""
        response = SessionResponse(
            id="test_id",
            device_name=None,
            device_type=None,
            ip_address=None,
            location=None,
            is_current=False,
            created_at=datetime.now(timezone.utc),
            last_active_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc),
        )
        
        assert response.device_name is None
        assert response.device_type is None
        assert response.is_current is False
    
    def test_session_list_response_empty(self):
        """Test session list response with no sessions."""
        response = SessionListResponse(
            sessions=[],
            total=0,
        )
        
        assert response.total == 0
        assert len(response.sessions) == 0
    
    def test_session_list_response_multiple(self, mock_session):
        """Test session list response with multiple sessions."""
        session_response = SessionResponse(
            id=str(mock_session.id),
            device_name=mock_session.device_name,
            device_type=mock_session.device_type,
            ip_address=mock_session.ip_address,
            location=mock_session.location,
            is_current=mock_session.is_current,
            created_at=mock_session.created_at,
            last_active_at=mock_session.last_active_at,
            expires_at=mock_session.expires_at,
        )
        
        response = SessionListResponse(
            sessions=[session_response, session_response],
            total=2,
        )
        
        assert response.total == 2
        assert len(response.sessions) == 2
    
    def test_revoke_session_response(self):
        """Test revoke session response."""
        response = RevokeSessionResponse(
            success=True,
            message="Session revoked successfully",
        )
        
        assert response.success is True
        assert "revoked" in response.message.lower()
    
    def test_revoke_all_response(self):
        """Test revoke all sessions response."""
        response = RevokeAllResponse(
            success=True,
            revoked_count=5,
            message="Revoked 5 session(s)",
        )
        
        assert response.success is True
        assert response.revoked_count == 5
        assert "5" in response.message
    
    def test_revoke_all_response_zero_revoked(self):
        """Test revoke all response with zero sessions revoked."""
        response = RevokeAllResponse(
            success=True,
            revoked_count=0,
            message="Revoked 0 session(s)",
        )
        
        assert response.success is True
        assert response.revoked_count == 0


class TestSessionResponseSerialization:
    """Tests for session response serialization."""
    
    def test_session_response_dict_conversion(self, mock_session):
        """Test converting session response to dict."""
        response = SessionResponse(
            id=str(mock_session.id),
            device_name=mock_session.device_name,
            device_type=mock_session.device_type,
            ip_address=mock_session.ip_address,
            location=mock_session.location,
            is_current=mock_session.is_current,
            created_at=mock_session.created_at,
            last_active_at=mock_session.last_active_at,
            expires_at=mock_session.expires_at,
        )
        
        response_dict = response.model_dump()
        
        assert "id" in response_dict
        assert "device_name" in response_dict
        assert "is_current" in response_dict
        assert response_dict["is_current"] is True
    
    def test_session_list_response_dict_conversion(self, mock_session):
        """Test converting session list response to dict."""
        session_response = SessionResponse(
            id=str(mock_session.id),
            device_name=mock_session.device_name,
            device_type=mock_session.device_type,
            ip_address=mock_session.ip_address,
            location=mock_session.location,
            is_current=mock_session.is_current,
            created_at=mock_session.created_at,
            last_active_at=mock_session.last_active_at,
            expires_at=mock_session.expires_at,
        )
        
        response = SessionListResponse(
            sessions=[session_response],
            total=1,
        )
        
        response_dict = response.model_dump()
        
        assert "sessions" in response_dict
        assert "total" in response_dict
        assert response_dict["total"] == 1
        assert len(response_dict["sessions"]) == 1

