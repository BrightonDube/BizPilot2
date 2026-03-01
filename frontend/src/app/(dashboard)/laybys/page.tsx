'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Loader2,
  AlertTriangle,
  DollarSign,
  Clock,
  CheckCircle,
  ShoppingCart,
} from 'lucide-react';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { PageHeader, Badge, StatCard, EmptyState } from '@/components/ui/bizpilot';
import { apiClient } from '@/lib/api';

interface Layby {
  id: string;
  reference_number: string;
  customer_name?: string;
  customer_id: string | null;
  status: string;
  total_amount: number | string;
  deposit_amount: number | string;
  balance_remaining: number | string;
  payment_frequency: string;
  items_count?: number;
  created_at: string;
}

interface LaybyListResponse {
  items: Layby[];
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

type BadgeVariant = 'info' | 'danger' | 'success' | 'secondary' | 'warning';

const statusConfig: Record<string, { variant: BadgeVariant; label: string }> = {
  ACTIVE: { variant: 'info', label: 'Active' },
  OVERDUE: { variant: 'danger', label: 'Overdue' },
  READY_FOR_COLLECTION: { variant: 'success', label: 'Ready for Collection' },
  COMPLETED: { variant: 'secondary', label: 'Completed' },
  CANCELLED: { variant: 'secondary', label: 'Cancelled' },
};

export default function LaybysPage() {
  const [laybys, setLaybys] = useState<Layby[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLaybys() {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams({
          page: page.toString(),
          per_page: '20',
        });

        if (searchTerm) {
          params.append('search', searchTerm);
        }

        if (selectedStatus !== 'all') {
          params.append('status', selectedStatus);
        }

        const response = await apiClient.get<LaybyListResponse>(`/laybys?${params}`);
        setLaybys(response.data.items);
        setTotal(response.data.total);
        setPages(response.data.pages);
      } catch (err) {
        console.error('Failed to fetch laybys:', err);
        setError('Failed to load laybys');
      } finally {
        setIsLoading(false);
      }
    }

    const timeoutId = setTimeout(fetchLaybys, 300);
    return () => clearTimeout(timeoutId);
  }, [page, searchTerm, selectedStatus]);

  const activeLaybys = laybys.filter(l => l.status === 'ACTIVE').length;
  const overdueLaybys = laybys.filter(l => l.status === 'OVERDUE').length;
  const totalBalance = laybys.reduce((sum, l) => sum + toNumber(l.balance_remaining), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laybys"
        description={`Manage layby orders (${total} laybys)`}
        actions={
          <Link href="/laybys/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              New Layby
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Laybys"
          value={total}
          icon={<ShoppingCart className="w-5 h-5" />}
        />
        <StatCard
          title="Active"
          value={activeLaybys}
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          title="Overdue"
          value={overdueLaybys}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <StatCard
          title="Outstanding Balance"
          value={formatCurrency(totalBalance)}
          icon={<DollarSign className="w-5 h-5" />}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search laybys..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-10 bg-gray-800 border-gray-700"
          />
        </div>
        <label htmlFor="layby-status-filter" className="sr-only">Filter by layby status</label>
        <select
          id="layby-status-filter"
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="all">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="OVERDUE">Overdue</option>
          <option value="READY_FOR_COLLECTION">Ready for Collection</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {isLoading && laybys.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-gray-400">Loading laybys...</p>
          </div>
        </div>
      ) : error && laybys.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-500" />
            <h2 className="text-xl font-semibold text-white">Unable to load laybys</h2>
            <p className="text-gray-400 max-w-md">{error}</p>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      ) : laybys.length === 0 ? (
        <EmptyState
          title="No laybys found"
          description="Try adjusting your search or filters, or create a new layby"
          action={
            <Link href="/laybys/new">
              <Button>Create Your First Layby</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {laybys.map((layby) => {
            const status = statusConfig[layby.status] || statusConfig.ACTIVE;
            const laybyTotal = toNumber(layby.total_amount);
            const laybyBalance = toNumber(layby.balance_remaining);
            return (
              <Link key={layby.id} href={`/laybys/${layby.id}`}>
                <Card className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white">{layby.reference_number}</h3>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className="text-sm text-gray-400">{layby.customer_name || 'Walk-in Customer'}</p>
                        <p className="text-xs text-gray-500">{formatDate(layby.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-white">
                          {formatCurrency(laybyTotal)}
                        </div>
                        <p className="text-sm text-gray-400">
                          Balance: {formatCurrency(laybyBalance)}
                        </p>
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
            Page {page} of {pages} ({total} laybys)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage(p => Math.min(pages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
