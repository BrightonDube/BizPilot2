"""SubscriptionTier model for defining pricing tiers and features."""

from sqlalchemy import Column, String, Boolean, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

# Import shared pricing configuration
import sys
import os
# Add shared directory to path - works in both local dev and Docker container
shared_paths = [
    os.path.join(os.path.dirname(__file__), '..', '..', '..', 'shared'),  # Local dev
    os.path.join(os.path.dirname(__file__), '..', '..', 'shared'),  # Docker container
    '/app/shared',  # Docker absolute path fallback
]
for path in shared_paths:
    if os.path.exists(path) and path not in sys.path:
        sys.path.insert(0, path)
        break


class SubscriptionTier(BaseModel):
    """Subscription tier model defining pricing and features."""

    __tablename__ = "subscription_tiers"

    name = Column(String(50), nullable=False, unique=True)
    display_name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    
    # Pricing - stored in cents (ZAR) to avoid floating point issues
    price_monthly_cents = Column(Integer, nullable=False, default=0)
    price_yearly_cents = Column(Integer, nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="ZAR")
    
    # Paystack plan codes for subscription management
    paystack_plan_code_monthly = Column(String(100), nullable=True)
    paystack_plan_code_yearly = Column(String(100), nullable=True)
    
    # Tier ordering for display
    sort_order = Column(Integer, nullable=False, default=0)
    
    # Is this the default tier for new users?
    is_default = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Custom pricing flag for Enterprise tier
    is_custom_pricing = Column(Boolean, default=False, nullable=False)
    
    # Features and limits as JSONB for flexibility
    # Example: {"max_products": 5, "max_users": 1, "features": ["basic_reports"]}
    features = Column(JSONB, nullable=False, default={})
    
    # Feature flags - granular feature access
    # Example: {"export_reports": true, "ai_insights": false, "multi_location": false}
    feature_flags = Column(JSONB, nullable=False, default={})

    # Relationships
    users = relationship("User", back_populates="current_tier")

    def __repr__(self) -> str:
        return f"<SubscriptionTier {self.name}>"

    @property
    def price_monthly(self) -> float:
        """Return monthly price in currency units."""
        return self.price_monthly_cents / 100

    @property
    def price_yearly(self) -> float:
        """Return yearly price in currency units."""
        return self.price_yearly_cents / 100

    def has_feature(self, feature: str) -> bool:
        """Check if tier has a specific feature enabled."""
        return self.feature_flags.get(feature, False) if self.feature_flags else False

    def get_limit(self, limit_name: str, default: int = 0) -> int:
        """Get a specific limit value from features."""
        return self.features.get(limit_name, default) if self.features else default

    def has_custom_pricing(self) -> bool:
        """Check if tier has custom pricing (Enterprise tier)."""
        return self.is_custom_pricing or self.price_monthly_cents == -1

    def get_display_price(self, cycle: str = 'monthly') -> str:
        """Get formatted display price for the tier."""
        if self.has_custom_pricing():
            return "Contact Sales"
        
        price = self.price_monthly_cents if cycle == 'monthly' else self.price_yearly_cents
        if price == 0:
            return "Free"
        
        amount = price / 100
        currency_symbol = "R" if self.currency == "ZAR" else "$"
        cycle_suffix = "/mo" if cycle == 'monthly' else "/yr"
        
        return f"{currency_symbol}{amount:,.0f}{cycle_suffix}"


# Default tier configurations imported from shared configuration
# This ensures consistency between frontend and backend pricing
# Requirements: 1.2, 3.1, 3.5, 3.6, 3.7
