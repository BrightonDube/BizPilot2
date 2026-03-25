/**
 * CollectLaybyModal.tsx
 * Confirmation dialog to mark a fully-paid layby as collected by the customer.
 */

import { Loader2, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui';
import { useCollectLayby } from '../hooks/useCollectLayby';

interface CollectLaybyModalProps {
  isOpen: boolean;
  onClose: () => void;
  laybyId: string;
  referenceNumber: string;
  onCollected: () => void;
}

export function CollectLaybyModal({
  isOpen,
  onClose,
  laybyId,
  referenceNumber,
  onCollected,
}: CollectLaybyModalProps) {
  const { isSubmitting, error, handleCollect } = useCollectLayby({
    laybyId,
    onSuccess: onCollected,
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
      aria-labelledby="collect-layby-title"
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="collect-layby-title" className="text-lg font-semibold text-white mb-2">
          Mark as Collected
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Confirm that the customer has collected layby{' '}
          <span className="font-medium text-white">{referenceNumber}</span>. This action cannot be
          undone.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

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
            type="button"
            onClick={handleCollect}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <PackageCheck className="w-4 h-4 mr-2" />
                Confirm Collection
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
