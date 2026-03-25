/**
 * CancelLaybyModal.tsx
 * Modal for cancelling a layby with an optional cancellation reason.
 */

import { Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { useCancelLayby } from '../hooks/useCancelLayby';

interface CancelLaybyModalProps {
  isOpen: boolean;
  onClose: () => void;
  laybyId: string;
  referenceNumber: string;
  onCancelled: () => void;
}

export function CancelLaybyModal({
  isOpen,
  onClose,
  laybyId,
  referenceNumber,
  onCancelled,
}: CancelLaybyModalProps) {
  const { reason, setReason, isSubmitting, error, handleCancel } = useCancelLayby({
    laybyId,
    onSuccess: onCancelled,
  });

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (!isSubmitting) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-layby-title"
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="cancel-layby-title" className="text-lg font-semibold text-white mb-2">
          Cancel Layby
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          You are about to cancel layby{' '}
          <span className="font-medium text-white">{referenceNumber}</span>. Any cancellation fees
          defined in settings will apply. This action cannot be undone.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="cancel-reason" className="block text-sm text-gray-400 mb-1">
            Reason (Optional)
          </label>
          <textarea
            id="cancel-reason"
            value={reason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
            maxLength={255}
            rows={3}
            placeholder="Why is this layby being cancelled?"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-500 mt-1">{reason.length}/255 characters</p>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-gray-600"
            disabled={isSubmitting}
          >
            Keep Layby
          </Button>
          <Button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Cancel Layby
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
