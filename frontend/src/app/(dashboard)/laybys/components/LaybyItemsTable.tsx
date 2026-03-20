import { Card, CardContent } from '@/components/ui';
import type { LaybyItem } from '../types';

interface LaybyItemsTableProps {
  items: LaybyItem[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function LaybyItemsTable({ items }: LaybyItemsTableProps) {
  if (!items || items.length === 0) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Items</h2>
          <p className="text-gray-400 text-center py-8">No items found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 pb-3 font-medium">Product</th>
                <th className="text-right text-gray-400 pb-3 font-medium">Qty</th>
                <th className="text-right text-gray-400 pb-3 font-medium">Unit Price</th>
                <th className="text-right text-gray-400 pb-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-700/50">
                  <td className="py-3 text-white">{item.product_name}</td>
                  <td className="py-3 text-right text-gray-300">{item.quantity}</td>
                  <td className="py-3 text-right text-gray-300">{formatCurrency(item.unit_price)}</td>
                  <td className="py-3 text-right text-white font-medium">{formatCurrency(item.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
