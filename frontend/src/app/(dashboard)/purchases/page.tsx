'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  DollarSign,
  ShoppingCart,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { PageHeader, Badge, StatCard, EmptyState } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

interface Purchase {
  id: string;
  order_number: string;
  supplier_name?: string;
  supplier_id: string | null;
  status: string;
  payment_status: string;
  subtotal: number | string;
  tax_amount: number | string;
  discount_amount: number | string;
  total: number | string;
  items_count?: number;
  order_date: string;
  created_at: string;
}

interface OrderListResponse {
  items: Purchase[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'bg-gray-500', icon: <Clock className="w-3 h-3" />, label: 'Draft' },
  pending: { color: 'bg-yellow-500', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
  confirmed: { color: 'bg-blue-500', icon: <CheckCircle className="w-3 h-3" />, label: 'Confirmed' },
  processing: { color: 'bg-purple-500', icon: <Package className="w-3 h-3" />, label: 'Processing' },
  shipped: { color: 'bg-indigo-500', icon: <Truck className="w-3 h-3" />, label: 'Shipped' },
  delivered: { color: 'bg-green-500', icon: <CheckCircle className="w-3 h-3" />, label: 'Delivered' },
  cancelled: { color: 'bg-red-500', icon: <XCircle className="w-3 h-3" />, label: 'Cancelled' },
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPurchases() {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams({
          page: page.toString(),
          per_page: '20',
        });

        params.append('direction', 'outbound');

        if (searchTerm) {
          params.append('search', searchTerm);
        }

        if (selectedStatus !== 'all') {
          params.append('status', selectedStatus);
        }

        const response = await apiClient.get<OrderListResponse>(`/orders?${params}`);
        setPurchases(response.data.items);
        setTotal(response.data.total);
        setPages(response.data.pages);
      } catch (err) {
        console.error('Failed to fetch purchases:', err);
        setError('Failed to load purchases');
      } finally {
        setIsLoading(false);
      }
    }

    const timeoutId = setTimeout(fetchPurchases, 300);
    return () => clearTimeout(timeoutId);
  }, [page, searchTerm, selectedStatus]);

  const totalPurchases = total;
  const totalSpend = purchases.reduce((sum, o) => sum + toNumber(o.total), 0);
  const pendingPurchases = purchases.filter((o) => o.status === 'pending').length;
  const completedPurchases = purchases.filter((o) => o.status === 'delivered').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchases"
        description={`Manage supplier orders (${totalPurchases} purchases)`}
        actions={
          <Link href="/purchases/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              New Purchase
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Purchases" value={totalPurchases} icon={<ShoppingCart className="w-5 h-5" />} />
        <StatCard title="Total Spend" value={formatCurrency(totalSpend)} icon={<DollarSign className="w-5 h-5" />} />
        <StatCard title="Pending" value={pendingPurchases} icon={<Clock className="w-5 h-5" />} />
        <StatCard title="Completed" value={completedPurchases} icon={<CheckCircle className="w-5 h-5" />} />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search purchases..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-10 bg-gray-800 border-gray-700"
          />
        </div>
        <label htmlFor="purchase-status-filter" className="sr-only">
          Filter by purchase status
        </label>
        <select
          id="purchase-status-filter"
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <Button variant="outline" className="border-gray-700">
          <Filter className="w-4 h-4 mr-2" />
          More Filters
        </Button>
      </div>

      {isLoading && purchases.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-gray-400">Loading purchases...</p>
          </div>
        </div>
      ) : error && purchases.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-500" />
            <h2 className="text-xl font-semibold text-white">Unable to load purchases</h2>
            <p className="text-gray-400 max-w-md">{error}</p>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      ) : purchases.length === 0 ? (
        <EmptyState
          title="No purchases found"
          description="Purchases are supplier orders (outbound)."
        />
      ) : (
        <div className="space-y-4">
          {purchases.map((purchase) => {
            const status = statusConfig[purchase.status] || statusConfig.pending;
            const totalValue = toNumber(purchase.total);
            return (
              <Link key={purchase.id} href={`/orders/${purchase.id}`}>
                <Card className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full ${status.color} bg-opacity-20 flex items-center justify-center`}
                        >
                          <span className={`${status.color.replace('bg-', 'text-')}`}>{status.icon}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white">{purchase.order_number}</h3>
                            <Badge variant={purchase.payment_status === 'paid' ? 'success' : 'warning'}>
                              {purchase.payment_status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400">{purchase.supplier_name || 'Supplier'}</p>
                          <p className="text-xs text-gray-500">
                            {purchase.items_count || 0} items • {formatDate(purchase.order_date || purchase.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-white">{formatCurrency(totalValue)}</div>
                        <Badge variant="secondary">{status.label}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-gray-400">
            Page {page} of {pages} ({total} purchases)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
