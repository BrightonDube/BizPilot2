/**
 * Grid Layout Tests for PricingClientWrapper
 * 
 * These tests validate the responsive grid layout including:
 * - Grid layout on desktop (5 columns)
 * - Responsive breakpoints (1 → 2 → 3 → 5 columns)
 * - All pricing cards rendered correctly
 * - Billing cycle toggle
 * - Featured card styling
 * - Accessibility
 * 
 * **Replaces: PricingCarousel.test.tsx (carousel removed in favor of grid)**
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
      <div className={className} data-testid={props['data-testid'] as string}>
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

describe('PricingClientWrapper - Grid Layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).location;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.location = { search: '' } as any;
  });

  describe('Grid Structure', () => {
    test('should render grid container instead of carousel', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const gridContainer = container.querySelector('[class*="grid"]');
      expect(gridContainer).toBeInTheDocument();

      // Should NOT have carousel elements
      const carouselContainer = container.querySelector('[class*="overflow-x-auto"]');
      expect(carouselContainer).not.toBeInTheDocument();
    });

    test('should use responsive grid columns', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const gridContainer = container.querySelector('[class*="grid"]');
      expect(gridContainer).toBeInTheDocument();

      // Check responsive breakpoints
      expect(gridContainer).toHaveClass('grid-cols-1');
      expect(gridContainer).toHaveClass('md:grid-cols-2');
      expect(gridContainer).toHaveClass('lg:grid-cols-3');
      expect(gridContainer).toHaveClass('xl:grid-cols-5');
    });

    test('should apply gap between grid cards', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const gridContainer = container.querySelector('[class*="grid"]');
      expect(gridContainer).toHaveClass('gap-6');
    });

    test('should constrain max width for readability', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const gridContainer = container.querySelector('[class*="grid"]');
      expect(gridContainer).toHaveClass('max-w-7xl');
      expect(gridContainer).toHaveClass('mx-auto');
    });

    test('should NOT render prev/next navigation buttons', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      expect(screen.queryByLabelText('Previous pricing tier')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Next pricing tier')).not.toBeInTheDocument();
    });
  });

  describe('Card Rendering', () => {
    test('should render all 5 pricing tiers', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      expect(screen.getByText('Pilot Solo')).toBeInTheDocument();
      expect(screen.getByText('Pilot Lite')).toBeInTheDocument();
      expect(screen.getByText('Pilot Core')).toBeInTheDocument();
      expect(screen.getByText('Pilot Pro')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });

    test('should render monthly pricing by default', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      expect(screen.getByText('R0/month')).toBeInTheDocument();
      expect(screen.getByText('R299/month')).toBeInTheDocument();
      expect(screen.getByText('R599/month')).toBeInTheDocument();
      expect(screen.getByText('R999/month')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    test('should render benefits for each card', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      expect(screen.getByText('Simple inventory tracking')).toBeInTheDocument();
      expect(screen.getByText('POS System')).toBeInTheDocument();
      expect(screen.getByText('Advanced POS')).toBeInTheDocument();
      expect(screen.getByText('SLA guarantees')).toBeInTheDocument();
    });

    test('should render CTA buttons for each card', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      expect(screen.getByText('Get Started')).toBeInTheDocument();
      expect(screen.getAllByText('Start Free Trial').length).toBe(3);
      expect(screen.getByText('Contact Sales')).toBeInTheDocument();
    });

    test('should apply featured styling to highlighted card', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      // Featured card (Pilot Lite) gets scale treatment
      const scaledCard = container.querySelector('[class*="lg:scale-105"]');
      expect(scaledCard).toBeInTheDocument();
    });

    test('should render "Most Popular" badge on featured card', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });
  });

  describe('Billing Cycle Toggle', () => {
    test('should render monthly and yearly toggle buttons', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      expect(screen.getByText('Monthly')).toBeInTheDocument();
      expect(screen.getByText(/Yearly/)).toBeInTheDocument();
    });

    test('should show "Save 20%" on yearly button', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      expect(screen.getByText('Save 20%')).toBeInTheDocument();
    });

    test('should highlight monthly toggle by default', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const monthlyButton = screen.getByText('Monthly');
      expect(monthlyButton.className).toContain('bg-purple-600');
    });

    test('should switch to yearly cards when yearly is selected', async () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const yearlyButton = screen.getByText(/Yearly/);
      fireEvent.click(yearlyButton);

      await waitFor(() => {
        expect(screen.getByText('R0/year')).toBeInTheDocument();
        expect(screen.getByText('R299/year')).toBeInTheDocument();
      });
    });

    test('should switch back to monthly when monthly is selected', async () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      // Switch to yearly
      fireEvent.click(screen.getByText(/Yearly/));
      await waitFor(() => {
        expect(screen.getByText('R0/year')).toBeInTheDocument();
      });

      // Switch back to monthly
      fireEvent.click(screen.getByText('Monthly'));
      await waitFor(() => {
        expect(screen.getByText('R0/month')).toBeInTheDocument();
      });
    });

    test('should show enterprise pricing note', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      expect(screen.getByText(/Enterprise pricing is custom/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should render all CTA elements as links or buttons', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const ctaElements = screen.getAllByText(/Get Started|Start Free Trial|Contact Sales/);
      expect(ctaElements.length).toBeGreaterThan(0);

      ctaElements.forEach((el) => {
        const tag = el.tagName.toLowerCase();
        expect(['a', 'button']).toContain(tag);
      });
    });

    test('should use type="button" on billing toggle buttons', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      const monthlyBtn = screen.getByText('Monthly');
      expect(monthlyBtn).toHaveAttribute('type', 'button');
    });

    test('should render bestFor descriptions for each tier', () => {
      render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      expect(screen.getByText('Getting started')).toBeInTheDocument();
      expect(screen.getByText('Small businesses')).toBeInTheDocument();
      expect(screen.getByText('Growing businesses')).toBeInTheDocument();
      expect(screen.getByText('Established businesses')).toBeInTheDocument();
      expect(screen.getByText('Large organizations')).toBeInTheDocument();
    });

    test('should render check/x icons for benefits', () => {
      const { container } = render(
        <PricingClientWrapper
          monthlyCards={mockMonthlyCards}
          yearlyCards={mockYearlyCards}
        />
      );

      // Check icons (benefits with checked: true)
      const checkIcons = container.querySelectorAll('[class*="bg-"]');
      expect(checkIcons.length).toBeGreaterThan(0);
    });
  });
});
