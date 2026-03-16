"""Minimal AIService for compatibility with agent system and user settings.

This service provides only the methods needed by the agent system and user settings.
The full AI chat functionality has been migrated to the agent system.
"""

from typing import Optional
from sqlalchemy.orm import Session

from app.models.user_settings import UserSettings, AIDataSharingLevel


class AIService:
    """Minimal AIService for compatibility with existing code."""
    
    def __init__(self, db: Session):
        self.db = db

    def get_or_create_user_settings(self, user_id: str) -> UserSettings:
        """Get or create user settings."""
        existing = (
            self.db.query(UserSettings)
            .filter(UserSettings.user_id == user_id, UserSettings.deleted_at.is_(None))
            .first()
        )
        if existing:
            return existing

        settings_row = UserSettings(user_id=user_id, ai_data_sharing_level=AIDataSharingLevel.NONE)
        self.db.add(settings_row)
        self.db.commit()
        self.db.refresh(settings_row)
        return settings_row

    def update_user_settings(self, user_id: str, ai_data_sharing_level: AIDataSharingLevel) -> UserSettings:
        """Update user settings."""
        settings_row = self.get_or_create_user_settings(user_id)
        settings_row.ai_data_sharing_level = ai_data_sharing_level
        self.db.commit()
        self.db.refresh(settings_row)
        return settings_row
