"""Subscription feature definitions.

Defines the catalog of available subscription features that can be toggled per tier.
"""

from sqlalchemy import Column, String, Boolean

from app.models.base import BaseModel


class SubscriptionFeatureDefinition(BaseModel):
    __tablename__ = "subscription_feature_definitions"

    key = Column(String(100), nullable=False, unique=True, index=True)
    display_name = Column(String(150), nullable=False)
    description = Column(String(500), nullable=True)
    category = Column(String(100), nullable=True)
    is_active = Column(Boolean, nullable=False, server_default='true')

    def __repr__(self) -> str:
        return f"<SubscriptionFeatureDefinition key={self.key}>"
