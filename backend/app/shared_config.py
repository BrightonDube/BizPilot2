"""
Shared Configuration Import Helper

This module provides access to the shared pricing configuration
from the shared package for the backend.
"""

import sys
from pathlib import Path

# Add shared directory to Python path
shared_dir = Path(__file__).parent.parent.parent / "shared"
if str(shared_dir) not in sys.path:
    sys.path.insert(0, str(shared_dir))

# Import shared pricing configuration
from pricing_config import (
    SUBSCRIPTION_TIERS,
    PricingUtils,
    DEFAULT_TIERS,
    PRICING_CONFIG,
    SubscriptionTier,
    BillingCycle,
    Currency
)

# Re-export for easy access
__all__ = [
    'SUBSCRIPTION_TIERS',
    'PricingUtils', 
    'DEFAULT_TIERS',
    'PRICING_CONFIG',
    'SubscriptionTier',
    'BillingCycle',
    'Currency'
]