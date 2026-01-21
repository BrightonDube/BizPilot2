# Pricing Consistency and Marketing Implementation Guide

## Overview

This document provides comprehensive documentation for the pricing consistency and marketing improvements implemented in the BizPilot2 application. The changes address pricing display inconsistencies, guest user access, marketing page styling, and mobile-friendly pricing display.

**Spec Reference**: `.kiro/specs/pricing-consistency-marketing/`

**Implementation Date**: January 20, 2026

---

## Table of Contents

1. [Pricing Configuration Changes](#pricing-configuration-changes)
2. [Carousel Implementation](#carousel-implementation)
3. [Aurora Background Usage Pattern](#aurora-background-usage-pattern)
4. [Architecture Overview](#architecture-overview)
5. [Usage Examples](#usage-examples)
6. [Testing Guidelines](#testing-guidelines)
7. [Troubleshooting](#troubleshooting)

---

## Pricing Configuration Changes

### Overview

The pricing configuration has been centralized in a single source of truth file that serves both frontend and backend systems. This ensures consistency across all pricing displays and subscription logic.

### File Structure

```text
shared/
  └── pricing-config.ts          # Single source of truth for all pricing data
frontend/src/lib/
  └── pricing-config.ts          # Marketing-friendly wrappers and utilities
```

### Core Configuration File

**Location**: `shared/pricing-config.ts`

This file contains:
- All subscription tier definitions
- Feature flags and limits for each tier
- Pricing utilities for formatting and calculations
- Type definitions for TypeScript safety

#### Subscription Tiers

The system now supports 5 pricing tiers:

1. **Pilot Solo** (Free Tier)
   - Price: R0/month
   - Max Users: 1
   - Max Orders: 5 per month
   - Max Terminals: 0 (no POS access)
   - Key Features: Simple inventory tracking only
   - Limitations: No POS, no email support, no customer management

2. **Pilot Lite**
   - Price: R199/month (R191.04/year with 20% discount)
   - Max Users: 3
   - Max Orders: Unlimited
   - Max Terminals: 1
   - Key Features: Complete POS, basic reports, email support

3. **Pilot Core** (Recommended)
   - Price: R799/month (R767.04/year with 20% discount)
   - Max Users: Unlimited
   - Max Orders: Unlimited
   - Max Terminals: 2
   - Key Features: Advanced inventory, cost calculations, export reports

4. **Pilot Pro**
   - Price: R1499/month (R1439.04/year with 20% discount)
   - Max Users: Unlimited
   - Max Orders: Unlimited
   - Max Terminals: Unlimited
   - Key Features: Full AI suite, multi-location, API access, priority support

5. **Enterprise**
   - Price: Custom (contact sales)
   - All features unlimited
   - Custom development, white-labeling, dedicated support
   - SLA guarantees and advanced security

### Key Changes to Free Tier (Pilot Solo)

The Free tier was updated to accurately reflect its limitations:

```typescript
{
  id: "pilot_solo",
  features: {
    max_users: 1,
    max_orders_per_month: 5,      // Changed from 50
    max_terminals: 0               // Changed from 1 - no POS access
  },
  feature_flags: {
    inventory_tracking: true,      // Simple tracking only
    email_support: false,          // Changed from true
    pos_system: false,             // New flag - explicitly disabled
    customer_management: false,    // New flag - explicitly disabled
    basic_reports: false,
    cost_calculations: false,
    export_reports: false,
    ai_insights: false,
    // ... other flags
  }
}
```

### Pricing Utilities

The `PricingUtils` class provides helper methods for working with pricing data:

```typescript
// Format price in cents to display string
PricingUtils.formatPrice(199900, 'ZAR')  // Returns "R1999"

// Calculate yearly savings percentage
PricingUtils.calculateYearlySavings(monthlyPrice, yearlyPrice)  // Returns 20

// Get price for specific billing cycle
PricingUtils.getPriceForCycle(tier, 'monthly')

// Format price with billing cycle
PricingUtils.formatPriceWithCycle(tier, 'yearly')  // Returns "R1439/yr"

// Get tier by ID
PricingUtils.getTierById('pilot_core')

// Get active tiers sorted by sort_order
PricingUtils.getActiveTiers()

// Check if tier has custom pricing
PricingUtils.hasCustomPricing(tier)
```

### Frontend Marketing Configuration

**Location**: `frontend/src/lib/pricing-config.ts`

This file extends the shared configuration with marketing-specific features:

- **PricingPlan Interface**: Marketing-friendly representation of tiers
- **Feature Benefits**: Converts technical flags to user-facing benefits
- **AI Messaging**: Marketing copy for AI features
- **Feature Comparison Matrix**: Detailed feature comparison across tiers

#### Converting Features to Benefits

The `convertFeaturesToBenefits()` method transforms technical feature flags into user-facing benefits with checkmarks (✓) or X indicators:

```typescript
// Example output for Pilot Solo
[
  { text: '1 user', checked: true },
  { text: 'Up to 5 orders per month', checked: true },
  { text: 'No terminals', checked: false },
  { text: 'Simple inventory tracking', checked: true },
  { text: 'POS System', checked: false },
  { text: 'Customer Management', checked: false },
  { text: 'Email Support', checked: false },
  // ... more features
]
```

### Feature Comparison Matrix

The feature comparison matrix provides a detailed breakdown of features across all tiers:

```typescript
export const FEATURE_COMPARISON: FeatureComparison[] = [
  {
    category: "Core Business Management",
    features: [
      {
        name: "POS System & Payment Processing",
        pilot_solo: false,
        pilot_lite: true,
        pilot_core: true,
        pilot_pro: true,
        enterprise: true
      },
      // ... more features
    ]
  },
  // ... more categories
]
```

Categories include:
- Core Business Management
- Smart Features & Automation
- Business Scale & Integration
- Support & Services

---

## Carousel Implementation

### Overview

The pricing page now features a horizontal scroll carousel for mobile-friendly browsing of pricing tiers. Users can swipe through plans or use navigation buttons.

### Implementation Details

**Location**: `frontend/src/components/pricing/PricingClientWrapper.tsx`

The carousel uses:
- **Flexbox layout** with horizontal scrolling
- **Scroll snapping** for smooth card alignment
- **Navigation buttons** for Previous/Next
- **Hidden scrollbar** for clean appearance
- **Gradient overlay** to indicate more content
- **React useRef** for programmatic scroll control

### Key Features

#### 1. Horizontal Scroll Container

```typescript
<div 
  ref={scrollContainerRef}
  className="flex overflow-x-auto gap-6 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-12"
>
  {currentCards.map((card) => (
    <div key={card.key} className="flex-shrink-0 w-[300px] snap-center">
      <PricingCard {...card} />
    </div>
  ))}
</div>
```

**CSS Classes Explained**:
- `flex`: Flexbox layout for horizontal arrangement
- `overflow-x-auto`: Enable horizontal scrolling
- `gap-6`: 1.5rem spacing between cards
- `snap-x snap-mandatory`: Enable horizontal scroll snapping
- `[&::-webkit-scrollbar]:hidden`: Hide scrollbar in Chrome/Safari
- `[-ms-overflow-style:none]`: Hide scrollbar in IE/Edge
- `[scrollbar-width:none]`: Hide scrollbar in Firefox
- `px-12`: Padding for navigation buttons
- `flex-shrink-0`: Prevent cards from shrinking
- `w-[300px]`: Fixed width for each card
- `snap-center`: Snap cards to center of viewport

#### 2. Navigation Buttons

```typescript
const scrollContainerRef = useRef<HTMLDivElement>(null)

const scrollPrevious = () => {
  if (scrollContainerRef.current) {
    scrollContainerRef.current.scrollBy({
      left: -300,
      behavior: 'smooth'
    })
  }
}

const scrollNext = () => {
  if (scrollContainerRef.current) {
    scrollContainerRef.current.scrollBy({
      left: 300,
      behavior: 'smooth'
    })
  }
}
```

**Button Styling**:
```typescript
<button
  type="button"
  onClick={scrollPrevious}
  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-slate-800/90 hover:bg-slate-700 text-white p-3 rounded-full shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-950"
  aria-label="Previous pricing tier"
>
  <ChevronLeft className="h-6 w-6" />
</button>
```

#### 3. Gradient Overlay

A gradient overlay on the right edge indicates more content is available:

```typescript
<div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none" />
```

**Key Properties**:
- `pointer-events-none`: Allows clicks to pass through to content below
- `bg-gradient-to-l`: Gradient from right to left
- `from-slate-950 to-transparent`: Dark to transparent gradient

### Accessibility Features

- **Keyboard Navigation**: Users can scroll with arrow keys
- **Screen Reader Support**: Buttons have `aria-label` attributes
- **Focus Management**: Buttons have visible focus rings
- **Touch Support**: Native touch/swipe scrolling on mobile devices

### Responsive Behavior

- **Desktop**: Shows multiple cards with navigation buttons
- **Tablet**: Shows 2-3 cards with smooth scrolling
- **Mobile**: Shows 1 card at a time with swipe support

---

## Aurora Background Usage Pattern

### Overview

The aurora background component provides a consistent, animated star field effect for hero sections across all marketing pages. It creates a visually appealing backdrop without interfering with content readability.

### Component Details

**Location**: `frontend/src/components/home/HeroStarsBackground.tsx`

The component uses:
- **Canvas API** for rendering stars
- **RequestAnimationFrame** for smooth 60fps animation
- **React useEffect** for lifecycle management
- **Window resize handling** for responsive canvas sizing

### Implementation

```typescript
'use client'

import { useEffect, useRef } from 'react'

export default function HeroStarsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match viewport
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Create 200 stars with random properties
    const stars: { 
      x: number
      y: number
      radius: number
      opacity: number
      speed: number 
    }[] = []
    
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5,
        opacity: Math.random(),
        speed: Math.random() * 0.5 + 0.1,
      })
    }

    // Animation loop
    let animationId: number
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      stars.forEach((star) => {
        // Twinkling effect
        star.opacity += (Math.random() - 0.5) * 0.05
        star.opacity = Math.max(0.1, Math.min(1, star.opacity))

        // Draw star
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`
        ctx.fill()

        // Slow downward movement
        star.y += star.speed
        if (star.y > canvas.height) {
          star.y = 0
          star.x = Math.random() * canvas.width
        }
      })

      animationId = requestAnimationFrame(animate)
    }
    animate()

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <div className="absolute inset-0 z-0">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}
```

### Usage Pattern

To add the aurora background to any marketing page:

```typescript
import HeroStarsBackground from '@/components/home/HeroStarsBackground'

export default function MarketingPage() {
  return (
    <section className="relative min-h-screen bg-slate-950">
      {/* Aurora background - positioned absolutely behind content */}
      <HeroStarsBackground />
      
      {/* Page content - positioned relatively with z-index */}
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-20">
        <h1>Your Hero Content</h1>
        <p>Your marketing copy...</p>
      </div>
    </section>
  )
}
```

### Key Styling Requirements

1. **Parent Container**:
   - Must have `relative` positioning
   - Should have `min-h-screen` or appropriate height
   - Should have dark background color (e.g., `bg-slate-950`)

2. **Aurora Component**:
   - Automatically positioned with `absolute inset-0`
   - Has `z-0` to stay behind content

3. **Content Container**:
   - Must have `relative` positioning
   - Must have `z-10` or higher to appear above background
   - Can use any layout/spacing classes

### Performance Characteristics

- **Frame Rate**: 60fps animation
- **Star Count**: 200 stars per page
- **Memory**: Minimal - canvas reuses same memory
- **CPU**: Low impact - simple calculations per frame
- **Cleanup**: Automatic on component unmount

### Browser Compatibility

- **Modern Browsers**: Full support (Chrome, Firefox, Safari, Edge)
- **Canvas Fallback**: If canvas not supported, shows static background
- **Mobile**: Optimized for mobile devices with same performance

### Accessibility Considerations

- **Decorative Only**: Background is purely visual enhancement
- **No Interaction**: Does not interfere with user interactions
- **Screen Readers**: Ignored by screen readers (no semantic content)
- **Reduced Motion**: Consider adding `prefers-reduced-motion` support in future

---

## Architecture Overview

### System Components

```text
┌─────────────────────────────────────────────────────────────┐
│                    Marketing Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Hero Sections│  │ Pricing Page │  │ Contact Page │      │
│  │ (All Pages)  │  │              │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   Component Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Aurora       │  │ Pricing      │  │ Contact      │      │
│  │ Background   │  │ Client       │  │ Sales Form   │      │
│  │              │  │ Wrapper      │  │              │      │
│  └──────────────┘  └──────┬───────┘  └──────────────┘      │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                Configuration Layer                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         shared/pricing-config.ts                     │   │
│  │  - SUBSCRIPTION_TIERS (source of truth)              │   │
│  │  - Feature definitions                               │   │
│  │  - Pricing utilities                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                             │                                │
│                             ▼                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      frontend/src/lib/pricing-config.ts              │   │
│  │  - Marketing-friendly wrappers                       │   │
│  │  - Feature-to-benefit conversion                     │   │
│  │  - Display utilities                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Pricing Configuration Flow**:
   - `shared/pricing-config.ts` defines all tiers and features
   - `frontend/src/lib/pricing-config.ts` converts to marketing format
   - `PricingClientWrapper` consumes and displays pricing cards
   - Feature availability determines checkmark (✓) or X display

2. **Contact Form Flow**:
   - Guest user visits `/contact` page
   - `ContactSalesForm` component renders without auth check
   - Form submission sends email via `/contact` API endpoint
   - No authentication required at any step

3. **Aurora Background Flow**:
   - Marketing pages import `HeroStarsBackground` component
   - Component renders canvas-based star animation
   - Positioned absolutely behind hero content
   - Consistent styling parameters across all pages

---

## Usage Examples

### Example 1: Adding Aurora Background to a New Page

```typescript
// frontend/src/app/(marketing)/new-page/page.tsx
import HeroStarsBackground from '@/components/home/HeroStarsBackground'

export default function NewMarketingPage() {
  return (
    <main>
      {/* Hero Section with Aurora Background */}
      <section className="relative min-h-screen bg-slate-950">
        <HeroStarsBackground />
        
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-20">
          <h1 className="text-5xl font-bold text-white mb-6">
            Welcome to Our New Page
          </h1>
          <p className="text-xl text-gray-300">
            This page has a beautiful aurora background!
          </p>
        </div>
      </section>

      {/* Rest of page content */}
      <section className="py-20">
        {/* Regular content without aurora background */}
      </section>
    </main>
  )
}
```

### Example 2: Using Pricing Configuration

```typescript
// Get all active pricing tiers
import { PricingUtils, SUBSCRIPTION_TIERS } from '@/shared/pricing-config'

const activeTiers = PricingUtils.getActiveTiers()

// Format a price
const formattedPrice = PricingUtils.formatPrice(199900, 'ZAR')
// Returns: "R1999"

// Get a specific tier
const coreTier = PricingUtils.getTierById('pilot_core')

// Calculate savings
const savings = PricingUtils.calculateYearlySavings(
  coreTier.price_monthly_cents,
  coreTier.price_yearly_cents
)
// Returns: 20 (20% savings)

// Format price with cycle
const priceDisplay = PricingUtils.formatPriceWithCycle(coreTier, 'monthly')
// Returns: "R799/mo"
```

### Example 3: Converting Features to Benefits

```typescript
import { PricingUtils, PRICING_PLANS } from '@/lib/pricing-config'

// Get a plan
const pilotSolo = PRICING_PLANS.find(p => p.id === 'pilot_solo')

// Convert to benefits for display
const benefits = PricingUtils.convertFeaturesToBenefits(pilotSolo)

// Render benefits
benefits.map((benefit, index) => (
  <div key={index} className="flex items-center gap-3">
    {benefit.checked ? (
      <Check className="text-green-500" />
    ) : (
      <X className="text-gray-500" />
    )}
    <span>{benefit.text}</span>
  </div>
))
```

### Example 4: Implementing a Custom Carousel

```typescript
import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function CustomCarousel({ items }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300
      scrollRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className="relative">
      {/* Previous Button */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-slate-800/90 hover:bg-slate-700 text-white p-3 rounded-full shadow-lg"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto gap-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-12"
      >
        {items.map((item, index) => (
          <div key={index} className="flex-shrink-0 w-[300px] snap-center">
            {item}
          </div>
        ))}
      </div>

      {/* Next Button */}
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-slate-800/90 hover:bg-slate-700 text-white p-3 rounded-full shadow-lg"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Gradient Overlay */}
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none" />
    </div>
  )
}
```

---

## Testing Guidelines

### Unit Tests

Test pricing configuration values:

```typescript
import { PricingUtils, SUBSCRIPTION_TIERS } from '@/shared/pricing-config'

describe('Pricing Configuration', () => {
  test('Free tier has correct limits', () => {
    const freeTier = PricingUtils.getTierById('pilot_solo')
    expect(freeTier.features.max_users).toBe(1)
    expect(freeTier.features.max_orders_per_month).toBe(5)
    expect(freeTier.features.max_terminals).toBe(0)
    expect(freeTier.feature_flags.pos_system).toBe(false)
    expect(freeTier.feature_flags.email_support).toBe(false)
    expect(freeTier.feature_flags.customer_management).toBe(false)
  })

  test('Price formatting works correctly', () => {
    expect(PricingUtils.formatPrice(0, 'ZAR')).toBe('Free')
    expect(PricingUtils.formatPrice(-1, 'ZAR')).toBe('Contact Sales')
    expect(PricingUtils.formatPrice(199900, 'ZAR')).toBe('R1999')
  })

  test('Yearly savings calculation', () => {
    const savings = PricingUtils.calculateYearlySavings(199900, 191040)
    expect(savings).toBe(20)
  })
})
```

### Integration Tests

Test carousel functionality:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { PricingClientWrapper } from '@/components/pricing/PricingClientWrapper'

describe('Pricing Carousel', () => {
  test('renders all pricing cards', () => {
    render(<PricingClientWrapper monthlyCards={mockCards} yearlyCards={mockCards} />)
    expect(screen.getAllByRole('article')).toHaveLength(5)
  })

  test('navigation buttons scroll container', () => {
    const { container } = render(<PricingClientWrapper monthlyCards={mockCards} yearlyCards={mockCards} />)
    const scrollContainer = container.querySelector('[ref="scrollContainerRef"]')
    const nextButton = screen.getByLabelText('Next pricing tier')
    
    fireEvent.click(nextButton)
    // Verify scroll position changed
  })
})
```

### Visual Tests

Test aurora background rendering:

```typescript
import { render } from '@testing-library/react'
import HeroStarsBackground from '@/components/home/HeroStarsBackground'

describe('Aurora Background', () => {
  test('renders canvas element', () => {
    const { container } = render(<HeroStarsBackground />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  test('canvas has correct dimensions', () => {
    const { container } = render(<HeroStarsBackground />)
    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    expect(canvas.width).toBe(window.innerWidth)
    expect(canvas.height).toBe(window.innerHeight)
  })
})
```

---

## Troubleshooting

### Common Issues

#### 1. Pricing Display Shows Incorrect Features

**Problem**: Free tier shows checkmarks for features that should be excluded.

**Solution**: 
- Verify `shared/pricing-config.ts` has correct feature flags
- Check that `frontend/src/lib/pricing-config.ts` is using the shared config
- Clear browser cache and rebuild: `pnpm run build`

#### 2. Carousel Not Scrolling Smoothly

**Problem**: Carousel jumps or doesn't scroll smoothly.

**Solution**:
- Ensure `scroll-behavior: smooth` is applied
- Check that `snap-x` and `snap-mandatory` classes are present
- Verify card width matches scroll amount (300px)
- Test on different browsers for compatibility

#### 3. Aurora Background Not Visible

**Problem**: Stars don't appear on marketing pages.

**Solution**:
- Verify parent container has `relative` positioning
- Check that content has `z-10` or higher
- Ensure background color is dark (e.g., `bg-slate-950`)
- Check browser console for canvas errors
- Verify component is imported correctly

#### 4. Navigation Buttons Not Working

**Problem**: Previous/Next buttons don't scroll the carousel.

**Solution**:
- Check that `scrollContainerRef` is properly attached
- Verify `useRef` is imported from React
- Ensure buttons have `onClick` handlers
- Check browser console for JavaScript errors

#### 5. Feature Comparison Matrix Has Duplicates

**Problem**: Same feature appears multiple times in comparison table.

**Solution**:
- Review `FEATURE_COMPARISON` array in `frontend/src/lib/pricing-config.ts`
- Remove duplicate entries
- Ensure each feature name is unique within its category

### Performance Issues

#### Aurora Background Causing Lag

**Symptoms**: Page feels slow or janky with aurora background.

**Solutions**:
1. Reduce star count from 200 to 100:
   ```typescript
   for (let i = 0; i < 100; i++) { // Changed from 200
   ```

2. Increase star speed to reduce calculations:
   ```typescript
   speed: Math.random() * 1.0 + 0.2, // Faster movement
   ```

3. Disable on mobile devices:
   ```typescript
   if (window.innerWidth < 768) return // Skip on mobile
   ```

#### Carousel Scroll Performance

**Symptoms**: Carousel scrolling is choppy or slow.

**Solutions**:
1. Use CSS transforms instead of scroll:
   ```css
   transform: translateX(-300px);
   transition: transform 0.3s ease;
   ```

2. Reduce card complexity (fewer animations, simpler styles)

3. Use `will-change` CSS property:
   ```css
   will-change: scroll-position;
   ```

### Browser-Specific Issues

#### Safari Scrollbar Still Visible

**Problem**: Scrollbar shows in Safari despite hiding classes.

**Solution**:
```css
/* Add to global CSS */
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
```

#### Firefox Snap Not Working

**Problem**: Scroll snapping doesn't work in Firefox.

**Solution**:
- Ensure Firefox version is 99+ (scroll-snap support)
- Use `scroll-snap-type: x mandatory` instead of Tailwind classes
- Add explicit `scroll-snap-align: center` to cards

---

## Additional Resources

### Related Documentation

- [Pricing Configuration Spec](.kiro/specs/pricing-consistency-marketing/requirements.md)
- [Design Document](.kiro/specs/pricing-consistency-marketing/design.md)
- [Task List](.kiro/specs/pricing-consistency-marketing/tasks.md)

### External References

- [Canvas API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [CSS Scroll Snap](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Scroll_Snap)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React useRef Hook](https://react.dev/reference/react/useRef)

### Support

For questions or issues related to this implementation:
1. Check this documentation first
2. Review the spec files in `.kiro/specs/pricing-consistency-marketing/`
3. Check the codebase for inline comments
4. Create a Beads issue: `bd create "Issue description"`

---

**Last Updated**: January 20, 2026  
**Version**: 1.0  
**Maintainer**: BizPilot2 Development Team
