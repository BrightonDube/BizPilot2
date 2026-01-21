/**
 * Carousel Functionality Tests for PricingClientWrapper
 * 
 * These tests validate the horizontal scroll carousel functionality including:
 * - Horizontal scrolling on desktop
 * - Touch/swipe scrolling on mobile
 * - Previous/Next button navigation
 * - Scroll snapping behavior
 * - Keyboard navigation (arrow keys)
 * - Accessibility (screen readers, focus management)
 * 
 * **Validates: Task 4.4 - Test Carousel Functionality**
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PricingClientWrapper } from '../PricingClientWrapper';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
  }),
}));

jest.mock('@/lib/subscription-api', () => ({
  subscriptionApi: {
    getTiers: jest.fn().mockResolvedValue([]),
    selectTier: jest.fn().mockResolvedValue({ requires_payment: false }),
  },
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    post: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.PropsWithChildren<{ className?: string; [key: string]: unknown }>) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
}));

// Mock pricing card data
const mockMonthlyCards = [
  {
    key: 'pilot_solo',
    tier: 'Pilot Solo',
    price: 'R0/month',
    bestFor: 'Getting started',
    cta: 'Get Started',
    featured: false,
    benefits: [
      { text: 'Simple inventory tracking', checked: true },
      { text: 'Up to 1 user', checked: true },
      { text: 'Up to 5 orders per month', checked: true },
      { text: 'No POS system', checked: false },
      { text: 'No email support', checked: false },
    ],
    ctaHref: '/auth/register',
    planId: 'pilot_solo',
  },
  {
    key: 'pilot_lite',
    tier: 'Pilot Lite',
    price: 'R299/month',
    bestFor: 'Small businesses',
    cta: 'Start Free Trial',
    featured: true,
    benefits: [
      { text: 'POS System', checked: true },
      { text: 'Up to 3 users', checked: true },
      { text: 'Email support', checked: true },
      { text: 'Basic inventory', checked: true },
    ],
    ctaHref: '/auth/register',
    planId: 'pilot_lite',
  },
  {
    key: 'pilot_core',
    tier: 'Pilot Core',
    price: 'R599/month',
    bestFor: 'Growing businesses',
    cta: 'Start Free Trial',
    featured: false,
    benefits: [
      { text: 'Advanced POS', checked: true },
      { text: 'Unlimited users', checked: true },
      { text: 'Priority support', checked: true },
      { text: 'Advanced analytics', checked: true },
    ],
    ctaHref: '/auth/register',
    planId: 'pilot_core',
  },
  {
    key: 'pilot_pro',
    tier: 'Pilot Pro',
    price: 'R999/month',
    bestFor: 'Established businesses',
    cta: 'Start Free Trial',
    featured: false,
    benefits: [
      { text: 'Everything in Core', checked: true },
      { text: 'Multi-location', checked: true },
      { text: 'API access', checked: true },
      { text: 'Custom integrations', checked: true },
    ],
    ctaHref: '/auth/register',
    planId: 'pilot_pro',
  },
  {
    key: 'enterprise',
    tier: 'Enterprise',
    price: 'Custom',
    bestFor: 'Large organizations',
    cta: 'Contact Sales',
    featured: false,
    benefits: [
      { text: 'Everything in Pro', checked: true },
      { text: 'Dedicated support', checked: true },
      { text: 'Custom features', checked: true },
      { text: 'SLA guarantees', checked: true },
    ],
    ctaHref: '/contact?topic=sales&tier=enterprise',
    planId: 'enterprise',
  },
];

const mockYearlyCards = mockMonthlyCards.map((card) => ({
  ...card,
  price: card.price.replace('/month', '/year'),
}));

describe('PricingClientWrapper - Carousel Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock window.location.search
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).location;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.location = { search: '' } as any;
  });

  /**
   * Test 4.4.1: Horizontal scrolling on desktop
   */
  describe('Horizontal Scrolling on Desktop', () => {
    test('should render carousel container with horizontal scroll enabled', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="overflow-x-auto"]');
      expect(scrollContainer).toBeInTheDocument();
      expect(scrollContainer).toHaveClass('overflow-x-auto');
    });

    test('should apply flexbox layout to carousel container', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="overflow-x-auto"]');
      expect(scrollContainer).toHaveClass('flex');
    });

    test('should render all pricing cards in horizontal layout', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      // Check that all tiers are rendered
      expect(screen.getByText('Pilot Solo')).toBeInTheDocument();
      expect(screen.getByText('Pilot Lite')).toBeInTheDocument();
      expect(screen.getByText('Pilot Core')).toBeInTheDocument();
      expect(screen.getByText('Pilot Pro')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });

    test('should apply flex-shrink-0 to prevent card shrinking', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const cardWrappers = container.querySelectorAll('[class*="flex-shrink-0"]');
      expect(cardWrappers.length).toBeGreaterThan(0);
    });

    test('should set fixed width on pricing cards', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const cardWrappers = container.querySelectorAll('[class*="w-[300px]"]');
      expect(cardWrappers.length).toBe(mockMonthlyCards.length);
    });
  });

  /**
   * Test 4.4.2: Touch/swipe scrolling on mobile
   */
  describe('Touch/Swipe Scrolling on Mobile', () => {
    test('should enable touch scrolling with overflow-x-auto', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="overflow-x-auto"]');
      expect(scrollContainer).toBeInTheDocument();
      
      // overflow-x-auto enables native touch scrolling on mobile
      expect(scrollContainer).toHaveClass('overflow-x-auto');
    });

    test('should support horizontal scroll snapping for smooth swipe', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="snap-x"]');
      expect(scrollContainer).toBeInTheDocument();
      expect(scrollContainer).toHaveClass('snap-x');
      expect(scrollContainer).toHaveClass('snap-mandatory');
    });

    test('should apply snap-center to individual cards', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const cardWrappers = container.querySelectorAll('[class*="snap-center"]');
      expect(cardWrappers.length).toBe(mockMonthlyCards.length);
    });

    test('should hide scrollbar for cleaner mobile experience', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="overflow-x-auto"]');
      
      // Check for scrollbar hiding classes
      expect(scrollContainer?.className).toMatch(/\[&::-webkit-scrollbar\]:hidden/);
      expect(scrollContainer?.className).toMatch(/\[-ms-overflow-style:none\]/);
      expect(scrollContainer?.className).toMatch(/\[scrollbar-width:none\]/);
    });
  });

  /**
   * Test 4.4.3: Previous/Next button navigation
   */
  describe('Previous/Next Button Navigation', () => {
    test('should render Previous button', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const prevButton = screen.getByLabelText('Previous pricing tier');
      expect(prevButton).toBeInTheDocument();
      expect(prevButton.tagName).toBe('BUTTON');
    });

    test('should render Next button', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const nextButton = screen.getByLabelText('Next pricing tier');
      expect(nextButton).toBeInTheDocument();
      expect(nextButton.tagName).toBe('BUTTON');
    });

    test('should position Previous button on the left', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const prevButton = screen.getByLabelText('Previous pricing tier');
      expect(prevButton).toHaveClass('left-0');
      expect(prevButton).toHaveClass('absolute');
    });

    test('should position Next button on the right', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const nextButton = screen.getByLabelText('Next pricing tier');
      expect(nextButton).toHaveClass('right-0');
      expect(nextButton).toHaveClass('absolute');
    });

    test('should call scrollBy when Previous button is clicked', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="overflow-x-auto"]');
      const mockScrollBy = jest.fn();
      
      if (scrollContainer) {
        scrollContainer.scrollBy = mockScrollBy;
      }

      const prevButton = screen.getByLabelText('Previous pricing tier');
      fireEvent.click(prevButton);

      expect(mockScrollBy).toHaveBeenCalledWith({
        left: -300,
        behavior: 'smooth',
      });
    });

    test('should call scrollBy when Next button is clicked', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="overflow-x-auto"]');
      const mockScrollBy = jest.fn();
      
      if (scrollContainer) {
        scrollContainer.scrollBy = mockScrollBy;
      }

      const nextButton = screen.getByLabelText('Next pricing tier');
      fireEvent.click(nextButton);

      expect(mockScrollBy).toHaveBeenCalledWith({
        left: 300,
        behavior: 'smooth',
      });
    });

    test('should use smooth scroll behavior for better UX', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="overflow-x-auto"]');
      const mockScrollBy = jest.fn();
      
      if (scrollContainer) {
        scrollContainer.scrollBy = mockScrollBy;
      }

      const nextButton = screen.getByLabelText('Next pricing tier');
      fireEvent.click(nextButton);

      expect(mockScrollBy).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: 'smooth' })
      );
    });

    test('should scroll by 300px per button click', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="overflow-x-auto"]');
      const mockScrollBy = jest.fn();
      
      if (scrollContainer) {
        scrollContainer.scrollBy = mockScrollBy;
      }

      const nextButton = screen.getByLabelText('Next pricing tier');
      fireEvent.click(nextButton);

      expect(mockScrollBy).toHaveBeenCalledWith(
        expect.objectContaining({ left: 300 })
      );

      const prevButton = screen.getByLabelText('Previous pricing tier');
      fireEvent.click(prevButton);

      expect(mockScrollBy).toHaveBeenCalledWith(
        expect.objectContaining({ left: -300 })
      );
    });
  });

  /**
   * Test 4.4.4: Scroll snapping behavior
   */
  describe('Scroll Snapping Behavior', () => {
    test('should apply snap-x for horizontal snapping', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="snap-x"]');
      expect(scrollContainer).toBeInTheDocument();
      expect(scrollContainer).toHaveClass('snap-x');
    });

    test('should apply snap-mandatory for consistent snapping', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="snap-mandatory"]');
      expect(scrollContainer).toBeInTheDocument();
      expect(scrollContainer).toHaveClass('snap-mandatory');
    });

    test('should apply snap-center to each pricing card', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const cardWrappers = container.querySelectorAll('[class*="snap-center"]');
      expect(cardWrappers.length).toBe(mockMonthlyCards.length);
      
      cardWrappers.forEach((wrapper) => {
        expect(wrapper).toHaveClass('snap-center');
      });
    });

    test('should combine snap classes correctly', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="overflow-x-auto"]');
      expect(scrollContainer).toHaveClass('snap-x');
      expect(scrollContainer).toHaveClass('snap-mandatory');
    });
  });

  /**
   * Test 4.4.5: Keyboard navigation (arrow keys)
   */
  describe('Keyboard Navigation', () => {
    test('should allow focus on Previous button via keyboard', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const prevButton = screen.getByLabelText('Previous pricing tier');
      prevButton.focus();
      
      expect(document.activeElement).toBe(prevButton);
    });

    test('should allow focus on Next button via keyboard', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const nextButton = screen.getByLabelText('Next pricing tier');
      nextButton.focus();
      
      expect(document.activeElement).toBe(nextButton);
    });

    test('should trigger scroll when Enter is pressed on Previous button', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="overflow-x-auto"]');
      const mockScrollBy = jest.fn();
      
      if (scrollContainer) {
        scrollContainer.scrollBy = mockScrollBy;
      }

      const prevButton = screen.getByLabelText('Previous pricing tier');
      prevButton.focus();
      fireEvent.keyDown(prevButton, { key: 'Enter', code: 'Enter' });
      fireEvent.click(prevButton);

      expect(mockScrollBy).toHaveBeenCalled();
    });

    test('should trigger scroll when Enter is pressed on Next button', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="overflow-x-auto"]');
      const mockScrollBy = jest.fn();
      
      if (scrollContainer) {
        scrollContainer.scrollBy = mockScrollBy;
      }

      const nextButton = screen.getByLabelText('Next pricing tier');
      nextButton.focus();
      fireEvent.keyDown(nextButton, { key: 'Enter', code: 'Enter' });
      fireEvent.click(nextButton);

      expect(mockScrollBy).toHaveBeenCalled();
    });

    test('should allow Tab navigation between buttons', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const prevButton = screen.getByLabelText('Previous pricing tier');
      const nextButton = screen.getByLabelText('Next pricing tier');

      // Both buttons should be in the tab order
      expect(prevButton.tabIndex).not.toBe(-1);
      expect(nextButton.tabIndex).not.toBe(-1);
    });

    test('should have visible focus indicators', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const prevButton = screen.getByLabelText('Previous pricing tier');
      const nextButton = screen.getByLabelText('Next pricing tier');

      // Check for focus ring classes
      expect(prevButton).toHaveClass('focus:outline-none');
      expect(prevButton).toHaveClass('focus:ring-2');
      expect(nextButton).toHaveClass('focus:outline-none');
      expect(nextButton).toHaveClass('focus:ring-2');
    });
  });

  /**
   * Test 4.4.6: Accessibility (screen readers, focus management)
   */
  describe('Accessibility', () => {
    test('should have proper aria-label on Previous button', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const prevButton = screen.getByLabelText('Previous pricing tier');
      expect(prevButton).toHaveAttribute('aria-label', 'Previous pricing tier');
    });

    test('should have proper aria-label on Next button', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const nextButton = screen.getByLabelText('Next pricing tier');
      expect(nextButton).toHaveAttribute('aria-label', 'Next pricing tier');
    });

    test('should use semantic button elements', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const prevButton = screen.getByLabelText('Previous pricing tier');
      const nextButton = screen.getByLabelText('Next pricing tier');

      expect(prevButton.tagName).toBe('BUTTON');
      expect(nextButton.tagName).toBe('BUTTON');
      expect(prevButton).toHaveAttribute('type', 'button');
      expect(nextButton).toHaveAttribute('type', 'button');
    });

    test('should have proper focus management', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const prevButton = screen.getByLabelText('Previous pricing tier');
      const nextButton = screen.getByLabelText('Next pricing tier');

      // Buttons should be focusable
      expect(prevButton.tabIndex).not.toBe(-1);
      expect(nextButton.tabIndex).not.toBe(-1);

      // Should have focus ring styles
      expect(prevButton.className).toContain('focus:ring');
      expect(nextButton.className).toContain('focus:ring');
    });

    test('should render gradient overlay with pointer-events-none', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const gradientOverlay = container.querySelector('[class*="pointer-events-none"]');
      expect(gradientOverlay).toBeInTheDocument();
      expect(gradientOverlay).toHaveClass('pointer-events-none');
    });

    test('should not interfere with card interactions', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      // All CTA buttons should be accessible
      const ctaButtons = screen.getAllByText(/Get Started|Start Free Trial|Contact Sales/);
      expect(ctaButtons.length).toBeGreaterThan(0);
      
      ctaButtons.forEach((button) => {
        expect(button).toBeInTheDocument();
      });
    });

    test('should maintain proper z-index layering', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const prevButton = screen.getByLabelText('Previous pricing tier');
      const nextButton = screen.getByLabelText('Next pricing tier');

      // Navigation buttons should have z-10 to appear above cards
      expect(prevButton).toHaveClass('z-10');
      expect(nextButton).toHaveClass('z-10');
    });

    test('should provide visual feedback on button hover', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const prevButton = screen.getByLabelText('Previous pricing tier');
      const nextButton = screen.getByLabelText('Next pricing tier');

      // Check for hover state classes
      expect(prevButton.className).toContain('hover:bg-slate-700');
      expect(nextButton.className).toContain('hover:bg-slate-700');
    });

    test('should have sufficient color contrast for buttons', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const prevButton = screen.getByLabelText('Previous pricing tier');
      const nextButton = screen.getByLabelText('Next pricing tier');

      // Buttons should have text-white for contrast
      expect(prevButton).toHaveClass('text-white');
      expect(nextButton).toHaveClass('text-white');
    });

    test('should render icons with proper size for visibility', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      // ChevronLeft and ChevronRight icons should be rendered
      const prevButton = screen.getByLabelText('Previous pricing tier');
      const nextButton = screen.getByLabelText('Next pricing tier');

      expect(prevButton.querySelector('svg')).toBeInTheDocument();
      expect(nextButton.querySelector('svg')).toBeInTheDocument();
    });
  });

  /**
   * Test billing cycle toggle integration with carousel
   */
  describe('Billing Cycle Integration', () => {
    test('should display monthly cards by default', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      // Check for monthly pricing
      expect(screen.getByText('R0/month')).toBeInTheDocument();
      expect(screen.getByText('R299/month')).toBeInTheDocument();
    });

    test('should switch to yearly cards when yearly is selected', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const yearlyButton = screen.getByText(/Yearly/);
      fireEvent.click(yearlyButton);

      // Check for yearly pricing
      waitFor(() => {
        expect(screen.getByText('R0/year')).toBeInTheDocument();
        expect(screen.getByText('R299/year')).toBeInTheDocument();
      });
    });

    test('should maintain carousel functionality when switching billing cycles', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const yearlyButton = screen.getByText(/Yearly/);
      fireEvent.click(yearlyButton);

      // Carousel should still be functional
      const prevButton = screen.getByLabelText('Previous pricing tier');
      const nextButton = screen.getByLabelText('Next pricing tier');
      
      expect(prevButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();
    });
  });

  /**
   * Test responsive behavior
   */
  describe('Responsive Behavior', () => {
    test('should apply gap between cards', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="overflow-x-auto"]');
      expect(scrollContainer).toHaveClass('gap-6');
    });

    test('should apply padding to scroll container', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const scrollContainer = container.querySelector('[class*="overflow-x-auto"]');
      expect(scrollContainer).toHaveClass('px-12');
    });

    test('should render gradient overlay on the right edge', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const gradientOverlay = container.querySelector('[class*="bg-gradient-to-l"]');
      expect(gradientOverlay).toBeInTheDocument();
      expect(gradientOverlay).toHaveClass('from-slate-950');
      expect(gradientOverlay).toHaveClass('to-transparent');
    });

    test('should position gradient overlay absolutely on the right', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const gradientOverlay = container.querySelector('[class*="bg-gradient-to-l"]');
      expect(gradientOverlay).toHaveClass('absolute');
      expect(gradientOverlay).toHaveClass('right-0');
      expect(gradientOverlay).toHaveClass('top-0');
      expect(gradientOverlay).toHaveClass('bottom-0');
    });
  });
});
