/**
 * This hook manages the fetching and state of the layby list.
 * It handles loading, error, and pagination states, keeping the UI logic clean.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { LaybyListResponse, LaybyStatus } from '../types';

interface UseLaybysProps {
  /** Current page number (1-based) */
  page?: number;
  /** Number of items to return per page */
  perPage?: number;
  /** Filter laybys by their status */
  status?: LaybyStatus | 'all';
  /** Search term for reference number or customer name */
  search?: string;
}

/**
 * Custom hook to fetch and manage a list of laybys.
 * 
 * @param props - Configuration for the layby list fetch
 * @returns Object containing layby data, loading state, error state, and refetch function
 */
export function useLaybys({
  page = 1,
  perPage = 20,
  status = 'all',
  search = '',
}: UseLaybysProps = {}) {
  const [data, setData] = useState<LaybyListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetches layby data from the API based on current filters and pagination.
   */
  const fetchLaybys = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
      });

      if (status !== 'all') {
        params.append('status', status);
      }

      if (search) {
        params.append('search', search);
      }

      const response = await apiClient.get<LaybyListResponse>(`/laybys?${params.toString()}`);
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch laybys:', err);
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, status, search]);

  useEffect(() => {
    fetchLaybys();
  }, [fetchLaybys]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchLaybys,
  };
}
