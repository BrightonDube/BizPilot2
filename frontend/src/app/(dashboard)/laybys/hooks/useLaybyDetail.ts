import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import type { LaybyDetail } from '../types';

interface UseLaybyDetailReturn {
  layby: LaybyDetail | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
  refetch: () => Promise<void>;
}

export function useLaybyDetail(id: string): UseLaybyDetailReturn {
  const [layby, setLayby] = useState<LaybyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const fetchLayby = useCallback(async () => {
    if (!id) return;
    
    try {
      setIsLoading(true);
      setError(null);
      setNotFound(false);
      const response = await apiClient.get<LaybyDetail>(`/laybys/${id}`);
      setLayby(response.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
      if (axiosErr.response?.status === 404) {
        setNotFound(true);
        setError('Layby not found');
      } else {
        setError(axiosErr.response?.data?.detail || 'Failed to load layby details');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLayby();
  }, [fetchLayby]);

  return { layby, isLoading, error, notFound, refetch: fetchLayby };
}
