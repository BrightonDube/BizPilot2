/**
 * useRecordPayment.ts
 * Manages state and submission logic for the Record Payment modal form.
 * Keeps all form logic out of the UI component.
 */

import { useState, useCallback } from 'react';
import { recordLaybyPayment } from '../api/recordLaybyPayment';
import type { LaybyPaymentMethod } from '../types';

interface UseRecordPaymentParams {
  laybyId: string;
  outstandingBalance: number;
  onSuccess: () => void;
}

interface UseRecordPaymentReturn {
  amount: string;
  setAmount: (value: string) => void;
  paymentMethod: LaybyPaymentMethod | '';
  setPaymentMethod: (value: LaybyPaymentMethod | '') => void;
  notes: string;
  setNotes: (value: string) => void;
  isSubmitting: boolean;
  error: string | null;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

/**
 * Hook for managing the Record Payment form state and submission.
 * 
 * @param laybyId - The layby ID to record payment against
 * @param outstandingBalance - Current outstanding balance for validation
 * @param onSuccess - Callback to invoke after successful payment
 * @returns Form state and handlers
 */
export function useRecordPayment({
  laybyId,
  outstandingBalance,
  onSuccess,
}: UseRecordPaymentParams): UseRecordPaymentReturn {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<LaybyPaymentMethod | ''>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const amountNum = parseFloat(amount);

      if (!amount || isNaN(amountNum) || amountNum <= 0) {
        setError('Please enter a valid amount greater than 0');
        return;
      }

      if (amountNum > outstandingBalance) {
        setError(`Amount cannot exceed outstanding balance of R ${outstandingBalance.toFixed(2)}`);
        return;
      }

      if (!paymentMethod) {
        setError('Please select a payment method');
        return;
      }

      setIsSubmitting(true);

      try {
        await recordLaybyPayment(laybyId, {
          amount: amountNum,
          payment_method: paymentMethod,
          reference: notes || undefined,
        });

        setAmount('');
        setPaymentMethod('');
        setNotes('');
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to record payment');
      } finally {
        setIsSubmitting(false);
      }
    },
    [amount, paymentMethod, notes, laybyId, outstandingBalance, onSuccess]
  );

  return {
    amount,
    setAmount,
    paymentMethod,
    setPaymentMethod,
    notes,
    setNotes,
    isSubmitting,
    error,
    handleSubmit,
  };
}
