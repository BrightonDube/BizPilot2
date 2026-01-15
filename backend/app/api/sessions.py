"""Sessions API endpoints for managing active user sessions."""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.session import Session as SessionModel
from app.services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["Sessions"])


class SessionResponse(BaseModel):
    """Response schema for a session."""
    id: str
    device_name: Optional[str]
    device_type: Optional[str]
    ip_address: Optional[str]
    location: Optional[str]
    is_current: bool
    created_at: datetime
    last_active_at: datetime
    expires_at: datetime
    
    class Config:
        from_attributes = True


class SessionListResponse(BaseModel):
    """Response schema for list of sessions."""
    sessions: List[SessionResponse]
    total: int


class RevokeSessionResponse(BaseModel):
    """Response schema for revoking a session."""
    success: bool
    message: str


class RevokeAllResponse(BaseModel):
    """Response schema for revoking all sessions."""
    success: bool
    revoked_count: int
    message: str


def _session_to_response(session: SessionModel) -> SessionResponse:
    """Convert session model to response schema."""
    return SessionResponse(
        id=str(session.id),
        device_name=session.device_name,
        device_type=session.device_type,
        ip_address=session.ip_address,
        location=session.location,
        is_current=session.is_current,
        created_at=session.created_at,
        last_active_at=session.last_active_at,
        expires_at=session.expires_at,
    )


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    List all active sessions for the current user.
    
    Returns a list of active sessions with device info, IP addresses,
    and timestamps. The current session is marked with is_current=True.
    """
    service = SessionService(db)
    sessions = service.get_user_sessions(str(current_user.id))
    
    return SessionListResponse(
        sessions=[_session_to_response(s) for s in sessions],
        total=len(sessions),
    )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get details of a specific session.
    
    Only returns sessions belonging to the current user.
    """
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id,
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    
    return _session_to_response(session)


@router.delete("/{session_id}", response_model=RevokeSessionResponse)
async def revoke_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Revoke (logout) a specific session.
    
    This will invalidate the session's refresh token, forcing
    the device to re-authenticate.
    """
    service = SessionService(db)
    success = service.revoke_session(session_id, str(current_user.id))
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    
    return RevokeSessionResponse(
        success=True,
        message="Session revoked successfully",
    )


@router.delete("", response_model=RevokeAllResponse)
async def revoke_all_sessions(
    keep_current: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """
    Revoke all sessions for the current user.
    
    By default, keeps the current session active (keep_current=True).
    Set keep_current=False to logout from all devices including this one.
    """
    service = SessionService(db)
    
    # Find current session if we need to keep it
    current_session_id = None
    if keep_current and request:
        # Try to get the current session from the authorization header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            # We'd need to track which session this token belongs to
            # For now, we'll find the most recently active session
            sessions = service.get_user_sessions(str(current_user.id))
            for s in sessions:
                if s.is_current:
                    current_session_id = str(s.id)
                    break
    
    revoked_count = service.revoke_all_sessions(
        str(current_user.id),
        except_session_id=current_session_id if keep_current else None,
    )
    
    return RevokeAllResponse(
        success=True,
        revoked_count=revoked_count,
        message=f"Revoked {revoked_count} session(s)",
    )
