import { Calendar } from 'lucide-react';
import { Card, CardContent, Badge } from '@/components/ui';
import type { LaybySchedule } from '../types';

interface LaybyPaymentScheduleProps {
  schedule: LaybySchedule[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const statusConfig: Record<string, { variant: 'info' | 'danger' | 'success' | 'secondary' | 'warning'; label: string }> = {
  pending: { variant: 'warning', label: 'Pending' },
  paid: { variant: 'success', label: 'Paid' },
  overdue: { variant: 'danger', label: 'Overdue' },
  partial: { variant: 'info', label: 'Partial' },
};

export function LaybyPaymentSchedule({ schedule }: LaybyPaymentScheduleProps) {
  if (!schedule || schedule.length === 0) {
    return null;
  }

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          <Calendar className="w-5 h-5 inline-block mr-2" />
          Payment Schedule
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 pb-3 font-medium">Due Date</th>
                <th className="text-right text-gray-400 pb-3 font-medium">Amount Due</th>
                <th className="text-right text-gray-400 pb-3 font-medium">Amount Paid</th>
                <th className="text-right text-gray-400 pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((entry) => {
                const config = statusConfig[entry.status] || statusConfig.pending;
                const isOverdue = entry.status === 'overdue';
                return (
                  <tr key={entry.id} className={`border-b border-gray-700/50 ${isOverdue ? 'bg-red-500/5' : ''}`}>
                    <td className="py-3 text-white">{formatDate(entry.due_date)}</td>
                    <td className="py-3 text-right text-gray-300">{formatCurrency(entry.amount_due)}</td>
                    <td className="py-3 text-right text-gray-300">{formatCurrency(entry.amount_paid)}</td>
                    <td className="py-3 text-right">
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
