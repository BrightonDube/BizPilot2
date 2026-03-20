import { Card, CardContent } from '@/components/ui';

interface LaybyFinancialSummaryProps {
  totalAmount: number;
  depositAmount: number;
  amountPaid: number;
  balanceDue: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function LaybyFinancialSummary({ totalAmount, depositAmount, amountPaid, balanceDue }: LaybyFinancialSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-4">
          <p className="text-sm text-gray-400">Total Amount</p>
          <p className="text-xl font-semibold text-white mt-1">{formatCurrency(totalAmount)}</p>
        </CardContent>
      </Card>
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-4">
          <p className="text-sm text-gray-400">Deposit</p>
          <p className="text-xl font-semibold text-white mt-1">{formatCurrency(depositAmount)}</p>
        </CardContent>
      </Card>
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-4">
          <p className="text-sm text-gray-400">Amount Paid</p>
          <p className="text-xl font-semibold text-green-400 mt-1">{formatCurrency(amountPaid)}</p>
        </CardContent>
      </Card>
      <Card className={`bg-gray-800/50 border-gray-700 ${balanceDue > 0 ? 'ring-2 ring-yellow-500/50' : ''}`}>
        <CardContent className="p-4">
          <p className="text-sm text-gray-400">Outstanding Balance</p>
          <p className="text-xl font-semibold text-white mt-1">{formatCurrency(balanceDue)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
