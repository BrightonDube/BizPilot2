"""Tests for session management functionality."""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from sqlalchemy.orm import Session as DBSession

from app.models.session import Session
from app.services.session_service import (
    SessionService,
    hash_token,
    parse_device_info,
)


class TestHashToken:
    """Tests for token hashing."""
    
    def test_hash_token_creates_consistent_hash(self):
        """Test that hashing the same token produces the same hash."""
        token = "test_token_12345"
        hash1 = hash_token(token)
        hash2 = hash_token(token)
        assert hash1 == hash2
    
    def test_hash_token_different_tokens_different_hashes(self):
        """Test that different tokens produce different hashes."""
        token1 = "token_1"
        token2 = "token_2"
        assert hash_token(token1) != hash_token(token2)
    
    def test_hash_token_is_sha256(self):
        """Test that hash is SHA256 (64 hex characters)."""
        token = "test_token"
        hashed = hash_token(token)
        assert len(hashed) == 64
        assert all(c in "0123456789abcdef" for c in hashed)


class TestParseDeviceInfo:
    """Tests for device info parsing."""
    
    def test_parse_device_info_chrome_desktop(self):
        """Test parsing Chrome on Windows."""
        ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        device_name, device_type = parse_device_info(ua)
        assert "Chrome" in device_name
        assert "Windows" in device_name
        assert device_type == "desktop"
    
    def test_parse_device_info_mobile(self):
        """Test parsing mobile user agent."""
        ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1"
        device_name, device_type = parse_device_info(ua)
        assert device_type == "mobile"
    
    def test_parse_device_info_tablet(self):
        """Test parsing tablet user agent."""
        ua = "Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1"
        device_name, device_type = parse_device_info(ua)
        assert device_type == "tablet"
    
    def test_parse_device_info_none_user_agent(self):
        """Test parsing with None user agent."""
        device_name, device_type = parse_device_info(None)
        assert device_name == "Unknown Device"
        assert device_type == "unknown"
    
    def test_parse_device_info_empty_user_agent(self):
        """Test parsing with empty user agent."""
        device_name, device_type = parse_device_info("")
        assert device_name == "Unknown Device"
        assert device_type == "unknown"
    
    def test_parse_device_info_invalid_user_agent(self):
        """Test parsing with invalid user agent."""
        device_name, device_type = parse_device_info("invalid user agent string")
        # user_agents library parses unknown agents as "Other on Other"
        assert device_name is not None
        assert device_type == "unknown"


class TestSessionService:
    """Tests for SessionService."""
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        return MagicMock(spec=DBSession)
    
    @pytest.fixture
    def service(self, mock_db):
        """Create a SessionService instance."""
        return SessionService(mock_db)
    
    @pytest.fixture
    def sample_user_id(self):
        """Sample user ID for testing."""
        return "550e8400-e29b-41d4-a716-446655440000"
    
    @pytest.fixture
    def sample_token(self):
        """Sample refresh token for testing."""
        return "refresh_token_sample_12345"
    
    def test_create_session(self, service, mock_db, sample_user_id, sample_token):
        """Test creating a new session."""
        # Mock the query and update operations
        mock_db.query.return_value.filter.return_value.update.return_value = None
        mock_db.add.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        session = service.create_session(
            user_id=sample_user_id,
            refresh_token=sample_token,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            ip_address="192.168.1.1",
            location="Cape Town, South Africa",
        )
        
        assert session.user_id == sample_user_id
        assert session.refresh_token_hash == hash_token(sample_token)
        assert session.is_active is True
        assert session.is_current is True
        assert session.ip_address == "192.168.1.1"
        assert session.location == "Cape Town, South Africa"
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called()
    
    def test_create_session_marks_other_sessions_not_current(self, service, mock_db, sample_user_id, sample_token):
        """Test that creating a session marks other sessions as not current."""
        mock_db.query.return_value.filter.return_value.update.return_value = 1
        mock_db.add.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        service.create_session(
            user_id=sample_user_id,
            refresh_token=sample_token,
        )
        
        # Verify that update was called to mark other sessions as not current
        mock_db.query.return_value.filter.return_value.update.assert_called_once()
    
    def test_get_session_by_token(self, service, mock_db, sample_token):
        """Test retrieving a session by token."""
        mock_session = MagicMock(spec=Session)
        mock_db.query.return_value.filter.return_value.first.return_value = mock_session
        
        result = service.get_session_by_token(sample_token)
        
        assert result == mock_session
        mock_db.query.assert_called_with(Session)
    
    def test_get_session_by_token_not_found(self, service, mock_db, sample_token):
        """Test retrieving a non-existent session."""
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        result = service.get_session_by_token(sample_token)
        
        assert result is None
    
    def test_get_user_sessions(self, service, mock_db, sample_user_id):
        """Test retrieving all sessions for a user."""
        mock_sessions = [MagicMock(spec=Session) for _ in range(3)]
        mock_db.query.return_value.filter.return_value.filter.return_value.order_by.return_value.all.return_value = mock_sessions
        
        result = service.get_user_sessions(sample_user_id)
        
        assert len(result) == 3
        assert result == mock_sessions
    
    def test_get_user_sessions_include_inactive(self, service, mock_db, sample_user_id):
        """Test retrieving sessions including inactive ones."""
        mock_sessions = [MagicMock(spec=Session) for _ in range(2)]
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = mock_sessions
        
        result = service.get_user_sessions(sample_user_id, include_inactive=True)
        
        assert len(result) == 2
    
    def test_update_session_activity(self, service, mock_db):
        """Test updating session activity timestamp."""
        mock_session = MagicMock(spec=Session)
        mock_session.last_active_at = datetime.now(timezone.utc) - timedelta(hours=1)
        
        service.update_session_activity(mock_session)
        
        assert mock_session.last_active_at is not None
        mock_db.commit.assert_called_once()
    
    def test_revoke_session(self, service, mock_db, sample_user_id):
        """Test revoking a specific session."""
        mock_session = MagicMock(spec=Session)
        mock_db.query.return_value.filter.return_value.first.return_value = mock_session
        
        result = service.revoke_session("session_id_123", sample_user_id)
        
        assert result is True
        assert mock_session.is_active is False
        assert mock_session.revoked_at is not None
        mock_db.commit.assert_called_once()
    
    def test_revoke_session_not_found(self, service, mock_db, sample_user_id):
        """Test revoking a non-existent session."""
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        result = service.revoke_session("nonexistent_id", sample_user_id)
        
        assert result is False
    
    def test_revoke_all_sessions(self, service, mock_db, sample_user_id):
        """Test revoking all sessions for a user."""
        mock_db.query.return_value.filter.return_value.update.return_value = 5
        
        count = service.revoke_all_sessions(sample_user_id)
        
        assert count == 5
        mock_db.commit.assert_called_once()
    
    def test_revoke_all_sessions_except_one(self, service, mock_db, sample_user_id):
        """Test revoking all sessions except one."""
        mock_db.query.return_value.filter.return_value.filter.return_value.update.return_value = 4
        
        count = service.revoke_all_sessions(sample_user_id, except_session_id="keep_this_id")
        
        assert count == 4
    
    def test_cleanup_expired_sessions(self, service, mock_db):
        """Test cleaning up expired sessions."""
        mock_db.query.return_value.filter.return_value.delete.return_value = 3
        
        count = service.cleanup_expired_sessions()
        
        assert count == 3
        mock_db.commit.assert_called_once()
    
    def test_cleanup_expired_sessions_for_user(self, service, mock_db, sample_user_id):
        """Test cleaning up expired sessions for a specific user."""
        mock_db.query.return_value.filter.return_value.filter.return_value.delete.return_value = 2
        
        count = service.cleanup_expired_sessions(sample_user_id)
        
        assert count == 2
    
    def test_validate_session_valid(self, service, mock_db, sample_token):
        """Test validating a valid session."""
        mock_session = MagicMock(spec=Session)
        mock_session.is_valid = True
        mock_db.query.return_value.filter.return_value.first.return_value = mock_session
        
        result = service.validate_session(sample_token)
        
        assert result == mock_session
        mock_db.commit.assert_called()
    
    def test_validate_session_invalid(self, service, mock_db, sample_token):
        """Test validating an invalid session."""
        mock_session = MagicMock(spec=Session)
        mock_session.is_valid = False
        mock_db.query.return_value.filter.return_value.first.return_value = mock_session
        
        result = service.validate_session(sample_token)
        
        assert result is None
    
    def test_validate_session_not_found(self, service, mock_db, sample_token):
        """Test validating a non-existent session."""
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        result = service.validate_session(sample_token)
        
        assert result is None


class TestSessionModel:
    """Tests for Session model."""
    
    def test_session_is_expired_true(self):
        """Test is_expired property when session is expired."""
        session = Session(
            user_id="user_123",
            refresh_token_hash="hash_123",
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        assert session.is_expired is True
    
    def test_session_is_expired_false(self):
        """Test is_expired property when session is not expired."""
        session = Session(
            user_id="user_123",
            refresh_token_hash="hash_123",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        assert session.is_expired is False
    
    def test_session_is_valid_true(self):
        """Test is_valid property when session is valid."""
        session = Session(
            user_id="user_123",
            refresh_token_hash="hash_123",
            is_active=True,
            revoked_at=None,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        assert session.is_valid is True
    
    def test_session_is_valid_false_inactive(self):
        """Test is_valid property when session is inactive."""
        session = Session(
            user_id="user_123",
            refresh_token_hash="hash_123",
            is_active=False,
            revoked_at=None,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        assert session.is_valid is False
    
    def test_session_is_valid_false_expired(self):
        """Test is_valid property when session is expired."""
        session = Session(
            user_id="user_123",
            refresh_token_hash="hash_123",
            is_active=True,
            revoked_at=None,
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        assert session.is_valid is False
    
    def test_session_is_valid_false_revoked(self):
        """Test is_valid property when session is revoked."""
        session = Session(
            user_id="user_123",
            refresh_token_hash="hash_123",
            is_active=True,
            revoked_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        assert session.is_valid is False
    
    def test_session_repr(self):
        """Test session string representation."""
        session = Session(
            id="550e8400-e29b-41d4-a716-446655440000",
            user_id="user_123",
            refresh_token_hash="hash_123",
            device_name="Chrome on Windows",
        )
        repr_str = repr(session)
        assert "Session" in repr_str
        assert "user_123" in repr_str
        assert "Chrome on Windows" in repr_str
