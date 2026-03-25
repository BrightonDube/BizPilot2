/**
 * useExtendLayby.test.ts
 * Unit tests for the useExtendLayby hook.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useExtendLayby } from '../hooks/useExtendLayby';

jest.mock('@/lib/api', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

import { apiClient } from '@/lib/api';

const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;

describe('useExtendLayby', () => {
  const defaultParams = {
    laybyId: 'layby-789',
    onSuccess: jest.fn(),
  };

  const mockSubmit = { preventDefault: jest.fn() } as unknown as React.FormEvent;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('has correct initial state', () => {
    const { result } = renderHook(() => useExtendLayby(defaultParams));
    expect(result.current.additionalDays).toBe('');
    expect(result.current.reason).toBe('');
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('rejects missing additionalDays', async () => {
    const { result } = renderHook(() => useExtendLayby(defaultParams));

    await act(async () => {
      await result.current.handleExtend(mockSubmit);
    });

    expect(result.current.error).toMatch(/valid number of days/i);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('rejects additionalDays of 0', async () => {
    const { result } = renderHook(() => useExtendLayby(defaultParams));

    act(() => {
      result.current.setAdditionalDays('0');
    });

    await act(async () => {
      await result.current.handleExtend(mockSubmit);
    });

    expect(result.current.error).toMatch(/valid number of days/i);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('rejects additionalDays > 365', async () => {
    const { result } = renderHook(() => useExtendLayby(defaultParams));

    act(() => {
      result.current.setAdditionalDays('366');
    });

    await act(async () => {
      await result.current.handleExtend(mockSubmit);
    });

    expect(result.current.error).toMatch(/365 days/i);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('calls POST /laybys/{id}/extend with correct body', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useExtendLayby(defaultParams));

    act(() => {
      result.current.setAdditionalDays('30');
      result.current.setReason('Customer requested more time');
    });

    await act(async () => {
      await result.current.handleExtend(mockSubmit);
    });

    expect(mockPost).toHaveBeenCalledWith('/laybys/layby-789/extend', {
      additional_days: 30,
      reason: 'Customer requested more time',
    });
  });

  it('omits reason when not provided', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useExtendLayby(defaultParams));

    act(() => {
      result.current.setAdditionalDays('14');
    });

    await act(async () => {
      await result.current.handleExtend(mockSubmit);
    });

    expect(mockPost).toHaveBeenCalledWith('/laybys/layby-789/extend', {
      additional_days: 14,
      reason: undefined,
    });
  });

  it('calls onSuccess and resets form on success', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useExtendLayby(defaultParams));

    act(() => {
      result.current.setAdditionalDays('7');
      result.current.setReason('Holiday period');
    });

    await act(async () => {
      await result.current.handleExtend(mockSubmit);
    });

    await waitFor(() => {
      expect(defaultParams.onSuccess).toHaveBeenCalled();
    });

    expect(result.current.additionalDays).toBe('');
    expect(result.current.reason).toBe('');
  });

  it('sets error message on API failure', async () => {
    mockPost.mockRejectedValue({ response: { data: { detail: 'Maximum extensions reached' } } });
    const { result } = renderHook(() => useExtendLayby(defaultParams));

    act(() => {
      result.current.setAdditionalDays('30');
    });

    await act(async () => {
      await result.current.handleExtend(mockSubmit);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Maximum extensions reached');
    });
    expect(defaultParams.onSuccess).not.toHaveBeenCalled();
  });
});
