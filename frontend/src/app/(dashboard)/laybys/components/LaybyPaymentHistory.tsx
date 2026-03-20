import { DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import type { LaybyPayment } from '../types';

interface LaybyPaymentHistoryProps {
  payments: LaybyPayment[];
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
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LaybyPaymentHistory({ payments }: LaybyPaymentHistoryProps) {
  if (!payments || payments.length === 0) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            <DollarSign className="w-5 h-5 inline-block mr-2" />
            Payment History
          </h2>
          <p className="text-gray-400 text-center py-8">No payments recorded</p>
        </CardContent>
      </Card>
    );
  }

  const sortedPayments = [...payments].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          <DollarSign className="w-5 h-5 inline-block mr-2" />
          Payment History
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 pb-3 font-medium">Date</th>
                <th className="text-right text-gray-400 pb-3 font-medium">Amount</th>
                <th className="text-left text-gray-400 pb-3 font-medium">Method</th>
                <th className="text-left text-gray-400 pb-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {sortedPayments.map((payment) => (
                <tr key={payment.id} className="border-b border-gray-700/50">
                  <td className="py-3 text-white">{formatDate(payment.created_at)}</td>
                  <td className="py-3 text-right text-green-400 font-medium">{formatCurrency(payment.amount)}</td>
                  <td className="py-3 text-gray-300 capitalize">{payment.payment_method}</td>
                  <td className="py-3 text-gray-400">{payment.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
