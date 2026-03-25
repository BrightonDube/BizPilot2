'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertTriangle, DollarSign, PackageCheck, XCircle, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui';
import { useLaybyDetail } from '../hooks/useLaybyDetail';
import { LaybyDetailHeader } from '../components/LaybyDetailHeader';
import { LaybyFinancialSummary } from '../components/LaybyFinancialSummary';
import { LaybyItemsTable } from '../components/LaybyItemsTable';
import { LaybyPaymentSchedule } from '../components/LaybyPaymentSchedule';
import { LaybyPaymentHistory } from '../components/LaybyPaymentHistory';
import { LaybyAuditTrail } from '../components/LaybyAuditTrail';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { CollectLaybyModal } from '../components/CollectLaybyModal';
import { CancelLaybyModal } from '../components/CancelLaybyModal';
import { ExtendLaybyModal } from '../components/ExtendLaybyModal';
import { Toast, showToast } from '../utils/toast';

export default function LaybyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { layby, isLoading, error, notFound, refetch } = useLaybyDetail(id);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const toast = showToast(type, message);
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 5000);
  }, []);

  const handlePaymentRecorded = useCallback(async () => {
    setIsPaymentModalOpen(false);
    await refetch();
    addToast('success', 'Payment recorded successfully');
  }, [refetch, addToast]);

  const handleCollected = useCallback(async () => {
    setIsCollectModalOpen(false);
    await refetch();
    addToast('success', 'Layby marked as collected');
  }, [refetch, addToast]);

  const handleCancelled = useCallback(async () => {
    setIsCancelModalOpen(false);
    await refetch();
    addToast('success', 'Layby has been cancelled');
  }, [refetch, addToast]);

  const handleExtended = useCallback(async () => {
    setIsExtendModalOpen(false);
    await refetch();
    addToast('success', 'Layby end date extended successfully');
  }, [refetch, addToast]);

  const canRecordPayment = layby && (layby.status === 'ACTIVE' || layby.status === 'OVERDUE');
  const canCollect = layby && layby.status === 'READY_FOR_COLLECTION';
  const canCancel = layby && (layby.status === 'ACTIVE' || layby.status === 'OVERDUE' || layby.status === 'READY_FOR_COLLECTION');
  const canExtend = layby && (layby.status === 'ACTIVE' || layby.status === 'OVERDUE');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-gray-400">Loading layby details...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
          <h2 className="text-xl font-semibold text-white">Layby not found</h2>
          <p className="text-gray-400 max-w-md">The layby you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <Button variant="outline" onClick={() => router.push('/laybys')}>
            Back to Laybys
          </Button>
        </div>
      </div>
    );
  }

  if (error || !layby) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
          <h2 className="text-xl font-semibold text-white">Unable to load layby</h2>
          <p className="text-gray-400 max-w-md">{error}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/laybys')}>
              Back to Laybys
            </Button>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600" onClick={refetch}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <LaybyDetailHeader
          referenceNumber={layby.reference_number}
          customerName={layby.customer_name}
          status={layby.status}
          createdAt={layby.created_at}
        />
        <div className="flex items-center gap-2 flex-wrap">
          {canRecordPayment && (
            <Button
              onClick={() => setIsPaymentModalOpen(true)}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          )}
          {canCollect && (
            <Button
              onClick={() => setIsCollectModalOpen(true)}
              className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
            >
              <PackageCheck className="w-4 h-4 mr-2" />
              Mark Collected
            </Button>
          )}
          {canExtend && (
            <Button
              onClick={() => setIsExtendModalOpen(true)}
              variant="outline"
              className="border-blue-500 text-blue-400 hover:bg-blue-950"
            >
              <CalendarPlus className="w-4 h-4 mr-2" />
              Extend
            </Button>
          )}
          {canCancel && (
            <Button
              onClick={() => setIsCancelModalOpen(true)}
              variant="outline"
              className="border-red-500 text-red-400 hover:bg-red-950"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel Layby
            </Button>
          )}
        </div>
      </div>

      <LaybyFinancialSummary
        totalAmount={layby.total_amount}
        depositAmount={layby.deposit_amount}
        amountPaid={layby.amount_paid}
        balanceDue={layby.balance_due}
      />

      <LaybyItemsTable items={layby.items || []} />

      <LaybyPaymentSchedule schedule={layby.schedules || []} />

      <LaybyPaymentHistory payments={layby.payments || []} />

      <LaybyAuditTrail auditTrail={layby.audit_trail || []} />

      {canRecordPayment && (
        <RecordPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          laybyId={id}
          outstandingBalance={layby.balance_due}
          onPaymentRecorded={handlePaymentRecorded}
        />
      )}

      <CollectLaybyModal
        isOpen={isCollectModalOpen}
        onClose={() => setIsCollectModalOpen(false)}
        laybyId={id}
        referenceNumber={layby.reference_number}
        onCollected={handleCollected}
      />

      <CancelLaybyModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        laybyId={id}
        referenceNumber={layby.reference_number}
        onCancelled={handleCancelled}
      />

      <ExtendLaybyModal
        isOpen={isExtendModalOpen}
        onClose={() => setIsExtendModalOpen(false)}
        laybyId={id}
        referenceNumber={layby.reference_number}
        currentEndDate={layby.end_date}
        onExtended={handleExtended}
      />

      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg border ${
              toast.type === 'success'
                ? 'bg-green-900/90 border-green-500/50 text-green-100'
                : 'bg-red-900/90 border-red-500/50 text-red-100'
            }`}
          >
            <p className="font-medium">{toast.type === 'success' ? 'Success' : 'Error'}</p>
            <p className="text-sm mt-1">{toast.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
