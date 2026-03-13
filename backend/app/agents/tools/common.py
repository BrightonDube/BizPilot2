"""
backend/app/agents/tools/common.py

Shared utilities for agent tools.
"""

from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User
from app.services.ai_service import AIService


def get_business_id_for_user(db: Session, user: User) -> Optional[str]:
    """
    Resolve the business_id for a user. Returns None if not found.
    Used by tools to ensure data isolation.
    """
    ai_svc = AIService(db)
    business = ai_svc._get_business_for_user(user.id)
    return str(business.id) if business else None
