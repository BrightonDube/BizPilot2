/**
 * useExtendLayby.ts
 * Manages state and submission logic for extending a layby's end date.
 */

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';

interface UseExtendLaybyParams {
  laybyId: string;
  onSuccess: () => void;
}

interface UseExtendLaybyReturn {
  additionalDays: string;
  setAdditionalDays: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  isSubmitting: boolean;
  error: string | null;
  handleExtend: (e: React.FormEvent) => Promise<void>;
}

export function useExtendLayby({
  laybyId,
  onSuccess,
}: UseExtendLaybyParams): UseExtendLaybyReturn {
  const [additionalDays, setAdditionalDays] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const days = parseInt(additionalDays, 10);
      if (!additionalDays || isNaN(days) || days < 1) {
        setError('Please enter a valid number of days (minimum 1)');
        return;
      }
      if (days > 365) {
        setError('Cannot extend by more than 365 days at a time');
        return;
      }

      setIsSubmitting(true);
      try {
        await apiClient.post(`/laybys/${laybyId}/extend`, {
          additional_days: days,
          reason: reason || undefined,
        });
        setAdditionalDays('');
        setReason('');
        onSuccess();
      } catch (err: unknown) {
        const axiosError = err as { response?: { data?: { detail?: string } }; message?: string };
        setError(axiosError.response?.data?.detail ?? axiosError.message ?? 'Failed to extend layby');
      } finally {
        setIsSubmitting(false);
      }
    },
    [laybyId, additionalDays, reason, onSuccess]
  );

  return { additionalDays, setAdditionalDays, reason, setReason, isSubmitting, error, handleExtend };
}
