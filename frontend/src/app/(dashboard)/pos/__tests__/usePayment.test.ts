/**
 * usePayment.test.ts
 * Task 14.2: Test order sync after reconnection — verifies that failed order
 * submissions are handled gracefully and orders can be retried on reconnect.
 */

import { renderHook, act } from '@testing-library/react';
import { usePayment } from '@/hooks/usePayment';
import { apiClient } from '@/lib/api';
import type { CartState } from '../types';

jest.mock('@/lib/api', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const mockCart: CartState = {
  items: [
    {
      id: 'item-1',
      product_id: 'prod-1',
      product_name: 'Test Product',
      quantity: 2,
      unit_price: 50,
      discount_amount: 0,
      discount_type: 'fixed',
      line_total: 100,
    },
  ],
  customer_id: null,
  customer_name: null,
  subtotal: 100,
  tax_rate: 0.15,
  tax_amount: 15,
  discount_amount: 0,
  grand_total: 115,
  notes: null,
};

describe('usePayment Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initialises payment state from cart totals', () => {
    const { result } = renderHook(() => usePayment(mockCart));

    expect(result.current.payment.total_due).toBe(115);
    expect(result.current.payment.balance_remaining).toBe(115);
    expect(result.current.payment.tender_lines).toHaveLength(0);
    expect(result.current.payment.status).toBe('pending');
  });

  it('adds a tender line and updates balance', () => {
    const { result } = renderHook(() => usePayment(mockCart));

    act(() => {
      result.current.addTender('cash-1', 'Cash', 'cash', 60);
    });

    expect(result.current.payment.tender_lines).toHaveLength(1);
    expect(result.current.payment.total_tendered).toBe(60);
    expect(result.current.payment.balance_remaining).toBe(55);
  });

  it('calculates change due when over-tendered', () => {
    const { result } = renderHook(() => usePayment(mockCart));

    act(() => {
      result.current.addTender('cash-1', 'Cash', 'cash', 200);
    });

    expect(result.current.payment.balance_remaining).toBe(0);
    expect(result.current.payment.change_due).toBe(85);
  });

  it('removes a tender line and restores balance', () => {
    const { result } = renderHook(() => usePayment(mockCart));

    act(() => {
      result.current.addTender('cash-1', 'Cash', 'cash', 115);
    });

    const lineId = result.current.payment.tender_lines[0].id;

    act(() => {
      result.current.removeTender(lineId);
    });

    expect(result.current.payment.tender_lines).toHaveLength(0);
    expect(result.current.payment.balance_remaining).toBe(115);
  });

  it('submits order successfully', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: { id: 'order-123' } });

    const { result } = renderHook(() => usePayment(mockCart));

    act(() => {
      result.current.addTender('cash-1', 'Cash', 'cash', 115);
    });

    let submitResult: Awaited<ReturnType<typeof result.current.submitOrder>>;
    await act(async () => {
      submitResult = await result.current.submitOrder();
    });

    expect(submitResult!.success).toBe(true);
    expect(submitResult!.order_id).toBe('order-123');
    expect(result.current.payment.status).toBe('completed');
  });

  // Task 14.2: Test order sync after reconnection
  it('handles network failure gracefully and returns error (offline scenario)', async () => {
    mockApiClient.post.mockRejectedValueOnce(new Error('Network Error'));

    const { result } = renderHook(() => usePayment(mockCart));

    act(() => {
      result.current.addTender('cash-1', 'Cash', 'cash', 115);
    });

    let submitResult: Awaited<ReturnType<typeof result.current.submitOrder>>;
    await act(async () => {
      submitResult = await result.current.submitOrder();
    });

    expect(submitResult!.success).toBe(false);
    expect(submitResult!.error).toBe('Network Error');
    expect(result.current.payment.status).toBe('failed');
  });

  it('retains tender lines after failed submission (allows retry on reconnect)', async () => {
    mockApiClient.post.mockRejectedValueOnce(new Error('Network Error'));

    const { result } = renderHook(() => usePayment(mockCart));

    act(() => {
      result.current.addTender('cash-1', 'Cash', 'cash', 115);
    });

    await act(async () => {
      await result.current.submitOrder();
    });

    // Tender lines must be preserved so the operator can retry
    expect(result.current.payment.tender_lines).toHaveLength(1);
    expect(result.current.payment.total_tendered).toBe(115);

    // Simulate reconnection — second attempt succeeds
    mockApiClient.post.mockResolvedValueOnce({ data: { id: 'order-456' } });

    let retryResult: Awaited<ReturnType<typeof result.current.submitOrder>>;
    await act(async () => {
      retryResult = await result.current.submitOrder();
    });

    expect(retryResult!.success).toBe(true);
    expect(retryResult!.order_id).toBe('order-456');
  });

  it('sends correct order payload to backend', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: { id: 'order-789' } });

    const { result } = renderHook(() => usePayment(mockCart));

    act(() => {
      result.current.addTender('cash-1', 'Cash', 'cash', 115);
    });

    await act(async () => {
      await result.current.submitOrder();
    });

    expect(mockApiClient.post).toHaveBeenCalledWith('/orders', expect.objectContaining({
      total_amount: 115,
      tax_amount: 15,
      items: expect.arrayContaining([
        expect.objectContaining({ product_id: 'prod-1', quantity: 2 })
      ]),
      payments: expect.arrayContaining([
        expect.objectContaining({ amount: 115, transaction_type: 'cash' })
      ]),
    }));
  });
});
