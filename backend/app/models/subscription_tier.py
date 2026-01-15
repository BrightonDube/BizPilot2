"""SubscriptionTier model for defining pricing tiers and features."""

from sqlalchemy import Column, String, Boolean, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


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


# Default tier configurations for seeding
DEFAULT_TIERS = {
    "free": {
        "name": "free",
        "display_name": "Starter",
        "description": "Perfect for getting started",
        "price_monthly_cents": 0,
        "price_yearly_cents": 0,
        "sort_order": 0,
        "is_default": True,
        "features": {
            "max_products": 5,
            "max_users": 1,
            "max_customers": 20,
            "max_orders_per_month": 50,
        },
        "feature_flags": {
            "basic_reports": True,
            "inventory_tracking": True,
            "cost_calculations": True,
            "email_support": True,
            "export_reports": False,
            "ai_insights": False,
            "custom_categories": False,
            "priority_support": False,
            "multi_location": False,
            "api_access": False,
            "team_collaboration": False,
        },
    },
    "professional": {
        "name": "professional",
        "display_name": "Professional",
        "description": "Best for growing businesses",
        "price_monthly_cents": 49900,  # R499/month
        "price_yearly_cents": 479900,  # R4799/year (20% discount)
        "sort_order": 1,
        "is_default": False,
        "features": {
            "max_products": -1,  # -1 means unlimited
            "max_users": 5,
            "max_customers": -1,
            "max_orders_per_month": -1,
        },
        "feature_flags": {
            "basic_reports": True,
            "inventory_tracking": True,
            "cost_calculations": True,
            "email_support": True,
            "export_reports": True,
            "ai_insights": True,
            "custom_categories": True,
            "priority_support": False,
            "multi_location": False,
            "api_access": False,
            "team_collaboration": True,
        },
    },
    "enterprise": {
        "name": "enterprise",
        "display_name": "Enterprise",
        "description": "For established businesses",
        "price_monthly_cents": 149900,  # R1499/month
        "price_yearly_cents": 1439900,  # R14399/year (20% discount)
        "sort_order": 2,
        "is_default": False,
        "features": {
            "max_products": -1,
            "max_users": -1,
            "max_customers": -1,
            "max_orders_per_month": -1,
        },
        "feature_flags": {
            "basic_reports": True,
            "inventory_tracking": True,
            "cost_calculations": True,
            "email_support": True,
            "export_reports": True,
            "ai_insights": True,
            "custom_categories": True,
            "priority_support": True,
            "multi_location": True,
            "api_access": True,
            "team_collaboration": True,
            "custom_integrations": True,
            "advanced_reporting": True,
        },
    },
}
