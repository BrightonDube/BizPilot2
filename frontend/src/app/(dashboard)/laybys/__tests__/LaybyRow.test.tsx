/**
 * Unit tests for LaybyRow component.
 * Tests that layby information is displayed correctly and links work as expected.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { LaybyRow } from '../components/LaybyRow';
import { Layby } from '../types';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock the LaybyStatusBadge component
jest.mock('../components/LaybyStatusBadge', () => ({
  LaybyStatusBadge: ({ status }: { status: string }) => <div data-testid="status-badge">{status}</div>,
}));

describe('LaybyRow', () => {
  const mockLayby: Layby = {
    id: 'layby-123',
    reference_number: 'LB-1001',
    customer_id: 'customer-456',
    customer_name: 'John Doe',
    status: 'ACTIVE',
    subtotal: 1000,
    tax_amount: 150,
    total_amount: 1150,
    deposit_amount: 200,
    amount_paid: 350,
    balance_due: 800,
    payment_frequency: 'weekly',
    start_date: '2024-01-01',
    end_date: '2024-03-01',
    extension_count: 0,
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
  };

  /**
   * Test that customer name renders correctly.
   */
  test('renders customer name', () => {
    render(<LaybyRow layby={mockLayby} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  /**
   * Test that reference number renders correctly.
   */
  test('renders reference number', () => {
    render(<LaybyRow layby={mockLayby} />);
    expect(screen.getByText('LB-1001')).toBeInTheDocument();
  });

  /**
   * Test that outstanding balance renders correctly formatted.
   */
  test('renders outstanding balance formatted as currency', () => {
    render(<LaybyRow layby={mockLayby} />);
    // Should format 800 as ZAR 800.00
    expect(screen.getByText(/Balance: R\s*800\.00/)).toBeInTheDocument();
  });

  /**
   * Test that total amount renders correctly formatted.
   */
  test('renders total amount formatted as currency', () => {
    render(<LaybyRow layby={mockLayby} />);
    // Should format 1150 as ZAR 1,150.00
    expect(screen.getByText(/R\s*1,150\.00/)).toBeInTheDocument();
  });

  /**
   * Test that paid amount renders correctly formatted.
   */
  test('renders paid amount formatted as currency', () => {
    render(<LaybyRow layby={mockLayby} />);
    // Should format 350 as ZAR 350.00
    expect(screen.getByText(/Paid: R\s*350\.00/)).toBeInTheDocument();
  });

  /**
   * Test that the "View" link points to the correct URL.
   */
  test('renders link to layby details page', () => {
    render(<LaybyRow layby={mockLayby} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/laybys/layby-123');
  });

  /**
   * Test that status badge is rendered with correct status.
   */
  test('renders status badge with correct status', () => {
    render(<LaybyRow layby={mockLayby} />);
    const statusBadge = screen.getByTestId('status-badge');
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge).toHaveTextContent('ACTIVE');
  });

  /**
   * Test that creation date is formatted correctly.
   */
  test('renders formatted creation date', () => {
    render(<LaybyRow layby={mockLayby} />);
    // Should format '2024-01-01T10:00:00Z' as a readable date
    expect(screen.getByText(/Jan\s+\d{1,2},\s+2024/)).toBeInTheDocument();
  });

  /**
   * Test that fallback customer name displays for missing customer.
   */
  test('displays "Walk-in Customer" when customer name is missing', () => {
    const laybyWithoutCustomer = { ...mockLayby, customer_name: undefined };
    render(<LaybyRow layby={laybyWithoutCustomer} />);
    expect(screen.getByText('Walk-in Customer')).toBeInTheDocument();
  });

  /**
   * Test that all monetary values are formatted with South African Rand.
   */
  test('formats all monetary values with ZAR currency', () => {
    render(<LaybyRow layby={mockLayby} />);
    
    // Check that all monetary values include the R symbol
    expect(screen.getByText(/R\s*1,150\.00/)).toBeInTheDocument(); // Total
    expect(screen.getByText(/Paid: R\s*350\.00/)).toBeInTheDocument(); // Paid
    expect(screen.getByText(/Balance: R\s*800\.00/)).toBeInTheDocument(); // Balance
  });

  /**
   * Test that the row has proper styling classes.
   */
  test('applies correct CSS classes for styling', () => {
    render(<LaybyRow layby={mockLayby} />);
    const rowContainer = screen.getByRole('link').firstChild as HTMLElement;
    expect(rowContainer).toHaveClass(
      'bg-gray-800/50',
      'border',
      'border-gray-700',
      'hover:border-gray-600',
      'transition-all',
      'cursor-pointer',
      'rounded-lg',
      'p-4'
    );
  });
});
