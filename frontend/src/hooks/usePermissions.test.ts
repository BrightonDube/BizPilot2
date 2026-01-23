/**
 * Unit tests for usePermissions hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { usePermissions, Permissions, clearPermissionsCache } from './usePermissions';
import { apiClient } from '@/lib/api';

// Mock the API client
jest.mock('@/lib/api');
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('usePermissions', () => {
  const mockPermissions: Permissions = {
    granted_features: ['pos_core', 'inventory_basic', 'payroll'],
    tier: 'professional',
    status: 'active',
    demo_expires_at: null,
    device_limit: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearPermissionsCache();
  });

  it('should fetch permissions on mount', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ data: mockPermissions });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.permissions).toEqual(mockPermissions);
    expect(result.current.error).toBeNull();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/permissions/me');
  });

  it('should check if feature is granted', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ data: mockPermissions });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasFeature('payroll')).toBe(true);
    expect(result.current.hasFeature('ai_assistant')).toBe(false);
  });

  it('should detect demo mode', async () => {
    const demoPermissions: Permissions = {
      ...mockPermissions,
      status: 'demo',
      demo_expires_at: '2025-12-31T23:59:59Z',
    };

    mockedApiClient.get.mockResolvedValueOnce({ data: demoPermissions });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isDemo()).toBe(true);
  });

  it('should not be in demo mode when demo_expires_at is null', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ data: mockPermissions });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isDemo()).toBe(false);
  });

  it('should handle fetch errors', async () => {
    const errorMessage = 'Network error';
    mockedApiClient.get.mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.permissions).toBeNull();
  });

  it('should allow manual refetch', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ data: mockPermissions });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockedApiClient.get).toHaveBeenCalledTimes(1);

    // Refetch
    const updatedPermissions: Permissions = {
      ...mockPermissions,
      tier: 'enterprise',
    };
    mockedApiClient.get.mockResolvedValueOnce({ data: updatedPermissions });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.permissions?.tier).toBe('enterprise');
    });

    expect(mockedApiClient.get).toHaveBeenCalledTimes(2);
  });

  it('should return false for hasFeature when permissions are null', () => {
    mockedApiClient.get.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => usePermissions());

    expect(result.current.hasFeature('payroll')).toBe(false);
  });

  it('should return false for isDemo when permissions are null', () => {
    mockedApiClient.get.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => usePermissions());

    expect(result.current.isDemo()).toBe(false);
  });
});
