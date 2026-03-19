import { render, screen } from '@testing-library/react';
import { LaybyPaymentHistory } from '../components/LaybyPaymentHistory';
import type { LaybyPayment } from '../types';

describe('LaybyPaymentHistory', () => {
  const mockPayments: LaybyPayment[] = [
    {
      id: '1',
      amount: 1000,
      payment_method: 'cash',
      payment_type: 'deposit',
      status: 'completed',
      created_at: '2024-01-15T10:00:00Z',
    },
    {
      id: '2',
      amount: 500,
      payment_method: 'card',
      payment_type: 'installment',
      status: 'completed',
      notes: 'Partial payment',
      created_at: '2024-01-20T14:30:00Z',
    },
  ];

  it('renders payment rows correctly', () => {
    render(<LaybyPaymentHistory payments={mockPayments} />);

    expect(screen.getByText('R 1 000,00')).toBeInTheDocument();
    expect(screen.getByText('R 500,00')).toBeInTheDocument();
    expect(screen.getByText('cash')).toBeInTheDocument();
    expect(screen.getByText('card')).toBeInTheDocument();
    expect(screen.getByText('Partial payment')).toBeInTheDocument();
  });

  it('shows empty state when payments array is empty', () => {
    render(<LaybyPaymentHistory payments={[]} />);
    expect(screen.getByText('No payments recorded')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(<LaybyPaymentHistory payments={mockPayments} />);
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Method')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
  });

  it('displays em dash for missing notes', () => {
    const paymentsWithoutNotes: LaybyPayment[] = [
      {
        id: '1',
        amount: 1000,
        payment_method: 'cash',
        payment_type: 'deposit',
        status: 'completed',
        created_at: '2024-01-15T10:00:00Z',
      },
    ];

    render(<LaybyPaymentHistory payments={paymentsWithoutNotes} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
