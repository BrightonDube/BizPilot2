/**
 * useCollectLayby.ts
 * Manages state and submission logic for marking a layby as collected.
 */

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';

interface UseCollectLaybyParams {
  laybyId: string;
  onSuccess: () => void;
}

interface UseCollectLaybyReturn {
  isSubmitting: boolean;
  error: string | null;
  handleCollect: () => Promise<void>;
}

export function useCollectLayby({
  laybyId,
  onSuccess,
}: UseCollectLaybyParams): UseCollectLaybyReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCollect = useCallback(async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post(`/laybys/${laybyId}/collect`);
      onSuccess();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(axiosError.response?.data?.detail ?? axiosError.message ?? 'Failed to mark layby as collected');
    } finally {
      setIsSubmitting(false);
    }
  }, [laybyId, onSuccess]);

  return { isSubmitting, error, handleCollect };
}
