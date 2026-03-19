/**
 * Unit tests for LaybyStatusBadge component.
 * Tests badge rendering for different layby statuses.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { LaybyStatusBadge } from '../components/LaybyStatusBadge';
import { LaybyStatus } from '../types';

describe('LaybyStatusBadge', () => {
  /**
   * Test that each status renders the correct label.
   */
  test.each([
    ['ACTIVE' as LaybyStatus, 'Active'],
    ['OVERDUE' as LaybyStatus, 'Overdue'],
    ['READY_FOR_COLLECTION' as LaybyStatus, 'Ready for Collection'],
    ['COMPLETED' as LaybyStatus, 'Completed'],
    ['CANCELLED' as LaybyStatus, 'Cancelled'],
  ])('renders correct label for %s status', (status, expectedLabel) => {
    render(<LaybyStatusBadge status={status} />);
    const badge = screen.getByText(expectedLabel);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('inline-flex', 'items-center', 'rounded-full', 'px-2.5', 'py-0.5', 'text-xs', 'font-medium', 'border');
  });

  /**
   * Test that each status has the correct CSS classes for styling.
   */
  test.each([
    ['ACTIVE' as LaybyStatus, 'bg-blue-500/20', 'text-blue-400', 'border-blue-500/30'],
    ['OVERDUE' as LaybyStatus, 'bg-red-500/20', 'text-red-400', 'border-red-500/30'],
    ['READY_FOR_COLLECTION' as LaybyStatus, 'bg-green-500/20', 'text-green-400', 'border-green-500/30'],
    ['COMPLETED' as LaybyStatus, 'bg-gray-500/20', 'text-gray-400', 'border-gray-500/30'],
    ['CANCELLED' as LaybyStatus, 'bg-gray-500/20', 'text-gray-400', 'border-gray-500/30'],
  ])('applies correct styling for %s status', (status, ...expectedClasses) => {
    render(<LaybyStatusBadge status={status} />);
    const badge = screen.getByText(status === 'READY_FOR_COLLECTION' ? 'Ready for Collection' : 
                                   status === 'ACTIVE' ? 'Active' : 
                                   status === 'OVERDUE' ? 'Overdue' : 
                                   status === 'COMPLETED' ? 'Completed' : 'Cancelled');
    
    expectedClasses.forEach(className => {
      expect(badge).toHaveClass(className);
    });
  });

  /**
   * Test that additional className props are applied.
   */
  test('applies additional className when provided', () => {
    render(<LaybyStatusBadge status="ACTIVE" className="extra-class" />);
    const badge = screen.getByText('Active');
    expect(badge).toHaveClass('extra-class');
  });

  /**
   * Test defensive behavior with unknown status (should default to ACTIVE styling).
   */
  test('handles unknown status gracefully', () => {
    // This test ensures the component doesn't crash with invalid status
    // Since TypeScript prevents invalid status at compile time, we test runtime behavior
    // by casting to any (simulating a potential runtime issue)
    const invalidStatus = 'UNKNOWN_STATUS' as any;
    
    // The component should not crash and should render something
    expect(() => {
      render(<LaybyStatusBadge status={invalidStatus} />);
    }).not.toThrow();
    
    // It should default to ACTIVE styling (the fallback in statusConfig)
    const badge = screen.getByText('Active'); // Falls back to ACTIVE config
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-blue-500/20', 'text-blue-400', 'border-blue-500/30');
  });
});
