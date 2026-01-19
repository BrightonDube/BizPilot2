# BizPilot Shared Package

This package contains shared types, configurations, and utilities used by both the frontend (TypeScript) and backend (Python) systems.

## Contents

### Pricing Configuration

The shared pricing configuration ensures consistency across all systems:

- **TypeScript**: `pricing-config.ts` - Used by frontend
- **Python**: `pricing_config.py` - Used by backend

Both files contain identical pricing data and utility functions.

### Usage

#### Frontend (TypeScript)

```typescript
import { SUBSCRIPTION_TIERS, PricingUtils } from '@bizpilot/shared';

// Get all active tiers
const activeTiers = PricingUtils.getActiveTiers();

// Format a price
const formattedPrice = PricingUtils.formatPrice(19900, 'ZAR'); // "R199"

// Get tier by ID
const tier = PricingUtils.getTierById('pilot_core');
```

#### Backend (Python)

```python
from shared.pricing_config import SUBSCRIPTION_TIERS, PricingUtils, DEFAULT_TIERS

# Get all active tiers
active_tiers = PricingUtils.get_active_tiers()

# Format a price
formatted_price = PricingUtils.format_price(19900, 'ZAR')  # "R199"

# Get tier by ID
tier = PricingUtils.get_tier_by_id('pilot_core')

# Use dictionary format for backward compatibility
default_tiers = DEFAULT_TIERS
```

## Building

To build the TypeScript distribution:

```bash
cd shared
pnpm build
```

## Requirements Addressed

- **1.4**: Single source of truth for pricing data
- **3.1**: Consistent field names between frontend and backend
- **3.2**: Prices stored in cents to avoid floating-point issues