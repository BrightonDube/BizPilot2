/**
 * useCancelLayby.ts
 * Manages state and submission logic for cancelling a layby.
 */

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';

interface UseCancelLaybyParams {
  laybyId: string;
  onSuccess: () => void;
}

interface UseCancelLaybyReturn {
  reason: string;
  setReason: (value: string) => void;
  isSubmitting: boolean;
  error: string | null;
  handleCancel: () => Promise<void>;
}

export function useCancelLayby({
  laybyId,
  onSuccess,
}: UseCancelLaybyParams): UseCancelLaybyReturn {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = useCallback(async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post(`/laybys/${laybyId}/cancel`, reason ? { reason } : {});
      onSuccess();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(axiosError.response?.data?.detail ?? axiosError.message ?? 'Failed to cancel layby');
    } finally {
      setIsSubmitting(false);
    }
  }, [laybyId, reason, onSuccess]);

  return { reason, setReason, isSubmitting, error, handleCancel };
}
