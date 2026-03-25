/**
 * useCollectLayby.test.ts
 * Unit tests for the useCollectLayby hook.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useCollectLayby } from '../hooks/useCollectLayby';

jest.mock('@/lib/api', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

import { apiClient } from '@/lib/api';

const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;

describe('useCollectLayby', () => {
  const defaultParams = {
    laybyId: 'layby-123',
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('has correct initial state', () => {
    const { result } = renderHook(() => useCollectLayby(defaultParams));
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('calls POST /laybys/{id}/collect with no body on handleCollect', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useCollectLayby(defaultParams));

    await act(async () => {
      await result.current.handleCollect();
    });

    expect(mockPost).toHaveBeenCalledWith('/laybys/layby-123/collect');
  });

  it('calls onSuccess after successful collection', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useCollectLayby(defaultParams));

    await act(async () => {
      await result.current.handleCollect();
    });

    await waitFor(() => {
      expect(defaultParams.onSuccess).toHaveBeenCalled();
    });
  });

  it('sets error message on API failure', async () => {
    mockPost.mockRejectedValue({ response: { data: { detail: 'Layby is not ready for collection' } } });
    const { result } = renderHook(() => useCollectLayby(defaultParams));

    await act(async () => {
      await result.current.handleCollect();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Layby is not ready for collection');
    });
    expect(defaultParams.onSuccess).not.toHaveBeenCalled();
  });

  it('falls back to generic error message when detail is missing', async () => {
    mockPost.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useCollectLayby(defaultParams));

    await act(async () => {
      await result.current.handleCollect();
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it('clears error on subsequent successful call', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'));
    mockPost.mockResolvedValueOnce({ data: {} });

    const { result } = renderHook(() => useCollectLayby(defaultParams));

    await act(async () => {
      await result.current.handleCollect();
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());

    await act(async () => {
      await result.current.handleCollect();
    });
    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
