import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';
import { PageHeader } from '@/components/ui/bizpilot';
import { LaybyStatusBadge } from './LaybyStatusBadge';
import type { LaybyStatus } from '../types';

interface LaybyDetailHeaderProps {
  referenceNumber: string;
  customerName?: string;
  status: LaybyStatus;
  createdAt: string;
}

export function LaybyDetailHeader({ referenceNumber, customerName, status, createdAt }: LaybyDetailHeaderProps) {
  const formattedDate = new Date(createdAt).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <PageHeader
      title={referenceNumber}
      description={`${customerName || 'Walk-in Customer'} • Created ${formattedDate}`}
      actions={
        <div className="flex items-center gap-3">
          <LaybyStatusBadge status={status} />
          <Link href="/laybys">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Laybys
            </Button>
          </Link>
        </div>
      }
    />
  );
}
