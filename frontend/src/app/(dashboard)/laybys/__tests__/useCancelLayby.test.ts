/**
 * useCancelLayby.test.ts
 * Unit tests for the useCancelLayby hook.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useCancelLayby } from '../hooks/useCancelLayby';

jest.mock('@/lib/api', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

import { apiClient } from '@/lib/api';

const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;

describe('useCancelLayby', () => {
  const defaultParams = {
    laybyId: 'layby-456',
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('has correct initial state', () => {
    const { result } = renderHook(() => useCancelLayby(defaultParams));
    expect(result.current.reason).toBe('');
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('calls POST /laybys/{id}/cancel with empty body when no reason provided', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useCancelLayby(defaultParams));

    await act(async () => {
      await result.current.handleCancel();
    });

    expect(mockPost).toHaveBeenCalledWith('/laybys/layby-456/cancel', {});
  });

  it('includes reason in request body when provided', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useCancelLayby(defaultParams));

    act(() => {
      result.current.setReason('Customer request');
    });

    await act(async () => {
      await result.current.handleCancel();
    });

    expect(mockPost).toHaveBeenCalledWith('/laybys/layby-456/cancel', { reason: 'Customer request' });
  });

  it('calls onSuccess after successful cancellation', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useCancelLayby(defaultParams));

    await act(async () => {
      await result.current.handleCancel();
    });

    await waitFor(() => {
      expect(defaultParams.onSuccess).toHaveBeenCalled();
    });
  });

  it('sets error on API failure', async () => {
    mockPost.mockRejectedValue({ response: { data: { detail: 'Cannot cancel a completed layby' } } });
    const { result } = renderHook(() => useCancelLayby(defaultParams));

    await act(async () => {
      await result.current.handleCancel();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Cannot cancel a completed layby');
    });
    expect(defaultParams.onSuccess).not.toHaveBeenCalled();
  });

  it('does not reset reason field on failure', async () => {
    mockPost.mockRejectedValue(new Error('Server error'));
    const { result } = renderHook(() => useCancelLayby(defaultParams));

    act(() => {
      result.current.setReason('Original reason');
    });

    await act(async () => {
      await result.current.handleCancel();
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.reason).toBe('Original reason');
  });
});
