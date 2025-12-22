"""User settings model for preferences (including AI privacy controls)."""

import enum

from sqlalchemy import Column, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class AIDataSharingLevel(str, enum.Enum):
    """How much data the user allows to be shared with AI."""

    NONE = "none"
    APP_ONLY = "app_only"
    METRICS_ONLY = "metrics_only"
    FULL_BUSINESS = "full_business"
    FULL_BUSINESS_WITH_CUSTOMERS = "full_business_with_customers"


class UserSettings(BaseModel):
    """Per-user settings and preferences."""

    __tablename__ = "user_settings"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    ai_data_sharing_level = Column(
        SQLEnum(
            AIDataSharingLevel,
            values_callable=lambda x: [e.value for e in x],
            create_constraint=False,
            native_enum=True,
            name="aidatasharinglevel",
        ),
        default=AIDataSharingLevel.NONE,
        nullable=False,
    )

    user = relationship("User", back_populates="settings")

    def __repr__(self) -> str:
        return f"<UserSettings user={self.user_id} ai_data_sharing_level={self.ai_data_sharing_level}>"
