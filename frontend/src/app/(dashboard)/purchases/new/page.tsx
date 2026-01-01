'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';
import { PageHeader } from '@/components/ui/bizpilot';
import { OrderForm } from '@/components/orders/OrderForm';

export default function NewPurchasePage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Purchase"
        description="Create a new supplier order"
        actions={
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        }
      />
      <OrderForm mode="outbound" />
    </div>
  );
}
