"""
Shared Pricing Configuration for Python Backend

This module provides the same pricing configuration as the TypeScript version
but in a Python-compatible format for backend use.

Requirements: 1.4, 3.1, 3.2
"""

from typing import Dict, List, Optional, Union, Literal
from dataclasses import dataclass

# Type definitions
BillingCycle = Literal['monthly', 'yearly']
Currency = Literal['ZAR', 'USD', 'EUR']

@dataclass
class SubscriptionTier:
    """Subscription tier data class matching the TypeScript interface"""
    id: str
    name: str
    display_name: str
    description: str
    price_monthly_cents: int
    price_yearly_cents: int
    currency: str
    sort_order: int
    is_default: bool
    is_active: bool
    is_custom_pricing: bool
    features: Dict[str, int]
    feature_flags: Dict[str, bool]
    paystack_plan_code_monthly: Optional[str] = None
    paystack_plan_code_yearly: Optional[str] = None

# Unified subscription tiers configuration
# Matches the TypeScript SUBSCRIPTION_TIERS exactly
SUBSCRIPTION_TIERS: List[SubscriptionTier] = [
    SubscriptionTier(
        id="pilot_solo",
        name="pilot_solo",
        display_name="Pilot Solo",
        description="Free starter tier for getting started with BizPilot",
        price_monthly_cents=0,
        price_yearly_cents=0,
        currency="ZAR",
        sort_order=0,
        is_default=True,
        is_active=True,
        is_custom_pricing=False,
        features={
            "max_users": 1,
            "max_orders_per_month": 5,
            "max_terminals": 0
        },
        feature_flags={
            "basic_reports": False,
            "inventory_tracking": True,  # Simple inventory only
            "cost_calculations": False,
            "email_support": False,
            "export_reports": False,
            "ai_insights": False,
            "custom_categories": False,
            "priority_support": False,
            "multi_location": False,
            "api_access": False,
            "team_collaboration": False,
            "pos_system": False,
            "customer_management": False
        }
    ),
    SubscriptionTier(
        id="pilot_lite",
        name="pilot_lite",
        display_name="Pilot Lite",
        description="Coffee stalls and trucks: cash/card tracking with basic sales reports",
        price_monthly_cents=19900,  # R199
        price_yearly_cents=191040,  # 20% discount
        currency="ZAR",
        sort_order=1,
        is_default=False,
        is_active=True,
        is_custom_pricing=False,
        features={
            "max_users": 3,
            "max_orders_per_month": -1,
            "max_terminals": 1
        },
        feature_flags={
            "basic_reports": True,
            "inventory_tracking": False,
            "cost_calculations": False,
            "email_support": True,
            "export_reports": False,
            "ai_insights": False,
            "custom_categories": False,
            "priority_support": False,
            "multi_location": False,
            "api_access": False,
            "team_collaboration": True,
            "pos_system": True,
            "customer_management": True
        }
    ),
    SubscriptionTier(
        id="pilot_core",
        name="pilot_core",
        display_name="Pilot Core",
        description="Standard restaurants: inventory tracking with ingredient tracking and recipes",
        price_monthly_cents=79900,  # R799
        price_yearly_cents=767040,  # 20% discount
        currency="ZAR",
        sort_order=2,
        is_default=False,
        is_active=True,
        is_custom_pricing=False,
        features={
            "max_users": -1,
            "max_orders_per_month": -1,
            "max_terminals": 2
        },
        feature_flags={
            "basic_reports": True,
            "inventory_tracking": True,
            "cost_calculations": True,
            "email_support": True,
            "export_reports": True,
            "ai_insights": False,
            "custom_categories": True,
            "priority_support": False,
            "multi_location": False,
            "api_access": False,
            "team_collaboration": True,
            "pos_system": True,
            "customer_management": True
        }
    ),
    SubscriptionTier(
        id="pilot_pro",
        name="pilot_pro",
        display_name="Pilot Pro",
        description="High volume: full AI suite and automation",
        price_monthly_cents=149900,  # R1499
        price_yearly_cents=1439040,  # 20% discount
        currency="ZAR",
        sort_order=3,
        is_default=False,
        is_active=True,
        is_custom_pricing=False,
        features={
            "max_users": -1,
            "max_orders_per_month": -1,
            "max_terminals": -1
        },
        feature_flags={
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
            "pos_system": True,
            "customer_management": True
        }
    ),
    SubscriptionTier(
        id="enterprise",
        name="enterprise",
        display_name="Enterprise",
        description="Custom enterprise solution with tailored features and dedicated support",
        price_monthly_cents=-1,  # Custom pricing indicator
        price_yearly_cents=-1,   # Custom pricing indicator
        currency="ZAR",
        sort_order=4,
        is_default=False,
        is_active=True,
        is_custom_pricing=True,
        features={
            "max_users": -1,  # Unlimited
            "max_orders_per_month": -1,  # Unlimited
            "max_terminals": -1,  # Unlimited
            "max_locations": -1,  # Unlimited
            "custom_integrations": -1,  # Unlimited
            "dedicated_support": 1  # Included
        },
        feature_flags={
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
            "white_labeling": True,
            "custom_development": True,
            "dedicated_account_manager": True,
            "sla_guarantee": True,
            "advanced_security": True,
            "custom_workflows": True,
            "pos_system": True,
            "customer_management": True
        }
    )
]

class PricingUtils:
    """Pricing utility functions for formatting and calculations"""
    
    @staticmethod
    def format_price(cents: int, currency: Currency = 'ZAR') -> str:
        """Format price in cents to display string"""
        if cents == 0:
            return 'Free'
        if cents == -1:
            return 'Contact Sales'  # Custom pricing
        
        amount = cents / 100
        
        if currency == 'ZAR':
            return f"R{amount:,.0f}"
        elif currency == 'USD':
            return f"${amount:,.0f}"
        elif currency == 'EUR':
            return f"€{amount:,.0f}"
        else:
            return f"{currency} {amount:,.0f}"
    
    @staticmethod
    def calculate_yearly_savings(monthly_price: int, yearly_price: int) -> int:
        """Calculate yearly savings percentage"""
        if monthly_price == 0 or yearly_price == 0 or monthly_price == -1 or yearly_price == -1:
            return 0
        monthly_total = monthly_price * 12
        return round(((monthly_total - yearly_price) / monthly_total) * 100)
    
    @staticmethod
    def get_price_for_cycle(tier: SubscriptionTier, cycle: BillingCycle) -> int:
        """Get price for specific billing cycle"""
        return tier.price_monthly_cents if cycle == 'monthly' else tier.price_yearly_cents
    
    @staticmethod
    def format_price_with_cycle(tier: SubscriptionTier, cycle: BillingCycle) -> str:
        """Format price with billing cycle"""
        price = PricingUtils.get_price_for_cycle(tier, cycle)
        formatted_price = PricingUtils.format_price(price, tier.currency)
        
        if price == 0 or price == -1:
            return formatted_price
        
        cycle_suffix = '/mo' if cycle == 'monthly' else '/yr'
        return f"{formatted_price}{cycle_suffix}"
    
    @staticmethod
    def get_tier_by_id(tier_id: str) -> Optional[SubscriptionTier]:
        """Get tier by ID"""
        return next((tier for tier in SUBSCRIPTION_TIERS if tier.id == tier_id), None)
    
    @staticmethod
    def get_default_tier() -> Optional[SubscriptionTier]:
        """Get default tier"""
        return next((tier for tier in SUBSCRIPTION_TIERS if tier.is_default), None)
    
    @staticmethod
    def has_custom_pricing(tier: SubscriptionTier) -> bool:
        """Check if tier has custom pricing"""
        return tier.is_custom_pricing or tier.price_monthly_cents == -1
    
    @staticmethod
    def get_active_tiers() -> List[SubscriptionTier]:
        """Get active tiers sorted by sort_order"""
        return sorted([tier for tier in SUBSCRIPTION_TIERS if tier.is_active], 
                     key=lambda t: t.sort_order)

# Convert to dictionary format for backward compatibility with existing backend code
def get_default_tiers_dict() -> Dict[str, Dict]:
    """Convert subscription tiers to dictionary format for backend compatibility"""
    tiers_dict = {}
    for tier in SUBSCRIPTION_TIERS:
        tiers_dict[tier.name] = {
            "name": tier.name,
            "display_name": tier.display_name,
            "description": tier.description,
            "price_monthly_cents": tier.price_monthly_cents,
            "price_yearly_cents": tier.price_yearly_cents,
            "currency": tier.currency,
            "sort_order": tier.sort_order,
            "is_default": tier.is_default,
            "is_active": tier.is_active,
            "is_custom_pricing": tier.is_custom_pricing,
            "features": tier.features,
            "feature_flags": tier.feature_flags,
            "paystack_plan_code_monthly": tier.paystack_plan_code_monthly,
            "paystack_plan_code_yearly": tier.paystack_plan_code_yearly
        }
    return tiers_dict

# Export for backward compatibility
DEFAULT_TIERS = get_default_tiers_dict()

# Configuration object
PRICING_CONFIG = {
    'tiers': SUBSCRIPTION_TIERS,
    'utils': PricingUtils,
    'default_tiers_dict': DEFAULT_TIERS
}