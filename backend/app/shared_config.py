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

# Import and re-export shared pricing configuration
# Note: This file intentionally has no direct usage of these imports
# They are re-exported for use by other modules
try:
    from pricing_config import (  # noqa: E402, F401
        SUBSCRIPTION_TIERS,
        PricingUtils,
        DEFAULT_TIERS,
        PRICING_CONFIG,
        SubscriptionTier,
        BillingCycle,
        Currency
    )
except ImportError:
    # Fallback if shared module not available
    SUBSCRIPTION_TIERS = []
    PricingUtils = None
    DEFAULT_TIERS = {}
    PRICING_CONFIG = {}
    SubscriptionTier = None
    BillingCycle = None
    Currency = None

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