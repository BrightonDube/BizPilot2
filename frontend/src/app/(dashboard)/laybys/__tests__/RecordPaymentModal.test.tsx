/**
 * RecordPaymentModal.test.tsx
 * Unit tests for the Record Payment modal component.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { recordLaybyPayment } from '../api/recordLaybyPayment';

jest.mock('../api/recordLaybyPayment');

const mockRecordLaybyPayment = recordLaybyPayment as jest.MockedFunction<typeof recordLaybyPayment>;

describe('RecordPaymentModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    laybyId: 'test-layby-id',
    outstandingBalance: 1000,
    onPaymentRecorded: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(<RecordPaymentModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<RecordPaymentModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Record Payment')).not.toBeInTheDocument();
  });

  it('displays outstanding balance formatted as ZAR', () => {
    render(<RecordPaymentModal {...defaultProps} />);
    expect(screen.getByText('Outstanding Balance')).toBeInTheDocument();
    expect(screen.getByText(/R\s*1\s*000,00/)).toBeInTheDocument();
  });

  it('shows validation error when submitting with empty amount', async () => {
    render(<RecordPaymentModal {...defaultProps} />);
    
    const paymentMethodSelect = screen.getByLabelText(/payment method/i);
    fireEvent.change(paymentMethodSelect, { target: { value: 'cash' } });
    
    const form = screen.getByRole('dialog').querySelector('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid amount/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when amount exceeds outstanding balance', async () => {
    render(<RecordPaymentModal {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: '1500' } });
    
    const paymentMethodSelect = screen.getByLabelText(/payment method/i);
    fireEvent.change(paymentMethodSelect, { target: { value: 'cash' } });
    
    const form = screen.getByRole('dialog').querySelector('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText(/cannot exceed outstanding balance/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when no payment method is selected', async () => {
    render(<RecordPaymentModal {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: '500' } });
    
    const form = screen.getByRole('dialog').querySelector('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText(/please select a payment method/i)).toBeInTheDocument();
    });
  });

  it('disables submit button while submitting', async () => {
    mockRecordLaybyPayment.mockImplementation(() => new Promise(() => {}));
    
    render(<RecordPaymentModal {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: '500' } });
    
    const paymentMethodSelect = screen.getByLabelText(/payment method/i);
    fireEvent.change(paymentMethodSelect, { target: { value: 'cash' } });
    
    const submitButton = screen.getByRole('button', { name: /record payment/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it('calls onClose when ESC is pressed and not submitting', () => {
    render(<RecordPaymentModal {...defaultProps} />);
    
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onPaymentRecorded callback on successful submission', async () => {
    mockRecordLaybyPayment.mockResolvedValue({
      id: 'payment-123',
      amount: 500,
      payment_method: 'cash',
      payment_type: 'installment',
      status: 'completed',
      created_at: '2024-01-01T00:00:00Z',
    });

    render(<RecordPaymentModal {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: '500' } });
    
    const paymentMethodSelect = screen.getByLabelText(/payment method/i);
    fireEvent.change(paymentMethodSelect, { target: { value: 'cash' } });
    
    const submitButton = screen.getByRole('button', { name: /record payment/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(defaultProps.onPaymentRecorded).toHaveBeenCalled();
    });
  });

  it('displays error message on failed submission', async () => {
    mockRecordLaybyPayment.mockRejectedValue(new Error('Payment failed'));

    render(<RecordPaymentModal {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: '500' } });
    
    const paymentMethodSelect = screen.getByLabelText(/payment method/i);
    fireEvent.change(paymentMethodSelect, { target: { value: 'cash' } });
    
    const submitButton = screen.getByRole('button', { name: /record payment/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Payment failed')).toBeInTheDocument();
    });
  });
});
