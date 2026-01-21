"""SubscriptionTier model for defining pricing tiers and features.

This module defines the subscription tier model with pricing, features, and limits.
Pricing is stored in cents to avoid floating-point precision issues.
"""

from enum import Enum
from typing import Optional, Dict, Any
from sqlalchemy import Column, String, Boolean, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

# Import shared pricing configuration
# Note: Ensure 'shared' directory is in PYTHONPATH via deployment config
try:
    from pricing_config import DEFAULT_TIERS, SUBSCRIPTION_TIERS, PricingUtils
except ImportError:
    # Fallback if shared module not available
    DEFAULT_TIERS = {}
    SUBSCRIPTION_TIERS = []
    PricingUtils = None


# Constants
CUSTOM_PRICING_SENTINEL = -1
CENTS_PER_UNIT = 100

CURRENCY_SYMBOLS = {
    "ZAR": "R",
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
}


class BillingCycle(str, Enum):
    """Billing cycle options for subscription pricing."""
    MONTHLY = "monthly"
    YEARLY = "yearly"


class SubscriptionTier(BaseModel):
    """Subscription tier model defining pricing and features.
    
    Attributes:
        name: Unique tier identifier (e.g., 'starter', 'professional')
        display_name: Human-readable tier name
        description: Marketing description of the tier
        price_monthly_cents: Monthly price in cents (e.g., 9900 = R99.00)
        price_yearly_cents: Yearly price in cents
        currency: ISO 4217 currency code (default: ZAR)
        paystack_plan_code_monthly: Paystack plan ID for monthly billing
        paystack_plan_code_yearly: Paystack plan ID for yearly billing
        sort_order: Display order (lower = shown first)
        is_default: Whether this is the default tier for new users
        is_active: Whether this tier is available for selection
        is_custom_pricing: Whether this tier requires custom pricing (Enterprise)
        features: JSONB dict of limits (e.g., {"max_products": 100})
        feature_flags: JSONB dict of boolean features (e.g., {"ai_insights": true})
    """

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
    
    # Tier flags
    is_default = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_custom_pricing = Column(Boolean, default=False, nullable=False)
    
    # Features and limits as JSONB for flexibility
    # Example features: {"max_products": 5, "max_users": 1, "max_locations": 1}
    features = Column(JSONB, nullable=False, default={})
    
    # Feature flags - granular feature access
    # Example: {"export_reports": true, "ai_insights": false, "multi_location": false}
    feature_flags = Column(JSONB, nullable=False, default={})

    # Relationships
    users = relationship("User", back_populates="current_tier")

    def __repr__(self) -> str:
        """String representation of the tier."""
        return f"<SubscriptionTier {self.name} (${self.price_monthly})>"

    @property
    def price_monthly(self) -> float:
        """Return monthly price in currency units.
        
        Returns:
            Price in currency units (e.g., 9900 cents -> 99.00 ZAR)
        """
        if self.price_monthly_cents is None:
            return 0.0
        return self.price_monthly_cents / CENTS_PER_UNIT

    @property
    def price_yearly(self) -> float:
        """Return yearly price in currency units.
        
        Returns:
            Price in currency units (e.g., 99000 cents -> 990.00 ZAR)
        """
        if self.price_yearly_cents is None:
            return 0.0
        return self.price_yearly_cents / CENTS_PER_UNIT

    def has_feature(self, feature: str) -> bool:
        """Check if tier has a specific feature enabled.
        
        Args:
            feature: Feature flag name (e.g., 'ai_insights', 'export_reports')
            
        Returns:
            True if feature is enabled, False otherwise
        """
        if not self.feature_flags:
            return False
        return bool(self.feature_flags.get(feature, False))

    def get_limit(self, limit_name: str, default: int = 0) -> int:
        """Get a specific limit value from features.
        
        Args:
            limit_name: Name of the limit (e.g., 'max_products', 'max_users')
            default: Default value if limit not found
            
        Returns:
            The limit value as an integer
        """
        if not self.features:
            return default
        
        value = self.features.get(limit_name, default)
        # Ensure we return an integer even if stored as float
        return int(value) if value is not None else default

    def has_custom_pricing(self) -> bool:
        """Check if tier has custom pricing (Enterprise tier).
        
        Returns:
            True if tier requires custom pricing (contact sales)
        """
        return (
            self.is_custom_pricing or 
            self.price_monthly_cents == CUSTOM_PRICING_SENTINEL
        )

    def get_display_price(
        self, 
        cycle: BillingCycle = BillingCycle.MONTHLY
    ) -> str:
        """Get formatted display price for the tier.
        
        Args:
            cycle: Billing cycle (monthly or yearly)
            
        Returns:
            Formatted price string:
            - "Contact Sales" for custom pricing
            - "Free" for zero-cost tiers
            - "R99/mo" or "R990/yr" for paid tiers
            
        Examples:
            >>> tier.get_display_price(BillingCycle.MONTHLY)
            'R99/mo'
            >>> tier.get_display_price(BillingCycle.YEARLY)
            'R990/yr'
        """
        if self.has_custom_pricing():
            return "Contact Sales"
        
        price_cents = (
            self.price_monthly_cents 
            if cycle == BillingCycle.MONTHLY 
            else self.price_yearly_cents
        )
        
        if price_cents == 0:
            return "Free"
        
        amount = price_cents / CENTS_PER_UNIT
        currency_symbol = CURRENCY_SYMBOLS.get(self.currency, self.currency)
        cycle_suffix = "/mo" if cycle == BillingCycle.MONTHLY else "/yr"
        
        return f"{currency_symbol}{amount:,.0f}{cycle_suffix}"

    def get_all_features(self) -> Dict[str, Any]:
        """Get combined dictionary of all features and limits.
        
        Returns:
            Dictionary containing both feature flags and limits
        """
        return {
            "flags": self.feature_flags or {},
            "limits": self.features or {},
        }

    def validate_feature_access(self, feature: str) -> None:
        """Validate that a feature is available in this tier.
        
        Args:
            feature: Feature name to validate
            
        Raises:
            ValueError: If feature is not available in this tier
        """
        if not self.has_feature(feature):
            raise ValueError(
                f"Feature '{feature}' is not available in {self.display_name} tier"
            )


# Default tier configurations imported from shared configuration
# This ensures consistency between frontend and backend pricing
# Requirements: 1.2, 3.1, 3.5, 3.6, 3.7
