'use client';

import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';
import { useLaybyDetail } from '../hooks/useLaybyDetail';
import { LaybyDetailHeader } from '../components/LaybyDetailHeader';
import { LaybyFinancialSummary } from '../components/LaybyFinancialSummary';
import { LaybyItemsTable } from '../components/LaybyItemsTable';
import { LaybyPaymentSchedule } from '../components/LaybyPaymentSchedule';
import { LaybyPaymentHistory } from '../components/LaybyPaymentHistory';
import { LaybyAuditTrail } from '../components/LaybyAuditTrail';

export default function LaybyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { layby, isLoading, error, notFound, refetch } = useLaybyDetail(id);

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
      <LaybyDetailHeader
        referenceNumber={layby.reference_number}
        customerName={layby.customer_name}
        status={layby.status}
        createdAt={layby.created_at}
      />

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
    </div>
  );
}
