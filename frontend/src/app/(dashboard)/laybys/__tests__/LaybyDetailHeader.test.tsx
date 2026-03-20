import { render, screen } from '@testing-library/react';
import { LaybyDetailHeader } from '../components/LaybyDetailHeader';

describe('LaybyDetailHeader', () => {
  const mockProps = {
    referenceNumber: 'LB-1001',
    customerName: 'John Doe',
    status: 'ACTIVE' as const,
    createdAt: '2024-01-15T10:00:00Z',
  };

  it('renders the reference number', () => {
    render(<LaybyDetailHeader {...mockProps} />);
    expect(screen.getByText('LB-1001')).toBeInTheDocument();
  });

  it('renders the customer name', () => {
    render(<LaybyDetailHeader {...mockProps} />);
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
  });

  it('renders "Back to Laybys" link with correct href', () => {
    render(<LaybyDetailHeader {...mockProps} />);
    const link = screen.getByRole('link', { name: /Back to Laybys/i });
    expect(link).toHaveAttribute('href', '/laybys');
  });

  it('renders the status badge', () => {
    render(<LaybyDetailHeader {...mockProps} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders walk-in customer when no customer name provided', () => {
    render(<LaybyDetailHeader {...mockProps} customerName={undefined} />);
    expect(screen.getByText(/Walk-in Customer/)).toBeInTheDocument();
  });
});
