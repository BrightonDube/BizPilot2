/**
 * ExtendLaybyModal.tsx
 * Modal for extending a layby's end date by a specified number of days.
 */

import { Loader2, CalendarPlus } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useExtendLayby } from '../hooks/useExtendLayby';

interface ExtendLaybyModalProps {
  isOpen: boolean;
  onClose: () => void;
  laybyId: string;
  referenceNumber: string;
  currentEndDate: string;
  onExtended: () => void;
}

export function ExtendLaybyModal({
  isOpen,
  onClose,
  laybyId,
  referenceNumber,
  currentEndDate,
  onExtended,
}: ExtendLaybyModalProps) {
  const {
    additionalDays,
    setAdditionalDays,
    reason,
    setReason,
    isSubmitting,
    error,
    handleExtend,
  } = useExtendLayby({ laybyId, onSuccess: onExtended });

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (!isSubmitting) onClose();
  };

  const formattedEndDate = new Date(currentEndDate).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="extend-layby-title"
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="extend-layby-title" className="text-lg font-semibold text-white mb-2">
          Extend Layby
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Extend the end date for layby{' '}
          <span className="font-medium text-white">{referenceNumber}</span>. Current end date:{' '}
          <span className="font-medium text-white">{formattedEndDate}</span>.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleExtend} className="space-y-4">
          <div>
            <label htmlFor="additional-days" className="block text-sm text-gray-400 mb-1">
              Additional Days <span className="text-red-400">*</span>
            </label>
            <Input
              id="additional-days"
              type="number"
              min="1"
              max="365"
              value={additionalDays}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setAdditionalDays(e.target.value)
              }
              placeholder="e.g. 30"
              className="bg-gray-900 border-gray-600"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="extend-reason" className="block text-sm text-gray-400 mb-1">
              Reason (Optional)
            </label>
            <textarea
              id="extend-reason"
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              maxLength={255}
              rows={3}
              placeholder="Why is the end date being extended?"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
                  Extending...
                </>
              ) : (
                <>
                  <CalendarPlus className="w-4 h-4 mr-2" />
                  Extend Layby
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
