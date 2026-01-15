"""Session service for managing active user sessions."""

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import and_
from user_agents import parse as parse_user_agent

from app.models.session import Session
from app.core.config import settings


def hash_token(token: str) -> str:
    """Create a hash of a token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def parse_device_info(user_agent_string: Optional[str]) -> Tuple[str, str]:
    """Parse user agent string to extract device name and type."""
    if not user_agent_string:
        return "Unknown Device", "unknown"
    
    try:
        ua = parse_user_agent(user_agent_string)
        
        # Determine device type
        if ua.is_mobile:
            device_type = "mobile"
        elif ua.is_tablet:
            device_type = "tablet"
        elif ua.is_pc:
            device_type = "desktop"
        else:
            device_type = "unknown"
        
        # Build device name
        browser = ua.browser.family
        browser_version = ua.browser.version_string
        os = ua.os.family
        os_version = ua.os.version_string
        
        if browser and os:
            device_name = f"{browser} on {os}"
            if os_version:
                device_name = f"{browser} on {os} {os_version}"
        elif browser:
            device_name = browser
        elif os:
            device_name = os
        else:
            device_name = "Unknown Device"
        
        return device_name, device_type
    except Exception:
        return "Unknown Device", "unknown"


class SessionService:
    """Service for managing user sessions."""
    
    def __init__(self, db: DBSession):
        self.db = db
    
    def create_session(
        self,
        user_id: str,
        refresh_token: str,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
        location: Optional[str] = None,
    ) -> Session:
        """Create a new session for a user."""
        device_name, device_type = parse_device_info(user_agent)
        
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        
        session = Session(
            user_id=user_id,
            refresh_token_hash=hash_token(refresh_token),
            device_name=device_name,
            device_type=device_type,
            ip_address=ip_address,
            user_agent=user_agent,
            location=location,
            is_active=True,
            is_current=True,
            expires_at=expires_at,
        )
        
        # Mark other sessions as not current
        self.db.query(Session).filter(
            and_(
                Session.user_id == user_id,
                Session.is_current == True
            )
        ).update({"is_current": False})
        
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        
        return session
    
    def get_session_by_token(self, refresh_token: str) -> Optional[Session]:
        """Get a session by its refresh token."""
        token_hash = hash_token(refresh_token)
        return self.db.query(Session).filter(
            Session.refresh_token_hash == token_hash
        ).first()
    
    def get_user_sessions(self, user_id: str, include_inactive: bool = False) -> List[Session]:
        """Get all sessions for a user."""
        query = self.db.query(Session).filter(Session.user_id == user_id)
        
        if not include_inactive:
            query = query.filter(
                and_(
                    Session.is_active == True,
                    Session.revoked_at.is_(None),
                    Session.expires_at > datetime.now(timezone.utc)
                )
            )
        
        return query.order_by(Session.last_active_at.desc()).all()
    
    def update_session_activity(self, session: Session) -> Session:
        """Update the last active timestamp for a session."""
        session.last_active_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(session)
        return session
    
    def revoke_session(self, session_id: str, user_id: str) -> bool:
        """Revoke a specific session."""
        session = self.db.query(Session).filter(
            and_(
                Session.id == session_id,
                Session.user_id == user_id
            )
        ).first()
        
        if not session:
            return False
        
        session.is_active = False
        session.revoked_at = datetime.now(timezone.utc)
        self.db.commit()
        
        return True
    
    def revoke_all_sessions(self, user_id: str, except_session_id: Optional[str] = None) -> int:
        """Revoke all sessions for a user, optionally keeping one."""
        query = self.db.query(Session).filter(
            and_(
                Session.user_id == user_id,
                Session.is_active == True
            )
        )
        
        if except_session_id:
            query = query.filter(Session.id != except_session_id)
        
        now = datetime.now(timezone.utc)
        count = query.update({
            "is_active": False,
            "revoked_at": now
        })
        
        self.db.commit()
        return count
    
    def cleanup_expired_sessions(self, user_id: Optional[str] = None) -> int:
        """Clean up expired sessions."""
        query = self.db.query(Session).filter(
            Session.expires_at < datetime.now(timezone.utc)
        )
        
        if user_id:
            query = query.filter(Session.user_id == user_id)
        
        count = query.delete()
        self.db.commit()
        return count
    
    def validate_session(self, refresh_token: str) -> Optional[Session]:
        """Validate a session by its refresh token."""
        session = self.get_session_by_token(refresh_token)
        
        if not session:
            return None
        
        if not session.is_valid:
            return None
        
        # Update last active time
        self.update_session_activity(session)
        
        return session
