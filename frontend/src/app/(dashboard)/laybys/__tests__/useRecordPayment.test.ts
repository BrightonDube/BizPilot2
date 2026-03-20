/**
 * useRecordPayment.test.ts
 * Unit tests for the useRecordPayment hook.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useRecordPayment } from '../hooks/useRecordPayment';
import { recordLaybyPayment } from '../api/recordLaybyPayment';

jest.mock('../api/recordLaybyPayment');

const mockRecordLaybyPayment = recordLaybyPayment as jest.MockedFunction<typeof recordLaybyPayment>;

describe('useRecordPayment', () => {
  const defaultParams = {
    laybyId: 'test-layby-id',
    outstandingBalance: 1000,
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('has correct initial state', () => {
    const { result } = renderHook(() => useRecordPayment(defaultParams));

    expect(result.current.amount).toBe('');
    expect(result.current.paymentMethod).toBe('');
    expect(result.current.notes).toBe('');
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('rejects amount of 0', async () => {
    const { result } = renderHook(() => useRecordPayment(defaultParams));

    act(() => {
      result.current.setAmount('0');
      result.current.setPaymentMethod('cash');
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: jest.fn() } as unknown as React.FormEvent);
    });

    expect(result.current.error).toMatch(/valid amount greater than 0/i);
    expect(mockRecordLaybyPayment).not.toHaveBeenCalled();
  });

  it('rejects amount greater than outstandingBalance', async () => {
    const { result } = renderHook(() => useRecordPayment(defaultParams));

    act(() => {
      result.current.setAmount('1500');
      result.current.setPaymentMethod('cash');
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: jest.fn() } as unknown as React.FormEvent);
    });

    expect(result.current.error).toMatch(/cannot exceed outstanding balance/i);
    expect(mockRecordLaybyPayment).not.toHaveBeenCalled();
  });

  it('rejects missing paymentMethod', async () => {
    const { result } = renderHook(() => useRecordPayment(defaultParams));

    act(() => {
      result.current.setAmount('500');
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: jest.fn() } as unknown as React.FormEvent);
    });

    expect(result.current.error).toMatch(/select a payment method/i);
    expect(mockRecordLaybyPayment).not.toHaveBeenCalled();
  });

  it('calls recordLaybyPayment with correct arguments on valid submission', async () => {
    mockRecordLaybyPayment.mockResolvedValue({
      id: 'payment-123',
      amount: 500,
      payment_method: 'cash',
      payment_type: 'installment',
      status: 'completed',
      created_at: '2024-01-01T00:00:00Z',
    });

    const { result } = renderHook(() => useRecordPayment(defaultParams));

    act(() => {
      result.current.setAmount('500');
      result.current.setPaymentMethod('cash');
      result.current.setNotes('Test payment');
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: jest.fn() } as unknown as React.FormEvent);
    });

    expect(mockRecordLaybyPayment).toHaveBeenCalledWith('test-layby-id', {
      amount: 500,
      payment_method: 'cash',
      reference: 'Test payment',
    });
  });

  it('calls onSuccess callback on successful submission', async () => {
    mockRecordLaybyPayment.mockResolvedValue({
      id: 'payment-123',
      amount: 500,
      payment_method: 'cash',
      payment_type: 'installment',
      status: 'completed',
      created_at: '2024-01-01T00:00:00Z',
    });

    const { result } = renderHook(() => useRecordPayment(defaultParams));

    act(() => {
      result.current.setAmount('500');
      result.current.setPaymentMethod('cash');
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: jest.fn() } as unknown as React.FormEvent);
    });

    await waitFor(() => {
      expect(defaultParams.onSuccess).toHaveBeenCalled();
    });
  });

  it('sets error message on failed submission', async () => {
    mockRecordLaybyPayment.mockRejectedValue(new Error('Payment processing failed'));

    const { result } = renderHook(() => useRecordPayment(defaultParams));

    act(() => {
      result.current.setAmount('500');
      result.current.setPaymentMethod('card');
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: jest.fn() } as unknown as React.FormEvent);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Payment processing failed');
    });
  });

  it('does not call onSuccess on failed submission', async () => {
    mockRecordLaybyPayment.mockRejectedValue(new Error('Payment failed'));

    const { result } = renderHook(() => useRecordPayment(defaultParams));

    act(() => {
      result.current.setAmount('500');
      result.current.setPaymentMethod('cash');
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: jest.fn() } as unknown as React.FormEvent);
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(defaultParams.onSuccess).not.toHaveBeenCalled();
  });

  it('does not reset form fields on failed submission', async () => {
    mockRecordLaybyPayment.mockRejectedValue(new Error('Payment failed'));

    const { result } = renderHook(() => useRecordPayment(defaultParams));

    act(() => {
      result.current.setAmount('500');
      result.current.setPaymentMethod('cash');
      result.current.setNotes('Test note');
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: jest.fn() } as unknown as React.FormEvent);
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.amount).toBe('500');
    expect(result.current.paymentMethod).toBe('cash');
    expect(result.current.notes).toBe('Test note');
  });

  it('resets form fields on successful submission', async () => {
    mockRecordLaybyPayment.mockResolvedValue({
      id: 'payment-123',
      amount: 500,
      payment_method: 'cash',
      payment_type: 'installment',
      status: 'completed',
      created_at: '2024-01-01T00:00:00Z',
    });

    const { result } = renderHook(() => useRecordPayment(defaultParams));

    act(() => {
      result.current.setAmount('500');
      result.current.setPaymentMethod('cash');
      result.current.setNotes('Test note');
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: jest.fn() } as unknown as React.FormEvent);
    });

    await waitFor(() => {
      expect(defaultParams.onSuccess).toHaveBeenCalled();
    });

    expect(result.current.amount).toBe('');
    expect(result.current.paymentMethod).toBe('');
    expect(result.current.notes).toBe('');
  });
});
