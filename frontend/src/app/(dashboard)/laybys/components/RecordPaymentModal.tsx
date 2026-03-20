/**
 * RecordPaymentModal.tsx
 * Modal dialog for recording a payment against an active layby.
 * Shows the outstanding balance, accepts amount and payment method,
 * and submits to the backend via the useRecordPayment hook.
 */

import { Loader2, DollarSign } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useRecordPayment } from '../hooks/useRecordPayment';
import type { LaybyPaymentMethod } from '../types';

interface RecordPaymentModalProps {
  /** Whether the modal is currently visible */
  isOpen: boolean;
  /** Called when the modal should close (user dismisses or ESC) */
  onClose: () => void;
  /** The layby ID to record the payment against */
  laybyId: string;
  /** Current outstanding balance — shown prominently and used for validation */
  outstandingBalance: number;
  /** Called after a successful payment so the parent can refresh data */
  onPaymentRecorded: () => void;
}

/**
 * Formats a number as South African Rand currency.
 */
function formatZAR(value: number): string {
  return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Modal for recording a layby payment.
 * Dismissible by clicking outside or pressing Escape (when not submitting).
 */
export function RecordPaymentModal({
  isOpen,
  onClose,
  laybyId,
  outstandingBalance,
  onPaymentRecorded,
}: RecordPaymentModalProps) {
  const {
    amount,
    setAmount,
    paymentMethod,
    setPaymentMethod,
    notes,
    setNotes,
    isSubmitting,
    error,
    handleSubmit,
  } = useRecordPayment({
    laybyId,
    outstandingBalance,
    onSuccess: onPaymentRecorded,
  });

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSubmitting) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-payment-title"
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="record-payment-title" className="text-lg font-semibold text-white mb-4">
          Record Payment
        </h3>

        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-gray-400">Outstanding Balance</p>
          <p className="text-xl font-semibold text-blue-400">{formatZAR(outstandingBalance)}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="amount" className="block text-sm text-gray-400 mb-1">
              Amount (R) <span className="text-red-400">*</span>
            </label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={outstandingBalance}
              value={amount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-gray-900 border-gray-600"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="payment-method" className="block text-sm text-gray-400 mb-1">
              Payment Method <span className="text-red-400">*</span>
            </label>
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as LaybyPaymentMethod)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isSubmitting}
            >
              <option value="">Select payment method</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="eft">EFT</option>
              <option value="store_credit">Store Credit</option>
            </select>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm text-gray-400 mb-1">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              maxLength={255}
              rows={3}
              placeholder="Optional payment notes..."
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">{notes.length}/255 characters</p>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-gray-600"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4 mr-2" />
                  Record Payment
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
